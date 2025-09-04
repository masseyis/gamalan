use crate::application::ports::{
    AcceptanceCriterion, BacklogService, LlmService, PlanPackGeneration, PlanPackRepository,
    ReadinessService, StoryInfo, TaskInfo, TaskPackGeneration, TaskPackRepository,
};
use crate::domain::{
    AcceptanceCriteriaMap, AcceptanceCriterionCoverage, AcceptanceCriterionInfo, CommitPlan,
    DoNotList, PlanPack, ProposedTask, TaskConstraints, TaskPack, TestPlan,
};
use common::AppError;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

pub struct PromptBuilderUsecases {
    plan_pack_repo: Arc<dyn PlanPackRepository>,
    task_pack_repo: Arc<dyn TaskPackRepository>,
    backlog_service: Arc<dyn BacklogService>,
    readiness_service: Arc<dyn ReadinessService>,
    llm_service: Arc<dyn LlmService>,
}

impl PromptBuilderUsecases {
    pub fn new(
        plan_pack_repo: Arc<dyn PlanPackRepository>,
        task_pack_repo: Arc<dyn TaskPackRepository>,
        backlog_service: Arc<dyn BacklogService>,
        readiness_service: Arc<dyn ReadinessService>,
        llm_service: Arc<dyn LlmService>,
    ) -> Self {
        Self {
            plan_pack_repo,
            task_pack_repo,
            backlog_service,
            readiness_service,
            llm_service,
        }
    }

    pub async fn generate_plan_pack(&self, story_id: Uuid) -> Result<PlanPack, AppError> {
        // Check if Plan Pack already exists (idempotency)
        if let Some(existing) = self.plan_pack_repo.get_plan_pack_by_story(story_id).await? {
            return Ok(existing);
        }

        // Verify story readiness
        let readiness_eval = self.readiness_service.evaluate_readiness(story_id).await?;
        if !readiness_eval.missing_items.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Story is not ready for Plan Pack generation. Missing: {}",
                readiness_eval.missing_items.join(", ")
            )));
        }

        // Get story information
        let story = self
            .backlog_service
            .get_story_info(story_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story {} not found", story_id)))?;

        // Get acceptance criteria
        let criteria = self
            .readiness_service
            .get_acceptance_criteria(story_id)
            .await?;
        if criteria.is_empty() {
            return Err(AppError::BadRequest(
                "Story must have acceptance criteria before generating Plan Pack".to_string(),
            ));
        }

        // Generate Plan Pack using LLM
        let generation = self
            .llm_service
            .generate_plan_pack(&story, &criteria)
            .await?;

        // Build acceptance criteria map
        let mut criteria_map = HashMap::new();
        for ac in &criteria {
            criteria_map.insert(
                ac.ac_id.clone(),
                AcceptanceCriterionInfo {
                    ac_id: ac.ac_id.clone(),
                    given: ac.given.clone(),
                    when: ac.when.clone(),
                    then: ac.then.clone(),
                },
            );
        }

        let ac_map = AcceptanceCriteriaMap {
            criteria: criteria_map,
        };

        // Convert generated tasks to domain objects
        let proposed_tasks: Vec<ProposedTask> = generation
            .proposed_tasks
            .into_iter()
            .map(|t| ProposedTask {
                title: t.title,
                description: t.description,
                acceptance_criteria_refs: t.acceptance_criteria_refs,
                estimated_effort: t.estimated_effort,
                technical_notes: t.technical_notes,
            })
            .collect();

        // Create Plan Pack
        let plan_pack = PlanPack::new(
            story_id,
            ac_map,
            proposed_tasks,
            generation.architecture_impact,
            generation.risks,
            generation.unknowns,
        )?;

        // Save Plan Pack
        self.plan_pack_repo.save_plan_pack(&plan_pack).await?;

        Ok(plan_pack)
    }

    pub async fn get_plan_pack(&self, story_id: Uuid) -> Result<Option<PlanPack>, AppError> {
        self.plan_pack_repo.get_plan_pack_by_story(story_id).await
    }

    pub async fn generate_task_pack(&self, task_id: Uuid) -> Result<TaskPack, AppError> {
        // Check if Task Pack already exists (idempotency)
        if let Some(existing) = self.task_pack_repo.get_task_pack_by_task(task_id).await? {
            return Ok(existing);
        }

        // Get task information
        let task = self
            .backlog_service
            .get_task_info(task_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Task {} not found", task_id)))?;

        // Get story information
        let story = self
            .backlog_service
            .get_story_info(task.story_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story {} not found", task.story_id)))?;

        // Get acceptance criteria for the story
        let all_criteria = self
            .readiness_service
            .get_acceptance_criteria(task.story_id)
            .await?;

        // Filter criteria that this task covers
        let relevant_criteria: Vec<AcceptanceCriterion> = all_criteria
            .into_iter()
            .filter(|ac| task.acceptance_criteria_refs.contains(&ac.ac_id))
            .collect();

        if relevant_criteria.is_empty() {
            return Err(AppError::BadRequest(
                "Task must reference at least one acceptance criterion".to_string(),
            ));
        }

        // Get associated Plan Pack (if exists)
        let plan_pack_id = self
            .plan_pack_repo
            .get_plan_pack_by_story(task.story_id)
            .await?
            .map(|pp| pp.id);

        // Generate Task Pack using LLM
        let generation = self
            .llm_service
            .generate_task_pack(&task, &story, &relevant_criteria)
            .await?;

        // Build task constraints
        let constraints = TaskConstraints {
            file_paths: generation.file_paths,
            ports_to_implement: generation.ports_to_implement,
            dtos_to_create: generation.dtos_to_create,
            architecture_notes: generation.architecture_notes,
        };

        // Build test plan
        let test_plan = TestPlan {
            unit_tests: generation.unit_tests,
            integration_tests: generation.integration_tests,
            contract_tests: generation.contract_tests,
            coverage_threshold: generation.coverage_threshold,
        };

        // Build do-not list
        let do_not_list = DoNotList {
            forbidden_actions: generation.forbidden_actions,
            no_shortcuts: generation.no_shortcuts,
            required_practices: generation.required_practices,
        };

        // Build commit plan
        let commit_plan = CommitPlan {
            commit_message_template: generation.commit_message_template,
            pre_commit_checks: generation.pre_commit_checks,
            branch_naming_convention: None, // Could be added to generation
        };

        // Build acceptance criteria coverage
        let ac_coverage: Vec<AcceptanceCriterionCoverage> = relevant_criteria
            .iter()
            .map(|ac| AcceptanceCriterionCoverage {
                ac_id: ac.ac_id.clone(),
                given: ac.given.clone(),
                when: ac.when.clone(),
                then: ac.then.clone(),
                test_approach: "Generated test approach".to_string(), // Could be enhanced
            })
            .collect();

        // Create Task Pack
        let task_pack = TaskPack::new(
            task_id,
            plan_pack_id,
            generation.objectives,
            generation.non_goals,
            format!(
                "Story: {} - {}",
                story.title,
                story.description.unwrap_or_default()
            ),
            ac_coverage,
            constraints,
            test_plan,
            do_not_list,
            commit_plan,
            generation.run_instructions,
        )?
        .with_generated_content()?;

        // Save Task Pack
        self.task_pack_repo.save_task_pack(&task_pack).await?;

        Ok(task_pack)
    }

    pub async fn get_task_pack(&self, task_id: Uuid) -> Result<Option<TaskPack>, AppError> {
        self.task_pack_repo.get_task_pack_by_task(task_id).await
    }

    pub async fn regenerate_plan_pack(&self, story_id: Uuid) -> Result<PlanPack, AppError> {
        // Delete existing Plan Pack if it exists
        if let Some(existing) = self.plan_pack_repo.get_plan_pack_by_story(story_id).await? {
            self.plan_pack_repo.delete_plan_pack(existing.id).await?;
        }

        // Generate new Plan Pack
        self.generate_plan_pack(story_id).await
    }

    pub async fn regenerate_task_pack(&self, task_id: Uuid) -> Result<TaskPack, AppError> {
        // Delete existing Task Pack if it exists
        if let Some(existing) = self.task_pack_repo.get_task_pack_by_task(task_id).await? {
            self.task_pack_repo.delete_task_pack(existing.id).await?;
        }

        // Generate new Task Pack
        self.generate_task_pack(task_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockPlanPackRepository {
        plan_packs: Mutex<HashMap<Uuid, PlanPack>>,
        by_story: Mutex<HashMap<Uuid, Uuid>>,
    }

    #[async_trait]
    impl PlanPackRepository for MockPlanPackRepository {
        async fn save_plan_pack(&self, plan_pack: &PlanPack) -> Result<(), AppError> {
            let mut packs = self.plan_packs.lock().unwrap();
            let mut by_story = self.by_story.lock().unwrap();
            packs.insert(plan_pack.id, plan_pack.clone());
            by_story.insert(plan_pack.story_id, plan_pack.id);
            Ok(())
        }

        async fn get_plan_pack(&self, id: Uuid) -> Result<Option<PlanPack>, AppError> {
            let packs = self.plan_packs.lock().unwrap();
            Ok(packs.get(&id).cloned())
        }

        async fn get_plan_pack_by_story(
            &self,
            story_id: Uuid,
        ) -> Result<Option<PlanPack>, AppError> {
            let by_story = self.by_story.lock().unwrap();
            let packs = self.plan_packs.lock().unwrap();

            if let Some(pack_id) = by_story.get(&story_id) {
                Ok(packs.get(pack_id).cloned())
            } else {
                Ok(None)
            }
        }

        async fn delete_plan_pack(&self, id: Uuid) -> Result<(), AppError> {
            let mut packs = self.plan_packs.lock().unwrap();
            let mut by_story = self.by_story.lock().unwrap();

            if let Some(pack) = packs.remove(&id) {
                by_story.remove(&pack.story_id);
            }
            Ok(())
        }
    }

    #[derive(Default)]
    struct MockTaskPackRepository {
        task_packs: Mutex<HashMap<Uuid, TaskPack>>,
        by_task: Mutex<HashMap<Uuid, Uuid>>,
    }

    #[async_trait]
    impl TaskPackRepository for MockTaskPackRepository {
        async fn save_task_pack(&self, task_pack: &TaskPack) -> Result<(), AppError> {
            let mut packs = self.task_packs.lock().unwrap();
            let mut by_task = self.by_task.lock().unwrap();
            packs.insert(task_pack.id, task_pack.clone());
            by_task.insert(task_pack.task_id, task_pack.id);
            Ok(())
        }

        async fn get_task_pack(&self, id: Uuid) -> Result<Option<TaskPack>, AppError> {
            let packs = self.task_packs.lock().unwrap();
            Ok(packs.get(&id).cloned())
        }

        async fn get_task_pack_by_task(&self, task_id: Uuid) -> Result<Option<TaskPack>, AppError> {
            let by_task = self.by_task.lock().unwrap();
            let packs = self.task_packs.lock().unwrap();

            if let Some(pack_id) = by_task.get(&task_id) {
                Ok(packs.get(pack_id).cloned())
            } else {
                Ok(None)
            }
        }

        async fn delete_task_pack(&self, id: Uuid) -> Result<(), AppError> {
            let mut packs = self.task_packs.lock().unwrap();
            let mut by_task = self.by_task.lock().unwrap();

            if let Some(pack) = packs.remove(&id) {
                by_task.remove(&pack.task_id);
            }
            Ok(())
        }
    }

    struct MockBacklogService;

    #[async_trait]
    impl BacklogService for MockBacklogService {
        async fn get_story_info(
            &self,
            story_id: Uuid,
        ) -> Result<Option<crate::application::ports::StoryInfo>, AppError> {
            Ok(Some(crate::application::ports::StoryInfo {
                id: story_id,
                title: "Test Story".to_string(),
                description: Some("Test description".to_string()),
                status: "Ready".to_string(),
            }))
        }

        async fn get_task_info(
            &self,
            task_id: Uuid,
        ) -> Result<Option<crate::application::ports::TaskInfo>, AppError> {
            Ok(Some(crate::application::ports::TaskInfo {
                id: task_id,
                story_id: Uuid::new_v4(),
                title: "Test Task".to_string(),
                description: Some("Test task description".to_string()),
                acceptance_criteria_refs: vec!["AC1".to_string()],
            }))
        }
    }

    struct MockReadinessService;

    #[async_trait]
    impl ReadinessService for MockReadinessService {
        async fn get_acceptance_criteria(
            &self,
            _story_id: Uuid,
        ) -> Result<Vec<AcceptanceCriterion>, AppError> {
            Ok(vec![AcceptanceCriterion {
                ac_id: "AC1".to_string(),
                given: "user is authenticated".to_string(),
                when: "user performs action".to_string(),
                then: "system responds".to_string(),
            }])
        }

        async fn evaluate_readiness(
            &self,
            _story_id: Uuid,
        ) -> Result<crate::application::ports::ReadinessEvaluation, AppError> {
            Ok(crate::application::ports::ReadinessEvaluation {
                score: 85,
                missing_items: vec![],
            })
        }
    }

    struct MockLlmService;

    #[async_trait]
    impl LlmService for MockLlmService {
        async fn generate_plan_pack(
            &self,
            _story: &crate::application::ports::StoryInfo,
            _criteria: &[AcceptanceCriterion],
        ) -> Result<crate::application::ports::PlanPackGeneration, AppError> {
            Ok(crate::application::ports::PlanPackGeneration {
                proposed_tasks: vec![crate::application::ports::ProposedTaskGeneration {
                    title: "Implement feature".to_string(),
                    description: "Add the main functionality".to_string(),
                    acceptance_criteria_refs: vec!["AC1".to_string()],
                    estimated_effort: Some("Medium".to_string()),
                    technical_notes: None,
                }],
                architecture_impact: Some("Minimal impact".to_string()),
                risks: vec!["Low risk".to_string()],
                unknowns: vec![],
            })
        }

        async fn generate_task_pack(
            &self,
            _task: &crate::application::ports::TaskInfo,
            _story: &crate::application::ports::StoryInfo,
            _criteria: &[AcceptanceCriterion],
        ) -> Result<crate::application::ports::TaskPackGeneration, AppError> {
            Ok(crate::application::ports::TaskPackGeneration {
                objectives: "Complete the task".to_string(),
                non_goals: vec!["Don't break existing functionality".to_string()],
                file_paths: vec!["src/handlers.rs".to_string()],
                ports_to_implement: vec!["TaskRepository".to_string()],
                dtos_to_create: vec!["TaskRequest".to_string()],
                architecture_notes: "Follow hexagonal architecture".to_string(),
                unit_tests: vec!["Test task creation".to_string()],
                integration_tests: vec!["Test task API".to_string()],
                contract_tests: vec!["Test OpenAPI compliance".to_string()],
                coverage_threshold: Some(85),
                forbidden_actions: vec!["Skip tests".to_string()],
                no_shortcuts: vec!["Bypass validation".to_string()],
                required_practices: vec!["Write tests first".to_string()],
                commit_message_template: "feat: implement task functionality".to_string(),
                pre_commit_checks: vec!["cargo fmt".to_string(), "cargo test".to_string()],
                run_instructions: vec!["Run cargo test".to_string()],
            })
        }
    }

    fn setup_usecases() -> PromptBuilderUsecases {
        let plan_pack_repo = Arc::new(MockPlanPackRepository::default());
        let task_pack_repo = Arc::new(MockTaskPackRepository::default());
        let backlog_service = Arc::new(MockBacklogService);
        let readiness_service = Arc::new(MockReadinessService);
        let llm_service = Arc::new(MockLlmService);

        PromptBuilderUsecases::new(
            plan_pack_repo,
            task_pack_repo,
            backlog_service,
            readiness_service,
            llm_service,
        )
    }

    #[tokio::test]
    async fn test_generate_plan_pack() {
        let usecases = setup_usecases();
        let story_id = Uuid::new_v4();

        let result = usecases.generate_plan_pack(story_id).await;
        assert!(result.is_ok());

        let plan_pack = result.unwrap();
        assert_eq!(plan_pack.story_id, story_id);
        assert!(!plan_pack.proposed_tasks.is_empty());
    }

    #[tokio::test]
    async fn test_generate_task_pack() {
        let usecases = setup_usecases();
        let task_id = Uuid::new_v4();

        let result = usecases.generate_task_pack(task_id).await;
        assert!(result.is_ok());

        let task_pack = result.unwrap();
        assert_eq!(task_pack.task_id, task_id);
        assert!(!task_pack.markdown_content.is_empty());
    }

    #[tokio::test]
    async fn test_idempotency() {
        let usecases = setup_usecases();
        let story_id = Uuid::new_v4();

        // Generate first time
        let first = usecases.generate_plan_pack(story_id).await.unwrap();

        // Generate second time - should return same pack
        let second = usecases.generate_plan_pack(story_id).await.unwrap();

        assert_eq!(first.id, second.id);
    }
}
