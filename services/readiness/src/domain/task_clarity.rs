//! Task Clarity Analysis Domain Models
//!
//! AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Represents a clarity analysis result for a task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskClarityAnalysis {
    pub task_id: Uuid,
    pub overall_score: u8, // 0-100
    pub level: ClarityLevel,
    pub dimensions: Vec<DimensionScore>,
    pub recommendations: Vec<String>,
    pub flagged_terms: Vec<String>,
    pub analyzed_at: chrono::DateTime<chrono::Utc>,
}

impl TaskClarityAnalysis {
    pub fn new(
        task_id: Uuid,
        overall_score: u8,
        dimensions: Vec<DimensionScore>,
        recommendations: Vec<String>,
        flagged_terms: Vec<String>,
    ) -> Self {
        let level = ClarityLevel::from_score(overall_score);
        Self {
            task_id,
            overall_score,
            level,
            dimensions,
            recommendations,
            flagged_terms,
            analyzed_at: chrono::Utc::now(),
        }
    }

    /// Check if the task is ready for AI agent/junior dev (>= 80% rule)
    pub fn is_ai_ready(&self) -> bool {
        self.overall_score >= 80
    }
}

/// Clarity level categorization
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClarityLevel {
    Excellent, // 90-100
    Good,      // 70-89
    Fair,      // 50-69
    Poor,      // 0-49
}

impl ClarityLevel {
    pub fn from_score(score: u8) -> Self {
        match score {
            90..=100 => Self::Excellent,
            70..=89 => Self::Good,
            50..=69 => Self::Fair,
            _ => Self::Poor,
        }
    }
}

/// Represents a scored dimension of task clarity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DimensionScore {
    pub dimension: String,
    pub score: u8, // 0-100
    pub weight: f32,
    pub description: Option<String>,
}

impl DimensionScore {
    pub fn new(dimension: String, score: u8, weight: f32, description: Option<String>) -> Self {
        Self {
            dimension,
            score,
            weight,
            description,
        }
    }
}

/// Suggested task for a story
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSuggestion {
    pub title: String,
    pub description: String,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<u32>,
    pub relevant_files: Vec<String>,
    pub confidence: f32, // 0.0-1.0
}

impl TaskSuggestion {
    pub fn new(
        title: String,
        description: String,
        acceptance_criteria_refs: Vec<String>,
        estimated_hours: Option<u32>,
        relevant_files: Vec<String>,
        confidence: f32,
    ) -> Self {
        Self {
            title,
            description,
            acceptance_criteria_refs,
            estimated_hours,
            relevant_files,
            confidence,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clarity_level_from_score() {
        assert_eq!(ClarityLevel::from_score(95), ClarityLevel::Excellent);
        assert_eq!(ClarityLevel::from_score(90), ClarityLevel::Excellent);
        assert_eq!(ClarityLevel::from_score(85), ClarityLevel::Good);
        assert_eq!(ClarityLevel::from_score(70), ClarityLevel::Good);
        assert_eq!(ClarityLevel::from_score(65), ClarityLevel::Fair);
        assert_eq!(ClarityLevel::from_score(50), ClarityLevel::Fair);
        assert_eq!(ClarityLevel::from_score(45), ClarityLevel::Poor);
        assert_eq!(ClarityLevel::from_score(0), ClarityLevel::Poor);
    }

    #[test]
    fn test_task_clarity_analysis_creation() {
        let task_id = Uuid::new_v4();
        let dimensions = vec![
            DimensionScore::new(
                "technical".to_string(),
                85,
                0.25,
                Some("Good technical details".to_string()),
            ),
            DimensionScore::new(
                "specificity".to_string(),
                75,
                0.15,
                Some("Fairly specific".to_string()),
            ),
        ];
        let recommendations = vec!["Add file paths".to_string()];
        let flagged_terms = vec!["should".to_string(), "maybe".to_string()];

        let analysis = TaskClarityAnalysis::new(
            task_id,
            82,
            dimensions.clone(),
            recommendations,
            flagged_terms,
        );

        assert_eq!(analysis.task_id, task_id);
        assert_eq!(analysis.overall_score, 82);
        assert_eq!(analysis.level, ClarityLevel::Good);
        assert_eq!(analysis.dimensions.len(), 2);
        assert!(analysis.is_ai_ready());
    }

    #[test]
    fn test_ai_ready_threshold() {
        let task_id = Uuid::new_v4();

        // >= 80% is AI ready
        let analysis_ready = TaskClarityAnalysis::new(task_id, 80, vec![], vec![], vec![]);
        assert!(analysis_ready.is_ai_ready());

        let analysis_excellent = TaskClarityAnalysis::new(task_id, 95, vec![], vec![], vec![]);
        assert!(analysis_excellent.is_ai_ready());

        // < 80% is not AI ready
        let analysis_not_ready = TaskClarityAnalysis::new(task_id, 79, vec![], vec![], vec![]);
        assert!(!analysis_not_ready.is_ai_ready());
    }

    #[test]
    fn test_task_suggestion_creation() {
        let suggestion = TaskSuggestion::new(
            "[Backend] Implement task analyzer".to_string(),
            "Create domain logic for analyzing task clarity".to_string(),
            vec!["AC1".to_string(), "AC2".to_string()],
            Some(3),
            vec!["services/readiness/src/domain/task_analyzer.rs".to_string()],
            0.85,
        );

        assert_eq!(suggestion.title, "[Backend] Implement task analyzer");
        assert!(suggestion.description.contains("analyzing"));
        assert_eq!(suggestion.acceptance_criteria_refs.len(), 2);
        assert_eq!(suggestion.estimated_hours, Some(3));
        assert_eq!(suggestion.relevant_files.len(), 1);
        assert_eq!(suggestion.confidence, 0.85);
    }

    #[test]
    fn test_dimension_score_with_weight() {
        let dimension = DimensionScore::new(
            "completeness".to_string(),
            70,
            0.20,
            Some("Missing some context".to_string()),
        );

        assert_eq!(dimension.dimension, "completeness");
        assert_eq!(dimension.score, 70);
        assert_eq!(dimension.weight, 0.20);
        assert_eq!(
            dimension.description,
            Some("Missing some context".to_string())
        );
    }
}
