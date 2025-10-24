use crate::domain::{AcceptanceCriterion, ReadinessEvaluation};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct AcceptanceCriterionRow {
    pub id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

impl From<AcceptanceCriterionRow> for AcceptanceCriterion {
    fn from(row: AcceptanceCriterionRow) -> Self {
        AcceptanceCriterion {
            id: row.id,
            story_id: row.story_id,
            organization_id: row.organization_id,
            ac_id: row.ac_id,
            given: row.given,
            when: row.when,
            then: row.then,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ReadinessEvaluationRow {
    pub id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub score: i32,
    pub missing_items: Vec<String>,
    pub summary: String,
    pub recommendations: Vec<String>,
}

impl From<ReadinessEvaluationRow> for ReadinessEvaluation {
    fn from(row: ReadinessEvaluationRow) -> Self {
        ReadinessEvaluation {
            id: row.id,
            story_id: row.story_id,
            organization_id: row.organization_id,
            score: row.score,
            missing_items: row.missing_items,
            summary: row.summary,
            recommendations: row.recommendations,
        }
    }
}
