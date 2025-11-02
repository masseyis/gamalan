use super::TaskAnalysis;
use crate::application::ports::TaskInfo;
use uuid::Uuid;

pub struct TaskAnalyzer;

impl TaskAnalyzer {
    pub fn analyze(
        task_info: &TaskInfo,
        _valid_ac_ids: &[String],
        _previous_analysis: Option<&TaskAnalysis>,
    ) -> TaskAnalysis {
        let mut clarity_score = 70;
        let mut missing_elements = Vec::new();

        // Basic analysis logic
        if task_info.description.is_none() || task_info.description.as_ref().unwrap().is_empty() {
            missing_elements.push("Task lacks a detailed description".to_string());
            clarity_score -= 20;
        }

        if task_info.acceptance_criteria_refs.is_empty() {
            missing_elements.push("Task has no linked acceptance criteria".to_string());
            clarity_score -= 15;
        }

        if task_info.estimated_hours.is_none() {
            missing_elements.push("Task has no time estimate".to_string());
            clarity_score -= 10;
        }

        let summary = if clarity_score >= 80 {
            "Task is well-defined and ready for implementation".to_string()
        } else if clarity_score >= 60 {
            "Task needs some improvements before it's ready".to_string()
        } else {
            "Task requires significant clarification".to_string()
        };

        TaskAnalysis {
            id: Uuid::new_v4(),
            task_id: task_info.id,
            story_id: task_info.story_id,
            organization_id: None,
            clarity_score,
            missing_elements,
            summary,
        }
    }
}
