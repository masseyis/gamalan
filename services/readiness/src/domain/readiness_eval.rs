use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadinessEvaluation {
    pub id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub score: i32,
    pub missing_items: Vec<String>,
}

impl ReadinessEvaluation {
    pub fn new(
        story_id: Uuid,
        organization_id: Option<Uuid>,
        score: i32,
        missing_items: Vec<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            story_id,
            organization_id,
            score: score.clamp(0, 100), // Clamp between 0-100
            missing_items,
        }
    }

    #[allow(dead_code)]
    pub fn is_ready(&self) -> bool {
        self.score >= 80 && self.missing_items.is_empty()
    }
}

#[derive(Debug)]
#[allow(dead_code)]
pub enum ReadinessCheck {
    AcceptanceCriteria,
    TaskCoverage,
    StorySize,
    Dependencies,
}

impl ReadinessCheck {
    pub fn description(&self) -> &'static str {
        match self {
            Self::AcceptanceCriteria => "Story must have at least one acceptance criterion",
            Self::TaskCoverage => "All acceptance criteria must be covered by tasks",
            Self::StorySize => "Story must be appropriately sized for a sprint",
            Self::Dependencies => "All dependencies must be resolved",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_readiness_evaluation() {
        let story_id = Uuid::new_v4();
        let eval = ReadinessEvaluation::new(story_id, None, 85, vec![]);

        assert_eq!(eval.story_id, story_id);
        assert_eq!(eval.score, 85);
        assert!(eval.is_ready());
    }

    #[test]
    fn test_not_ready_with_missing_items() {
        let story_id = Uuid::new_v4();
        let eval = ReadinessEvaluation::new(
            story_id,
            None,
            90,
            vec!["Missing acceptance criteria".to_string()],
        );

        assert!(!eval.is_ready());
    }

    #[test]
    fn test_score_clamping() {
        let story_id = Uuid::new_v4();
        let eval = ReadinessEvaluation::new(story_id, None, 150, vec![]);
        assert_eq!(eval.score, 100);

        let eval = ReadinessEvaluation::new(story_id, None, -50, vec![]);
        assert_eq!(eval.score, 0);
    }
}
