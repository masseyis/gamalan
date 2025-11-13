use crate::application::ports::{
    AcceptanceCriteriaRepository, LlmService, ReadinessEvaluationRepository, StoryService,
    TaskAnalysisRepository,
};
use crate::domain::{
    AcceptanceCriterion, ReadinessCheck, ReadinessEvaluation, TaskAnalysis, TaskAnalyzer,
};
use chrono::{DateTime, Utc};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct ReadinessUsecases {
    criteria_repo: Arc<dyn AcceptanceCriteriaRepository>,
    readiness_repo: Arc<dyn ReadinessEvaluationRepository>,
    task_analysis_repo: Arc<dyn TaskAnalysisRepository>,
    story_service: Arc<dyn StoryService>,
    llm_service: Arc<dyn LlmService>,
}

#[derive(Debug, Clone)]
pub struct TaskEnrichmentSuggestion {
    pub task_id: Uuid,
    pub story_id: Uuid,
    pub suggested_title: Option<String>,
    pub suggested_description: String,
    pub suggested_ac_refs: Vec<String>,
    pub confidence: f32,
    pub reasoning: String,
    pub generated_at: DateTime<Utc>,
    pub original_description: Option<String>,
}

impl ReadinessUsecases {
    pub fn new(
        criteria_repo: Arc<dyn AcceptanceCriteriaRepository>,
        readiness_repo: Arc<dyn ReadinessEvaluationRepository>,
        task_analysis_repo: Arc<dyn TaskAnalysisRepository>,
        story_service: Arc<dyn StoryService>,
        llm_service: Arc<dyn LlmService>,
    ) -> Self {
        Self {
            criteria_repo,
            readiness_repo,
            task_analysis_repo,
            story_service,
            llm_service,
        }
    }

    pub async fn generate_acceptance_criteria(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        let story_info = self
            .story_service
            .get_story_info(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story {} not found", story_id)))?;

        let generated_criteria = self
            .llm_service
            .generate_acceptance_criteria(&story_info)
            .await?;

        // Save generated criteria
        self.criteria_repo
            .create_criteria(&generated_criteria)
            .await?;

        Ok(generated_criteria)
    }

    pub async fn get_criteria_for_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        self.criteria_repo
            .get_criteria_by_story(story_id, organization_id)
            .await
    }

    pub async fn evaluate_story_readiness(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<ReadinessEvaluation, AppError> {
        let mut missing_items = Vec::new();
        let mut recommendations = Vec::new();
        let mut score = 100;

        let story_info = self
            .story_service
            .get_story_info(story_id, organization_id)
            .await?;

        if let Some(info) = story_info.as_ref() {
            let title = info.title.trim();
            if title.len() < 12 {
                missing_items.push("Story title is too short to convey user value".to_string());
                score -= 10;
                recommendations.push(
                    "Rewrite the story title to capture the user, action, and benefit".to_string(),
                );
            } else {
                let lower_title = title.to_lowercase();
                let persona_pattern = lower_title.starts_with("as a ")
                    || lower_title.starts_with("as an ")
                    || lower_title.contains(" as a ")
                    || lower_title.contains(" as an ");
                if !persona_pattern {
                    missing_items.push(
                        "Story title does not describe a user persona, desired action, and outcome"
                            .to_string(),
                    );
                    score -= 15;
                    recommendations.push(
                        "Reframe the title like 'As a <persona>, I want <action> so that <outcome>' to emphasise user value"
                            .to_string(),
                    );
                }
            }

            match info.description.as_ref().map(|d| d.trim()) {
                Some(desc) if desc.len() < 60 => {
                    missing_items
                        .push("Story description is too brief to guide implementation".to_string());
                    score -= 10;
                    recommendations.push(
                        "Expand the description with context, constraints, or personas".to_string(),
                    );
                }
                None => {
                    missing_items.push("Story description is missing".to_string());
                    score -= 10;
                    recommendations.push(
                        "Provide a concise description that explains the need and desired outcome"
                            .to_string(),
                    );
                }
                _ => {}
            }

            match info.story_points {
                None => {
                    missing_items.push("Story points are not set".to_string());
                    score -= 15;
                    recommendations.push(
                        "Estimate the story (1-8 points) to support sprint planning".to_string(),
                    );
                }
                Some(points) => {
                    if points == 0 || points > 8 {
                        missing_items.push(format!(
                            "Story points ({}) are outside the agreed range (1-8)",
                            points
                        ));
                        score -= 10;
                        recommendations.push(
                            "Re-estimate the story so it fits within a single sprint".to_string(),
                        );
                    } else if points >= 8 {
                        recommendations.push(
                            "Consider splitting large stories (>5 points) to reduce risk"
                                .to_string(),
                        );
                    }
                }
            }
        } else {
            missing_items.push("Story details could not be retrieved".to_string());
            score -= 50;
            recommendations.push(
                "Verify the story exists and that you have access to it before re-running readiness"
                    .to_string(),
            );
        }

        // Check 1: Story must have acceptance criteria
        let criteria = self
            .criteria_repo
            .get_criteria_by_story(story_id, organization_id)
            .await?;
        if criteria.is_empty() {
            missing_items.push(ReadinessCheck::AcceptanceCriteria.description().to_string());
            score -= 25;
            recommendations.push(
                "Add at least three acceptance criteria that capture Given/When/Then".to_string(),
            );
        } else if criteria.len() < 3 {
            missing_items.push(format!(
                "Story only has {} acceptance criteria; aim for at least 3",
                criteria.len()
            ));
            score -= 15;
            recommendations.push(
                "Work with the product owner to define additional acceptance criteria".to_string(),
            );
        }

        for criterion in &criteria {
            let combined_length =
                criterion.given.len() + criterion.when.len() + criterion.then.len();
            if combined_length < 60 {
                missing_items.push(format!(
                    "Acceptance criterion '{}' looks too vague—expand the Given/When/Then details",
                    criterion.ac_id
                ));
                score -= 5;
                recommendations.push("Ensure each acceptance criterion captures context, trigger, and expected outcome".to_string());
            }
        }

        if !criteria.is_empty() {
            let doc_subject_keywords = [
                "documentation",
                "docs",
                "wiki",
                "confluence",
                "notion",
                "handbook",
                "runbook",
                "knowledge base",
                "guide",
                "manual",
                "playbook",
                "readme",
                "faq",
                "sop",
                "spec document",
                "spec doc",
                "internal doc",
                "release notes",
                "meeting notes",
            ];
            let behaviour_keywords = [
                "user",
                "system",
                "api",
                "request",
                "response",
                "ui",
                "button",
                "click",
                "screen",
                "page",
                "endpoint",
                "service",
                "email",
                "notification",
                "modal",
                "field",
                "form",
                "validation",
                "error",
                "success",
                "display",
                "render",
                "backend",
                "database",
            ];

            let doc_like = criteria
                .iter()
                .filter(|criterion| {
                    // Only mark ACs as doc-like when they explicitly reference documentation artefacts
                    // and lack common indicators of observable system behaviour.
                    let text = format!(
                        "{} {} {}",
                        criterion.given.to_lowercase(),
                        criterion.when.to_lowercase(),
                        criterion.then.to_lowercase()
                    );
                    let mentions_doc_subject =
                        doc_subject_keywords.iter().any(|kw| text.contains(kw));
                    let mentions_behaviour = behaviour_keywords.iter().any(|kw| text.contains(kw));
                    mentions_doc_subject && !mentions_behaviour
                })
                .count();

            if doc_like == criteria.len() {
                missing_items.push(
                    "Acceptance criteria focus on internal documentation rather than observable system behaviour"
                        .to_string(),
                );
                score -= 15;
                recommendations.push(
                    "Rewrite the acceptance criteria to describe measurable product outcomes"
                        .to_string(),
                );
            } else if doc_like > 0 && doc_like * 2 >= criteria.len() {
                recommendations.push(
                    "Several acceptance criteria read like internal tasks; consider reframing them in terms of system behaviour"
                        .to_string(),
                );
            }
        }

        // Check 2: All acceptance criteria must be covered by tasks
        if !criteria.is_empty() {
            let tasks = self
                .story_service
                .get_tasks_for_story(story_id, organization_id)
                .await?;
            let covered_ac_ids: std::collections::HashSet<String> = tasks
                .iter()
                .flat_map(|t| &t.acceptance_criteria_refs)
                .cloned()
                .collect();

            let story_ac_ids: std::collections::HashSet<String> =
                criteria.iter().map(|c| c.ac_id.clone()).collect();

            let uncovered: Vec<String> = story_ac_ids
                .difference(&covered_ac_ids)
                .filter_map(|ac_id| {
                    criteria
                        .iter()
                        .find(|criterion| &criterion.ac_id == ac_id)
                        .map(|criterion| {
                            let display = format_gwt_summary(
                                &criterion.given,
                                &criterion.when,
                                &criterion.then,
                            );
                            format!(
                                "Acceptance criterion \"{}\" is not covered by any task",
                                display
                            )
                        })
                })
                .collect();

            if !uncovered.is_empty() {
                missing_items.extend(uncovered);
                score -= 25;
                recommendations.push(
                    "Create tasks that explicitly reference each acceptance criterion".to_string(),
                );
            }
        }

        // Check 3: Story should have tasks
        let tasks = self
            .story_service
            .get_tasks_for_story(story_id, organization_id)
            .await?;
        if tasks.is_empty() {
            missing_items.push("Story has no implementation tasks".to_string());
            score -= 20;
            recommendations.push(
                "Break the story into contributor-sized tasks covering the acceptance criteria"
                    .to_string(),
            );
        } else if tasks.len() < criteria.len() {
            recommendations.push(
                "Consider adding tasks so every acceptance criterion has dedicated coverage"
                    .to_string(),
            );
        }

        // Soft heuristics: encourage test coverage and measurement tasks
        if !tasks.is_empty() {
            let has_test_task = tasks.iter().any(|task| {
                let haystack = task.title.to_lowercase();
                haystack.contains("test")
                    || haystack.contains("qa")
                    || haystack.contains("verification")
            });
            if !has_test_task {
                recommendations.push(
                    "Add a task covering automated or acceptance tests so criteria can be validated"
                        .to_string(),
                );
            }

            let has_measure_task = tasks.iter().any(|task| {
                let haystack = task.title.to_lowercase();
                haystack.contains("metric")
                    || haystack.contains("measure")
                    || haystack.contains("performance")
                    || haystack.contains("analytics")
            });
            if !has_measure_task {
                recommendations.push(
                    "Consider adding a task to capture before/after metrics or monitor impact"
                        .to_string(),
                );
            }
        }

        if !criteria.is_empty() {
            let has_measurable_ac = criteria.iter().any(|criterion| {
                let text = format!(
                    "{} {} {}",
                    criterion.given.to_lowercase(),
                    criterion.when.to_lowercase(),
                    criterion.then.to_lowercase()
                );
                text.chars().any(|c| c.is_ascii_digit())
                    || text.contains("seconds")
                    || text.contains("percent")
                    || text.contains("ms")
                    || text.contains("throughput")
            });
            if !has_measurable_ac {
                recommendations.push(
                    "Add a measurable outcome to at least one acceptance criterion (e.g., SLA, count, or percentage)"
                        .to_string(),
                );
            }
        }

        score = score.clamp(0, 100);

        let summary = if missing_items.is_empty() {
            "Story meets the readiness bar and can be scheduled for a sprint.".to_string()
        } else {
            format!(
                "Story is not ready yet. Address the following {} item(s) to improve readiness.",
                missing_items.len()
            )
        };

        if missing_items.is_empty() && recommendations.is_empty() {
            recommendations
                .push("Verify dependencies and add the story to the upcoming sprint.".to_string());
        }

        let evaluation = ReadinessEvaluation::new(
            story_id,
            organization_id,
            score,
            missing_items,
            summary,
            recommendations,
        );
        self.readiness_repo.save_evaluation(&evaluation).await?;

        Ok(evaluation)
    }

    pub async fn add_acceptance_criteria(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        criteria: Vec<(String, String, String, String)>, // (ac_id, given, when, then)
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        let mut new_criteria = Vec::new();

        for (ac_id, given, when, then) in criteria {
            let criterion =
                AcceptanceCriterion::new(story_id, organization_id, ac_id, given, when, then)?;
            new_criteria.push(criterion);
        }

        self.criteria_repo.create_criteria(&new_criteria).await?;
        Ok(new_criteria)
    }

    #[allow(dead_code)]
    pub async fn validate_acceptance_criteria_refs(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        ac_refs: &[String],
    ) -> Result<Vec<String>, AppError> {
        let criteria = self
            .criteria_repo
            .get_criteria_by_story(story_id, organization_id)
            .await?;
        let valid_ac_ids: std::collections::HashSet<String> =
            criteria.into_iter().map(|c| c.ac_id).collect();

        let invalid_refs = ac_refs
            .iter()
            .filter(|ac_ref| !valid_ac_ids.contains(*ac_ref))
            .cloned()
            .collect();

        Ok(invalid_refs)
    }

    /// Analyze a task for readiness and generate recommendations
    pub async fn analyze_task(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<TaskAnalysis, AppError> {
        let task_info = self
            .story_service
            .get_task_info(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Task {} not found", task_id)))?;

        let criteria = self
            .criteria_repo
            .get_criteria_by_story(task_info.story_id, organization_id)
            .await?;

        let valid_ac_ids: Vec<String> = criteria.iter().map(|c| c.ac_id.clone()).collect();

        let previous_analysis = self
            .task_analysis_repo
            .get_latest_analysis(task_id, organization_id)
            .await?;

        let mut analysis =
            TaskAnalyzer::analyze(&task_info, &valid_ac_ids, previous_analysis.as_ref());
        analysis.organization_id = organization_id;

        // Save the analysis
        self.task_analysis_repo.save_analysis(&analysis).await?;

        Ok(analysis)
    }

    /// Get task analysis by task ID
    pub async fn get_task_analysis(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskAnalysis>, AppError> {
        self.task_analysis_repo
            .get_latest_analysis(task_id, organization_id)
            .await
    }

    pub async fn enrich_task(
        &self,
        task_id: Uuid,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        include_story_context: bool,
        include_related_tasks: bool,
        include_codebase_context: bool,
    ) -> Result<TaskEnrichmentSuggestion, AppError> {
        let task_info = self
            .story_service
            .get_task_info(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Task {} not found", task_id)))?;

        let story = self
            .story_service
            .get_story_info(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story {} not found", story_id)))?;

        let criteria = self
            .criteria_repo
            .get_criteria_by_story(story_id, organization_id)
            .await?;
        let ac_ids: Vec<String> = criteria.iter().map(|c| c.ac_id.clone()).collect();

        let related_tasks = if include_related_tasks {
            self.story_service
                .get_tasks_for_story(story_id, organization_id)
                .await
                .unwrap_or_default()
        } else {
            Vec::new()
        };

        let mut sections = Vec::new();
        if include_story_context {
            let story_description = story
                .description
                .clone()
                .unwrap_or_else(|| "Story description is pending.".to_string());
            sections.push(format!(
                "Story Context: {} — {}",
                story.title, story_description
            ));
        }

        let ac_summary = if ac_ids.is_empty() {
            "No acceptance criteria linked yet; recommend adding AC coverage.".to_string()
        } else {
            format!("Key Acceptance Criteria: {}", ac_ids.join(", "))
        };

        sections.push(format!(
            "Task Goal: {}\nClarify deliverables and ensure linkage to story intent. {}",
            task_info.title, ac_summary
        ));

        if include_codebase_context {
            sections.push(
                "Codebase Guidance: Update services/readiness/src/domain/task_analyzer.rs and related adapters to capture new recommendations.".to_string(),
            );
        }

        if include_related_tasks {
            let neighbors: Vec<String> = related_tasks
                .into_iter()
                .filter(|t| t.id != task_id)
                .take(3)
                .map(|t| format!("- {}", t.title))
                .collect();
            if !neighbors.is_empty() {
                sections.push(format!("Related Tasks:\n{}", neighbors.join("\n")));
            }
        }

        let suggested_description = sections.join("\n\n");

        let key_ac = ac_ids
            .first()
            .cloned()
            .unwrap_or_else(|| "AC-REFERENCE".to_string());

        let mut reasoning_parts = vec![format!(
            "Grounded in story '{}' and acceptance criteria such as {} to maintain readiness coverage.",
            story.title, key_ac
        )];
        if include_story_context {
            reasoning_parts.push("Story context included for narrative continuity.".to_string());
        }
        if include_codebase_context {
            reasoning_parts.push(
                "Suggested touchpoints follow the project's hexagonal architecture layout."
                    .to_string(),
            );
        }
        if include_related_tasks {
            reasoning_parts.push("Related tasks considered to avoid duplicate work.".to_string());
        }

        let reasoning = reasoning_parts.join(" ");

        Ok(TaskEnrichmentSuggestion {
            task_id,
            story_id,
            suggested_title: Some(format!("{} (clarified)", task_info.title)),
            suggested_description,
            suggested_ac_refs: ac_ids,
            confidence: 0.82,
            reasoning,
            generated_at: Utc::now(),
            original_description: task_info.description,
        })
    }
}

fn format_gwt_summary(given: &str, when_clause: &str, then_clause: &str) -> String {
    let given = given.trim();
    let when_clause = when_clause.trim();
    let then_clause = then_clause.trim();

    let summary = format!(
        "Given {}, when {}, then {}",
        if given.is_empty() {
            "<unspecified context>"
        } else {
            given
        },
        if when_clause.is_empty() {
            "<unspecified trigger>"
        } else {
            when_clause
        },
        if then_clause.is_empty() {
            "<unspecified outcome>"
        } else {
            then_clause
        }
    );

    const MAX_LEN: usize = 140;
    if summary.chars().count() <= MAX_LEN {
        summary
    } else {
        let mut truncated = String::with_capacity(MAX_LEN + 1);
        for (idx, ch) in summary.chars().enumerate() {
            if idx + 1 >= MAX_LEN {
                break;
            }
            truncated.push(ch);
        }
        truncated.push('…');
        truncated
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockAcceptanceCriteriaRepository {
        criteria: Mutex<HashMap<Uuid, Vec<AcceptanceCriterion>>>,
    }

    #[async_trait]
    impl AcceptanceCriteriaRepository for MockAcceptanceCriteriaRepository {
        async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError> {
            let mut map = self.criteria.lock().unwrap();
            for criterion in criteria {
                map.entry(criterion.story_id)
                    .or_default()
                    .push(criterion.clone());
            }
            Ok(())
        }

        async fn get_criteria_by_story(
            &self,
            story_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Vec<AcceptanceCriterion>, AppError> {
            let map = self.criteria.lock().unwrap();
            Ok(map.get(&story_id).cloned().unwrap_or_default())
        }

        async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError> {
            let mut map = self.criteria.lock().unwrap();
            if let Some(criteria) = map.get_mut(&criterion.story_id) {
                if let Some(pos) = criteria.iter().position(|c| c.id == criterion.id) {
                    criteria[pos] = criterion.clone();
                }
            }
            Ok(())
        }

        async fn delete_criteria_by_story(
            &self,
            story_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<(), AppError> {
            let mut map = self.criteria.lock().unwrap();
            map.remove(&story_id);
            Ok(())
        }

        async fn get_criterion_by_story_and_ac_id(
            &self,
            story_id: Uuid,
            _organization_id: Option<Uuid>,
            ac_id: &str,
        ) -> Result<Option<AcceptanceCriterion>, AppError> {
            let map = self.criteria.lock().unwrap();
            if let Some(criteria) = map.get(&story_id) {
                Ok(criteria.iter().find(|c| c.ac_id == ac_id).cloned())
            } else {
                Ok(None)
            }
        }
    }

    #[derive(Default)]
    struct MockReadinessEvaluationRepository;

    #[async_trait]
    impl ReadinessEvaluationRepository for MockReadinessEvaluationRepository {
        async fn save_evaluation(&self, _eval: &ReadinessEvaluation) -> Result<(), AppError> {
            Ok(())
        }

        async fn get_latest_evaluation(
            &self,
            _story_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Option<ReadinessEvaluation>, AppError> {
            Ok(None)
        }
    }

    #[derive(Default)]
    struct MockTaskAnalysisRepository;

    #[async_trait]
    impl TaskAnalysisRepository for MockTaskAnalysisRepository {
        async fn save_analysis(&self, _analysis: &TaskAnalysis) -> Result<(), AppError> {
            Ok(())
        }

        async fn get_latest_analysis(
            &self,
            _task_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Option<TaskAnalysis>, AppError> {
            Ok(None)
        }
    }

    struct MockStoryService;

    #[async_trait]
    impl StoryService for MockStoryService {
        async fn get_story_info(
            &self,
            story_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Option<crate::application::ports::StoryInfo>, AppError> {
            Ok(Some(crate::application::ports::StoryInfo {
                id: story_id,
                title: "Test Story".to_string(),
                description: Some("Test description".to_string()),
                story_points: Some(5),
            }))
        }

        async fn get_tasks_for_story(
            &self,
            _story_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Vec<crate::application::ports::TaskInfo>, AppError> {
            Ok(vec![crate::application::ports::TaskInfo {
                id: Uuid::new_v4(),
                story_id: _story_id,
                title: "Test Task".to_string(),
                description: Some("Test task description".to_string()),
                acceptance_criteria_refs: vec!["AC1".to_string()],
                estimated_hours: Some(3),
            }])
        }

        async fn get_task_info(
            &self,
            task_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Option<crate::application::ports::TaskInfo>, AppError> {
            Ok(Some(crate::application::ports::TaskInfo {
                id: task_id,
                story_id: Uuid::new_v4(),
                title: "Test Task".to_string(),
                description: Some("Test task description".to_string()),
                acceptance_criteria_refs: vec!["AC1".to_string()],
                estimated_hours: Some(3),
            }))
        }
    }

    struct MockLlmService;

    #[async_trait]
    impl LlmService for MockLlmService {
        async fn generate_acceptance_criteria(
            &self,
            story_info: &crate::application::ports::StoryInfo,
        ) -> Result<Vec<AcceptanceCriterion>, AppError> {
            Ok(vec![AcceptanceCriterion::new(
                story_info.id,
                None,
                "AC1".to_string(),
                "user is authenticated".to_string(),
                "user performs action".to_string(),
                "system responds correctly".to_string(),
            )?])
        }

        async fn analyze_task(
            &self,
            task_info: &crate::application::ports::TaskInfo,
            _ac_refs: &[AcceptanceCriterion],
        ) -> Result<crate::domain::TaskClarityAnalysis, AppError> {
            // Simple mock for tests
            Ok(crate::domain::TaskClarityAnalysis::new(
                task_info.id,
                75,
                vec![],
                vec![],
                vec![],
            ))
        }

        async fn suggest_tasks(
            &self,
            _story_info: &crate::application::ports::StoryInfo,
            _github_context: &str,
            _existing_tasks: &[crate::application::ports::TaskInfo],
        ) -> Result<Vec<crate::domain::TaskSuggestion>, AppError> {
            // Simple mock for tests
            Ok(vec![])
        }
    }

    fn setup_usecases() -> ReadinessUsecases {
        let criteria_repo = Arc::new(MockAcceptanceCriteriaRepository::default());
        let readiness_repo = Arc::new(MockReadinessEvaluationRepository);
        let task_analysis_repo = Arc::new(MockTaskAnalysisRepository);
        let story_service = Arc::new(MockStoryService);
        let llm_service = Arc::new(MockLlmService);

        ReadinessUsecases::new(
            criteria_repo,
            readiness_repo,
            task_analysis_repo,
            story_service,
            llm_service,
        )
    }

    #[tokio::test]
    async fn test_generate_acceptance_criteria() {
        let usecases = setup_usecases();
        let story_id = Uuid::new_v4();

        let result = usecases.generate_acceptance_criteria(story_id, None).await;
        assert!(result.is_ok());

        let criteria = result.unwrap();
        assert_eq!(criteria.len(), 1);
        assert_eq!(criteria[0].ac_id, "AC1");
    }

    #[tokio::test]
    async fn test_evaluate_story_readiness_with_coverage() {
        let usecases = setup_usecases();
        let story_id = Uuid::new_v4();

        // First add some criteria
        let _ = usecases
            .add_acceptance_criteria(
                story_id,
                None,
                vec![(
                    "AC1".to_string(),
                    "given".to_string(),
                    "when".to_string(),
                    "then".to_string(),
                )],
            )
            .await
            .unwrap();

        let evaluation = usecases
            .evaluate_story_readiness(story_id, None)
            .await
            .unwrap();
        assert!(evaluation.score >= 0);
        assert!(!evaluation.summary.is_empty());
    }

    #[tokio::test]
    async fn test_validate_acceptance_criteria_refs() {
        let usecases = setup_usecases();
        let story_id = Uuid::new_v4();

        // Add some criteria
        let _ = usecases
            .add_acceptance_criteria(
                story_id,
                None,
                vec![(
                    "AC1".to_string(),
                    "given".to_string(),
                    "when".to_string(),
                    "then".to_string(),
                )],
            )
            .await
            .unwrap();

        // Test valid refs
        let invalid = usecases
            .validate_acceptance_criteria_refs(story_id, None, &["AC1".to_string()])
            .await
            .unwrap();
        assert!(invalid.is_empty());

        // Test invalid refs
        let invalid = usecases
            .validate_acceptance_criteria_refs(
                story_id,
                None,
                &["AC1".to_string(), "INVALID".to_string()],
            )
            .await
            .unwrap();
        assert_eq!(invalid, vec!["INVALID"]);
    }

    #[tokio::test]
    async fn test_ac_id_format_consistency() {
        // Test that ac_id follows the expected format (AC1, AC2, AC3, etc.)
        let story_id = Uuid::new_v4();
        let usecases = setup_usecases();

        // Add multiple criteria to test the numbering
        let criteria_data = vec![
            (
                "AC1".to_string(),
                "given1".to_string(),
                "when1".to_string(),
                "then1".to_string(),
            ),
            (
                "AC2".to_string(),
                "given2".to_string(),
                "when2".to_string(),
                "then2".to_string(),
            ),
            (
                "AC3".to_string(),
                "given3".to_string(),
                "when3".to_string(),
                "then3".to_string(),
            ),
        ];

        let _ = usecases
            .add_acceptance_criteria(story_id, None, criteria_data)
            .await
            .unwrap();

        let criteria = usecases
            .get_criteria_for_story(story_id, None)
            .await
            .unwrap();

        assert_eq!(criteria.len(), 3);
        assert_eq!(criteria[0].ac_id, "AC1");
        assert_eq!(criteria[1].ac_id, "AC2");
        assert_eq!(criteria[2].ac_id, "AC3");
    }
}
