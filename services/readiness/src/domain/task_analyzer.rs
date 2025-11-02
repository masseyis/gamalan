use super::{GapType, Recommendation, TaskAnalysis};
use crate::application::ports::TaskInfo;
use uuid::Uuid;

pub struct TaskAnalyzer;

impl TaskAnalyzer {
    pub fn analyze(
        task_info: &TaskInfo,
        valid_ac_ids: &[String],
        _previous_analysis: Option<&TaskAnalysis>,
    ) -> TaskAnalysis {
        let mut clarity_score = 100;
        let mut missing_elements = Vec::new();
        let mut recommendations = Vec::new();

        // Check for missing or empty description
        let has_description = task_info
            .description
            .as_ref()
            .map(|d| !d.trim().is_empty())
            .unwrap_or(false);

        if !has_description {
            missing_elements.push("Task lacks a detailed description".to_string());
            clarity_score -= 20;
        }

        // Analyze technical details
        if let Some(desc) = &task_info.description {
            let technical_gaps = Self::check_technical_details(desc);
            if !technical_gaps.is_empty() {
                recommendations.push(Recommendation {
                    gap_type: GapType::MissingTechnicalDetails,
                    message: "Task description lacks specific technical details".to_string(),
                    specific_suggestions: technical_gaps,
                    ac_references: vec![],
                });
                clarity_score -= 15;
            }

            // Check for vague language
            let vague_terms = Self::check_vague_language(desc);
            if !vague_terms.is_empty() {
                recommendations.push(Recommendation {
                    gap_type: GapType::VagueLanguage,
                    message: "Task contains vague or ambiguous language".to_string(),
                    specific_suggestions: vague_terms,
                    ac_references: vec![],
                });
                clarity_score -= 10;
            }

            // Check AI agent compatibility requirements
            let ai_gaps = Self::check_ai_compatibility(desc);
            if !ai_gaps.is_empty() {
                recommendations.push(Recommendation {
                    gap_type: GapType::MissingAiAgentCompatibility,
                    message: "Task missing elements for AI agent compatibility".to_string(),
                    specific_suggestions: ai_gaps,
                    ac_references: vec![],
                });
                clarity_score -= 10;
            }
        }

        // Check acceptance criteria references
        if task_info.acceptance_criteria_refs.is_empty() {
            missing_elements.push("Task has no linked acceptance criteria".to_string());

            let ac_suggestions = if valid_ac_ids.is_empty() {
                vec!["No acceptance criteria available for this story. Consider defining story-level acceptance criteria first.".to_string()]
            } else {
                let mut suggestions = vec![
                    "Link this task to specific acceptance criteria IDs".to_string(),
                    format!("Available AC IDs: {}", valid_ac_ids.join(", ")),
                ];
                suggestions
                    .push("Identify which acceptance criteria this task addresses".to_string());
                suggestions
            };

            recommendations.push(Recommendation {
                gap_type: GapType::MissingAcceptanceCriteria,
                message: "Task is not linked to acceptance criteria".to_string(),
                specific_suggestions: ac_suggestions,
                ac_references: valid_ac_ids.to_vec(),
            });
            clarity_score -= 15;
        } else {
            // Validate that referenced ACs exist
            let invalid_refs: Vec<String> = task_info
                .acceptance_criteria_refs
                .iter()
                .filter(|ac_ref| !valid_ac_ids.contains(ac_ref))
                .cloned()
                .collect();

            if !invalid_refs.is_empty() {
                recommendations.push(Recommendation {
                    gap_type: GapType::MissingAcceptanceCriteria,
                    message: "Task references invalid acceptance criteria IDs".to_string(),
                    specific_suggestions: vec![
                        format!("Invalid AC references: {}", invalid_refs.join(", ")),
                        format!("Valid AC IDs: {}", valid_ac_ids.join(", ")),
                        "Update task to reference only valid acceptance criteria".to_string(),
                    ],
                    ac_references: valid_ac_ids.to_vec(),
                });
                clarity_score -= 10;
            }
        }

        // Check time estimate
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
            recommendations,
        }
    }

    fn check_technical_details(description: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        let desc_lower = description.to_lowercase();

        // Check for file paths
        if !desc_lower.contains("file")
            && !desc_lower.contains("path")
            && !desc_lower.contains(".rs")
            && !desc_lower.contains(".ts")
        {
            suggestions.push("Add specific file paths to modify".to_string());
        }

        // Check for functions/components
        if !desc_lower.contains("function")
            && !desc_lower.contains("component")
            && !desc_lower.contains("struct")
            && !desc_lower.contains("class")
        {
            suggestions.push("Specify functions or components to create or change".to_string());
        }

        // Check for inputs/outputs
        if !desc_lower.contains("input")
            && !desc_lower.contains("output")
            && !desc_lower.contains("return")
            && !desc_lower.contains("parameter")
        {
            suggestions.push("Define expected inputs and outputs".to_string());
        }

        // Check for technical approach
        if !desc_lower.contains("architecture")
            && !desc_lower.contains("approach")
            && !desc_lower.contains("design")
            && !desc_lower.contains("pattern")
        {
            suggestions.push("Describe technical approach or architecture decisions".to_string());
        }

        suggestions
    }

    fn check_vague_language(description: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        let desc_lower = description.to_lowercase();

        let vague_terms = [
            ("implement", "Specify what to implement and how"),
            ("create", "Detail what to create and its structure"),
            ("build", "Describe what to build with technical specifics"),
            ("add", "Clarify what to add and where"),
            ("fix", "Identify the specific issue and solution approach"),
            ("update", "Specify what to update and the expected changes"),
            (
                "improve",
                "Define concrete improvements with measurable outcomes",
            ),
            ("enhance", "List specific enhancements and success criteria"),
        ];

        for (term, suggestion) in vague_terms.iter() {
            if desc_lower.contains(term) {
                suggestions.push(format!("Found vague term '{}': {}", term, suggestion));
            }
        }

        if !suggestions.is_empty() {
            suggestions.insert(
                0,
                "Replace vague terms with concrete, measurable actions".to_string(),
            );
        }

        suggestions
    }

    fn check_ai_compatibility(description: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        let desc_lower = description.to_lowercase();

        // Check for success criteria
        if !desc_lower.contains("success")
            && !desc_lower.contains("complete")
            && !desc_lower.contains("done")
        {
            suggestions.push("Define clear success criteria".to_string());
        }

        // Check for dependencies
        if !desc_lower.contains("depend")
            && !desc_lower.contains("require")
            && !desc_lower.contains("prerequisite")
        {
            suggestions.push("List explicit dependencies or prerequisites".to_string());
        }

        // Check for environment setup
        if !desc_lower.contains("environment")
            && !desc_lower.contains("setup")
            && !desc_lower.contains("configuration")
        {
            suggestions.push("Describe required environment setup or configuration".to_string());
        }

        // Check for test coverage expectations
        if !desc_lower.contains("test") && !desc_lower.contains("coverage") {
            suggestions.push("Specify expected test coverage and types".to_string());
        }

        // Check for definition of done
        if !desc_lower.contains("definition of done") && !desc_lower.contains("completion criteria")
        {
            suggestions.push("Include definition of done with concrete checkpoints".to_string());
        }

        suggestions
    }
}
