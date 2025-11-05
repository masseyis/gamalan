use crate::adapters::persistence::models::{AcceptanceCriterionRow, ReadinessEvaluationRow};
use crate::application::ports::{
    AcceptanceCriteriaRepository, ReadinessEvaluationRepository, TaskAnalysisRepository,
};
use crate::domain::{AcceptanceCriterion, ReadinessEvaluation, TaskAnalysis};
use async_trait::async_trait;
use common::AppError;
use event_bus::AcceptanceCriterionRecord;
use serde::Deserialize;
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
        let mut criteria =
            match parse_projection_acceptance_criteria(story_id, projection_org_id, &value) {
                Ok(criteria) => criteria,
                Err(err) => {
                    error!(
                        error = %err,
                        %story_id,
                        "Failed to parse acceptance criteria projection"
                    );
                    Vec::new()
                }
            };

        if criteria.is_empty() {
            if let Ok(records) =
                serde_json::from_value::<Vec<AcceptanceCriterionRecord>>(value.clone())
            {
                criteria = records
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
            }
        }

        return Ok(criteria);
    }

    Ok(vec![])
}

fn parse_projection_acceptance_criteria(
    story_id: Uuid,
    projection_org_id: Option<Uuid>,
    value: &Value,
) -> Result<Vec<AcceptanceCriterion>, serde_json::Error> {
    #[derive(Debug, Deserialize)]
    struct ProjectionAcceptanceCriterion {
        #[serde(default)]
        id: Option<Uuid>,
        #[serde(default, alias = "acId", alias = "ac_id")]
        ac_id: Option<String>,
        #[serde(default)]
        given: Option<String>,
        #[serde(default, alias = "when", alias = "whenClause", alias = "when_clause")]
        when_text: Option<String>,
        #[serde(default, alias = "then", alias = "thenClause", alias = "then_clause")]
        then_text: Option<String>,
    }

    let records: Vec<ProjectionAcceptanceCriterion> = serde_json::from_value(value.clone())?;
    let mut results = Vec::with_capacity(records.len());

    for (index, record) in records.into_iter().enumerate() {
        let id = record.id.unwrap_or_else(Uuid::new_v4);
        let mut ac_id = record
            .ac_id
            .as_ref()
            .map(|raw| raw.trim())
            .filter(|trimmed| !trimmed.is_empty())
            .map(|trimmed| trimmed.to_string());
        if ac_id.is_none() {
            ac_id = Some(id.to_string());
        }
        let ac_id = ac_id.unwrap_or_else(|| format!("AC{}", index + 1));

        let sanitize = |value: Option<String>, fallback: &str| {
            value
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
                .unwrap_or_else(|| fallback.to_string())
        };

        results.push(AcceptanceCriterion {
            id,
            story_id,
            organization_id: projection_org_id,
            ac_id,
            given: sanitize(record.given, "Given context pending clarification."),
            when: sanitize(record.when_text, "When condition pending clarification."),
            then: sanitize(record.then_text, "Then outcome pending clarification."),
        });
    }

    Ok(results)
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
        let projection_org_id: Option<Uuid> = row.get("organization_id");
        match parse_projection_acceptance_criteria(story_id, projection_org_id, &value) {
            Ok(criteria) => {
                if let Some(found) = criteria
                    .into_iter()
                    .find(|criterion| criterion.ac_id == ac_id)
                {
                    return Ok(Some(found));
                }
            }
            Err(err) => {
                error!(
                    error = %err,
                    %story_id,
                    "Failed to parse acceptance criteria projection"
                );
            }
        }

        if let Ok(records) = serde_json::from_value::<Vec<AcceptanceCriterionRecord>>(value) {
            for (index, record) in records.into_iter().enumerate() {
                let candidate = AcceptanceCriterion {
                    id: record.id,
                    story_id: record.story_id,
                    organization_id,
                    ac_id: format!("AC{}", index + 1),
                    given: record.given,
                    when: record.when,
                    then: record.then,
                };
                if candidate.ac_id == ac_id {
                    return Ok(Some(candidate));
                }
            }
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

#[async_trait]
impl TaskAnalysisRepository for PgPool {
    async fn save_analysis(&self, analysis: &TaskAnalysis) -> Result<(), AppError> {
        let analysis_json = serde_json::to_value(analysis).map_err(|err| {
            error!(error = %err, task_id = %analysis.task_id, "Failed to serialize task analysis");
            AppError::InternalServerError
        })?;

        sqlx::query(
            "INSERT INTO task_analyses (id, task_id, story_id, organization_id, analysis_json, created_at) \
             VALUES ($1, $2, $3, $4, $5, NOW())",
        )
        .bind(Uuid::new_v4())
        .bind(analysis.task_id)
        .bind(analysis.story_id)
        .bind(analysis.organization_id)
        .bind(analysis_json)
        .execute(self)
        .await
        .map_err(|err| {
            error!(
                error = %err,
                task_id = %analysis.task_id,
                "Failed to save task analysis"
            );
            AppError::InternalServerError
        })?;

        Ok(())
    }

    async fn get_latest_analysis(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskAnalysis>, AppError> {
        let row = sqlx::query(
            "SELECT analysis_json FROM task_analyses \
             WHERE task_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) \
             ORDER BY created_at DESC \
             LIMIT 1",
        )
        .bind(task_id)
        .bind(organization_id)
        .fetch_optional(self)
        .await
        .map_err(|err| {
            error!(error = %err, %task_id, "Failed to fetch latest task analysis");
            AppError::InternalServerError
        })?;

        if let Some(row) = row {
            let analysis_json: Value = row.get("analysis_json");
            let analysis: TaskAnalysis = serde_json::from_value(analysis_json).map_err(|err| {
                error!(error = %err, %task_id, "Failed to deserialize task analysis");
                AppError::InternalServerError
            })?;
            Ok(Some(analysis))
        } else {
            Ok(None)
        }
    }
}
