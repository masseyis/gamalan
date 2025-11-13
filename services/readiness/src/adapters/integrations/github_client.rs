//! GitHub API client for repository structure and code search
//!
//! AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)

use crate::application::ports::GitHubService;
use crate::domain::{FileNode, SearchResult};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

/// Mock GitHub service for development and testing
///
/// Returns realistic mock data that represents typical repository structure
/// and code search results without making actual GitHub API calls.
pub struct MockGitHubService;

impl MockGitHubService {
    pub fn new() -> Self {
        Self
    }

    /// Generate mock file tree with typical monorepo structure
    fn generate_mock_file_tree() -> Vec<FileNode> {
        vec![
            FileNode::new("services".to_string(), "directory".to_string(), None),
            FileNode::new(
                "services/readiness".to_string(),
                "directory".to_string(),
                None,
            ),
            FileNode::new(
                "services/readiness/src".to_string(),
                "directory".to_string(),
                None,
            ),
            FileNode::new(
                "services/readiness/src/lib.rs".to_string(),
                "file".to_string(),
                Some(1024),
            ),
            FileNode::new(
                "services/readiness/src/domain".to_string(),
                "directory".to_string(),
                None,
            ),
            FileNode::new(
                "services/readiness/src/domain/task_analyzer.rs".to_string(),
                "file".to_string(),
                Some(2048),
            ),
            FileNode::new(
                "services/backlog".to_string(),
                "directory".to_string(),
                None,
            ),
            FileNode::new(
                "services/backlog/src".to_string(),
                "directory".to_string(),
                None,
            ),
            FileNode::new(
                "services/backlog/src/domain".to_string(),
                "directory".to_string(),
                None,
            ),
            FileNode::new(
                "services/backlog/src/domain/task.rs".to_string(),
                "file".to_string(),
                Some(3072),
            ),
            FileNode::new("libs".to_string(), "directory".to_string(), None),
            FileNode::new("libs/common".to_string(), "directory".to_string(), None),
            FileNode::new(
                "libs/common/src/lib.rs".to_string(),
                "file".to_string(),
                Some(512),
            ),
        ]
    }

    /// Generate mock search results
    fn generate_mock_search_results(query: &str) -> Vec<SearchResult> {
        // Return empty for non-existent queries
        if query.contains("NonExistent") || query.contains("12345") {
            return vec![];
        }

        // Return relevant results for common queries
        match query {
            "TaskAnalysis" => vec![
                SearchResult::new(
                    "services/readiness/src/domain/task_analyzer.rs".to_string(),
                    "pub struct TaskAnalysis {\n    pub id: Uuid,\n    pub task_id: Uuid,\n}"
                        .to_string(),
                    vec![10, 42],
                ),
                SearchResult::new(
                    "services/readiness/src/domain/task_analysis.rs".to_string(),
                    "impl TaskAnalysis {\n    pub fn new(task_id: Uuid) -> Self {\n        //...\n    }\n}".to_string(),
                    vec![5, 15],
                ),
            ],
            _ => vec![SearchResult::new(
                "services/backlog/src/domain/task.rs".to_string(),
                format!("// Code containing: {}\npub struct Task {{}}", query),
                vec![1],
            )],
        }
    }
}

impl Default for MockGitHubService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GitHubService for MockGitHubService {
    async fn get_repo_structure(
        &self,
        _project_id: Uuid,
        _organization_id: Uuid,
    ) -> Result<Vec<FileNode>, AppError> {
        Ok(Self::generate_mock_file_tree())
    }

    async fn search_code(
        &self,
        _project_id: Uuid,
        _organization_id: Uuid,
        query: &str,
    ) -> Result<Vec<SearchResult>, AppError> {
        Ok(Self::generate_mock_search_results(query))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_service_returns_file_tree() {
        let service = MockGitHubService::new();
        let project_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();

        let result = service.get_repo_structure(project_id, org_id).await;

        assert!(result.is_ok());
        let files = result.unwrap();
        assert!(!files.is_empty());
    }

    #[tokio::test]
    async fn test_mock_service_returns_search_results() {
        let service = MockGitHubService::new();
        let project_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();

        let result = service
            .search_code(project_id, org_id, "TaskAnalysis")
            .await;

        assert!(result.is_ok());
        let results = result.unwrap();
        assert!(!results.is_empty());
    }

    #[tokio::test]
    async fn test_mock_service_handles_no_results() {
        let service = MockGitHubService::new();
        let project_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();

        let result = service
            .search_code(project_id, org_id, "NonExistentSymbol12345")
            .await;

        assert!(result.is_ok());
        let results = result.unwrap();
        assert!(results.is_empty());
    }
}
