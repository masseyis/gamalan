use crate::adapters::persistence::models::{AcceptanceCriterionRow, ReadinessEvaluationRow};
use crate::application::ports::{AcceptanceCriteriaRepository, ReadinessEvaluationRepository};
use crate::domain::{AcceptanceCriterion, ReadinessEvaluation};
use async_trait::async_trait;
use common::AppError;
use event_bus::AcceptanceCriterionRecord;
use serde_json::Value;
use sqlx::{PgPool, Row};
use tracing::error;
use uuid::Uuid;

/// Persist acceptance criteria in the shared database pool.
pub async fn create_criteria(
    pool: &PgPool,
    criteria: &[AcceptanceCriterion],
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|err| {
        error!(
            error = %err,
            "Failed to begin transaction for acceptance criteria creation"
        );
        AppError::InternalServerError
    })?;

    for criterion in criteria {
        sqlx::query(
            "INSERT INTO criteria (id, story_id, ac_id, given, \"when\", \"then\") \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (story_id, ac_id) DO UPDATE SET \
             given = EXCLUDED.given, \"when\" = EXCLUDED.\"when\", \"then\" = EXCLUDED.\"then\"",
        )
        .bind(criterion.id)
        .bind(criterion.story_id)
        .bind(&criterion.ac_id)
        .bind(&criterion.given)
        .bind(&criterion.when)
        .bind(&criterion.then)
        .execute(&mut *tx)
        .await
        .map_err(|err| {
            error!(error = %err, "Failed to upsert acceptance criterion");
            AppError::InternalServerError
        })?;
    }

    tx.commit().await.map_err(|err| {
        error!(
            error = %err,
            "Failed to commit acceptance criteria transaction"
        );
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn get_criteria_by_story(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Vec<AcceptanceCriterion>, AppError> {
    let rows = sqlx::query_as::<_, AcceptanceCriterionRow>(
        "SELECT c.id, c.story_id, s.organization_id, c.ac_id, c.given, c.\"when\" AS \"when\", c.\"then\" AS \"then\" \
         FROM criteria c \
         JOIN stories s ON s.id = c.story_id \
         WHERE c.story_id = $1 \
           AND ($2::UUID IS NULL OR s.organization_id = $2 OR (s.organization_id IS NULL AND $2 IS NULL)) \
         ORDER BY c.ac_id",
    )
    .bind(story_id)
    .bind(organization_id)
    .fetch_all(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch acceptance criteria rows");
        AppError::InternalServerError
    })?;

    if !rows.is_empty() {
        return Ok(rows.into_iter().map(AcceptanceCriterion::from).collect());
    }

    let json_row = sqlx::query(
        "SELECT organization_id, acceptance_criteria FROM readiness_story_projections WHERE id = $1",
    )
    .bind(story_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch readiness story projection");
        AppError::InternalServerError
    })?;

    if let Some(row) = json_row {
        let value: Value = row.get("acceptance_criteria");
        let projection_org_id: Option<Uuid> = row.get("organization_id");
        let records: Vec<AcceptanceCriterionRecord> = match serde_json::from_value(value.clone()) {
            Ok(records) => records,
            Err(err) => {
                error!(error = %err, %story_id, "Failed to parse acceptance criteria projection");
                Vec::new()
            }
        };
        let criteria = records
            .into_iter()
            .enumerate()
            .map(|(index, record)| AcceptanceCriterion {
                id: record.id,
                story_id: record.story_id,
                organization_id: projection_org_id,
                ac_id: format!("AC{}", index + 1),
                given: record.given,
                when: record.when,
                then: record.then,
            })
            .collect();
        return Ok(criteria);
    }

    Ok(vec![])
}

pub async fn update_criterion(
    pool: &PgPool,
    criterion: &AcceptanceCriterion,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE criteria SET given = $3, \"when\" = $4, \"then\" = $5 \
         WHERE id = $1 AND story_id = $2",
    )
    .bind(criterion.id)
    .bind(criterion.story_id)
    .bind(&criterion.given)
    .bind(&criterion.when)
    .bind(&criterion.then)
    .execute(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %criterion.id, "Failed to update acceptance criterion");
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn delete_criteria_by_story(
    pool: &PgPool,
    story_id: Uuid,
    _organization_id: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM criteria WHERE story_id = $1")
        .bind(story_id)
        .execute(pool)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to delete acceptance criteria for story");
            AppError::InternalServerError
        })?;

    Ok(())
}

pub async fn get_criterion_by_story_and_ac_id(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
    ac_id: &str,
) -> Result<Option<AcceptanceCriterion>, AppError> {
    let row = sqlx::query_as::<_, AcceptanceCriterionRow>(
        "SELECT c.id, c.story_id, s.organization_id, c.ac_id, c.given, c.\"when\" AS \"when\", c.\"then\" AS \"then\" \
         FROM criteria c \
         JOIN stories s ON s.id = c.story_id \
         WHERE c.story_id = $1 \
           AND ($2::UUID IS NULL OR s.organization_id = $2 OR (s.organization_id IS NULL AND $2 IS NULL)) \
           AND c.ac_id = $3",
    )
    .bind(story_id)
    .bind(organization_id)
    .bind(ac_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, ac_id = ac_id, "Failed to fetch acceptance criterion");
        AppError::InternalServerError
    })?;

    if let Some(row) = row {
        return Ok(Some(AcceptanceCriterion::from(row)));
    }

    let json_row = sqlx::query(
        "SELECT organization_id, acceptance_criteria FROM readiness_story_projections WHERE id = $1",
    )
    .bind(story_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch readiness story projection");
        AppError::InternalServerError
    })?;

    if let Some(row) = json_row {
        let value: Value = row.get("acceptance_criteria");
        let _projection_org_id: Option<Uuid> = row.get("organization_id");
        let records: Vec<AcceptanceCriterionRecord> = match serde_json::from_value(value.clone()) {
            Ok(records) => records,
            Err(err) => {
                error!(error = %err, %story_id, "Failed to parse acceptance criteria projection");
                Vec::new()
            }
        };
        if let Some((index, record)) = records
            .into_iter()
            .enumerate()
            .find(|(index, _)| format!("AC{}", index + 1) == ac_id)
        {
            return Ok(Some(AcceptanceCriterion {
                id: record.id,
                story_id: record.story_id,
                organization_id,
                ac_id: format!("AC{}", index + 1),
                given: record.given,
                when: record.when,
                then: record.then,
            }));
        }
    }

    Ok(None)
}

pub async fn save_evaluation(pool: &PgPool, eval: &ReadinessEvaluation) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO readiness_evals (id, story_id, organization_id, score, missing_items, summary, recommendations) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(eval.id)
    .bind(eval.story_id)
    .bind(eval.organization_id)
    .bind(eval.score)
    .bind(&eval.missing_items)
    .bind(&eval.summary)
    .bind(&eval.recommendations)
    .execute(pool)
    .await
    .map_err(|err| {
        error!(
            error = %err,
            eval_id = %eval.id,
            story_id = %eval.story_id,
            "Failed to save readiness evaluation"
        );
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn get_latest_evaluation(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Option<ReadinessEvaluation>, AppError> {
    let row = sqlx::query_as::<_, ReadinessEvaluationRow>(
        "SELECT id, story_id, organization_id, score, missing_items, summary, recommendations FROM readiness_evals \
         WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) \
         ORDER BY id DESC \
         LIMIT 1",
    )
    .bind(story_id)
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch latest readiness evaluation");
        AppError::InternalServerError
    })?;

    Ok(row.map(ReadinessEvaluation::from))
}

#[async_trait]
impl AcceptanceCriteriaRepository for PgPool {
    async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError> {
        create_criteria(self, criteria).await
    }

    async fn get_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        get_criteria_by_story(self, story_id, organization_id).await
    }

    async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError> {
        update_criterion(self, criterion).await
    }

    async fn delete_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        delete_criteria_by_story(self, story_id, organization_id).await
    }

    async fn get_criterion_by_story_and_ac_id(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        ac_id: &str,
    ) -> Result<Option<AcceptanceCriterion>, AppError> {
        get_criterion_by_story_and_ac_id(self, story_id, organization_id, ac_id).await
    }
}

#[async_trait]
impl ReadinessEvaluationRepository for PgPool {
    async fn save_evaluation(&self, eval: &ReadinessEvaluation) -> Result<(), AppError> {
        save_evaluation(self, eval).await
    }

    async fn get_latest_evaluation(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ReadinessEvaluation>, AppError> {
        get_latest_evaluation(self, story_id, organization_id).await
    }
}
