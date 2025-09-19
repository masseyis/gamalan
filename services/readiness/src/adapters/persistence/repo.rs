use crate::adapters::persistence::models::{AcceptanceCriterionRow, ReadinessEvaluationRow};
use crate::application::ports::{AcceptanceCriteriaRepository, ReadinessEvaluationRepository};
use crate::domain::{AcceptanceCriterion, ReadinessEvaluation};
use async_trait::async_trait;
use common::AppError;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SqlAcceptanceCriteriaRepository {
    pool: PgPool,
}

impl SqlAcceptanceCriteriaRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AcceptanceCriteriaRepository for SqlAcceptanceCriteriaRepository {
    async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        for criterion in criteria {
            sqlx::query(
                "INSERT INTO criteria (id, story_id, ac_id, given, when, then) 
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (story_id, ac_id) DO UPDATE SET
                 given = EXCLUDED.given, when = EXCLUDED.when, then = EXCLUDED.then",
            )
            .bind(criterion.id)
            .bind(criterion.story_id)
            .bind(&criterion.ac_id)
            .bind(&criterion.given)
            .bind(&criterion.when)
            .bind(&criterion.then)
            .execute(&mut *tx)
            .await
            .map_err(|_| AppError::InternalServerError)?;
        }

        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;
        Ok(())
    }

    async fn get_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        let rows = sqlx::query_as::<_, AcceptanceCriterionRow>(
            "SELECT id, story_id, ac_id, given, when, then FROM criteria
             WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
             ORDER BY ac_id",
        )
        .bind(story_id)
        .bind(organization_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(rows.into_iter().map(AcceptanceCriterion::from).collect())
    }

    async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE criteria SET given = $3, when = $4, then = $5 
             WHERE id = $1 AND story_id = $2",
        )
        .bind(criterion.id)
        .bind(criterion.story_id)
        .bind(&criterion.given)
        .bind(&criterion.when)
        .bind(&criterion.then)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }

    async fn delete_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        sqlx::query("DELETE FROM criteria WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))")
            .bind(story_id)
            .bind(organization_id)
            .execute(&self.pool)
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }

    async fn get_criterion_by_story_and_ac_id(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        ac_id: &str,
    ) -> Result<Option<AcceptanceCriterion>, AppError> {
        let row = sqlx::query_as::<_, AcceptanceCriterionRow>(
            "SELECT id, story_id, ac_id, given, when, then FROM criteria
             WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) AND ac_id = $3",
        )
        .bind(story_id)
        .bind(organization_id)
        .bind(ac_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(row.map(AcceptanceCriterion::from))
    }
}

pub struct SqlReadinessEvaluationRepository {
    pool: PgPool,
}

impl SqlReadinessEvaluationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ReadinessEvaluationRepository for SqlReadinessEvaluationRepository {
    async fn save_evaluation(&self, eval: &ReadinessEvaluation) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO readiness_evals (id, story_id, score, missing_items) 
             VALUES ($1, $2, $3, $4)",
        )
        .bind(eval.id)
        .bind(eval.story_id)
        .bind(eval.score)
        .bind(&eval.missing_items)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }

    async fn get_latest_evaluation(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ReadinessEvaluation>, AppError> {
        let row = sqlx::query_as::<_, ReadinessEvaluationRow>(
            "SELECT id, story_id, score, missing_items FROM readiness_evals
             WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) 
             ORDER BY id DESC 
             LIMIT 1",
        )
        .bind(story_id)
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(row.map(ReadinessEvaluation::from))
    }
}
