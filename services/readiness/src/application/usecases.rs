use crate::application::ports::{
    AcceptanceCriteriaRepository, LlmService, ReadinessEvaluationRepository, StoryService,
};
use crate::domain::{AcceptanceCriterion, ReadinessCheck, ReadinessEvaluation};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct ReadinessUsecases {
    criteria_repo: Arc<dyn AcceptanceCriteriaRepository>,
    readiness_repo: Arc<dyn ReadinessEvaluationRepository>,
    story_service: Arc<dyn StoryService>,
    llm_service: Arc<dyn LlmService>,
}

impl ReadinessUsecases {
    pub fn new(
        criteria_repo: Arc<dyn AcceptanceCriteriaRepository>,
        readiness_repo: Arc<dyn ReadinessEvaluationRepository>,
        story_service: Arc<dyn StoryService>,
        llm_service: Arc<dyn LlmService>,
    ) -> Self {
        Self {
            criteria_repo,
            readiness_repo,
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
            } else if !title.to_lowercase().contains(" as ") {
                recommendations.push("Consider framing the title as 'As a <persona>, I want <action> so that <outcome>'".to_string());
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
                .map(|s| format!("AC '{}' not covered by any task", s))
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
                acceptance_criteria_refs: vec!["AC1".to_string()],
            }])
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
    }

    fn setup_usecases() -> ReadinessUsecases {
        let criteria_repo = Arc::new(MockAcceptanceCriteriaRepository::default());
        let readiness_repo = Arc::new(MockReadinessEvaluationRepository);
        let story_service = Arc::new(MockStoryService);
        let llm_service = Arc::new(MockLlmService);

        ReadinessUsecases::new(criteria_repo, readiness_repo, story_service, llm_service)
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
}
