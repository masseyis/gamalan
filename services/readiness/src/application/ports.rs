use crate::domain::{
    AcceptanceCriterion, FileNode, ReadinessEvaluation, SearchResult, TaskAnalysis,
    TaskClarityAnalysis, TaskSuggestion,
};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait AcceptanceCriteriaRepository: Send + Sync {
    async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError>;
    async fn get_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;
    #[allow(dead_code)]
    async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn delete_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_criterion_by_story_and_ac_id(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        ac_id: &str,
    ) -> Result<Option<AcceptanceCriterion>, AppError>;
}

#[async_trait]
pub trait ReadinessEvaluationRepository: Send + Sync {
    async fn save_evaluation(&self, eval: &ReadinessEvaluation) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_latest_evaluation(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ReadinessEvaluation>, AppError>;
}

#[async_trait]
pub trait StoryService: Send + Sync {
    async fn get_story_info(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<StoryInfo>, AppError>;
    async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<TaskInfo>, AppError>;
    async fn get_task_info(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskInfo>, AppError>;
}

#[derive(Debug, Clone)]
pub struct StoryInfo {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub story_points: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct TaskInfo {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<u32>,
}

#[async_trait]
pub trait LlmService: Send + Sync {
    async fn generate_acceptance_criteria(
        &self,
        story_info: &StoryInfo,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;

    /// Analyze a task for clarity and provide recommendations
    ///
    /// AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
    async fn analyze_task(
        &self,
        task_info: &TaskInfo,
        ac_refs: &[AcceptanceCriterion],
    ) -> Result<TaskClarityAnalysis, AppError>;

    /// Generate task suggestions for a story with GitHub context
    ///
    /// AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
    /// AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)
    async fn suggest_tasks(
        &self,
        story_info: &StoryInfo,
        github_context: &str,
        existing_tasks: &[TaskInfo],
    ) -> Result<Vec<TaskSuggestion>, AppError>;
}

#[async_trait]
pub trait TaskAnalysisRepository: Send + Sync {
    async fn save_analysis(&self, analysis: &TaskAnalysis) -> Result<(), AppError>;
    async fn get_latest_analysis(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskAnalysis>, AppError>;
}

/// GitHub integration service for accessing repository structure and searching code
///
/// AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)
#[async_trait]
pub trait GitHubService: Send + Sync {
    /// Get the file tree structure for a project's repository
    ///
    /// Returns a flattened list of files and directories, excluding common
    /// generated/ignored patterns (node_modules, target, .git, etc.)
    async fn get_repo_structure(
        &self,
        project_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<FileNode>, AppError>;

    /// Search for code patterns within a project's repository
    ///
    /// Queries the GitHub API to find code matching the given search term.
    /// Returns snippets showing the matched code with line numbers.
    async fn search_code(
        &self,
        project_id: Uuid,
        organization_id: Uuid,
        query: &str,
    ) -> Result<Vec<SearchResult>, AppError>;
}
