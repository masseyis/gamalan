//! Unit tests for GitHub client
//!
//! AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity score)
//! AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)

use readiness::adapters::integrations::MockGitHubService;
use readiness::application::ports::GitHubService;
use readiness::domain::{FileNode, SearchResult};
use uuid::Uuid;

#[tokio::test]
async fn test_get_repo_structure_returns_file_tree() {
    // Arrange
    let service = MockGitHubService::new();
    let project_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();

    // Act
    let result = service
        .get_repo_structure(project_id, organization_id)
        .await;

    // Assert
    assert!(result.is_ok());
    let file_tree = result.unwrap();
    assert!(!file_tree.is_empty(), "File tree should not be empty");

    // Verify structure has expected patterns
    let has_services = file_tree.iter().any(|node| node.path.contains("services"));
    assert!(has_services, "File tree should contain services directory");
}

#[tokio::test]
async fn test_get_repo_structure_filters_out_generated_files() {
    // Arrange
    let service = MockGitHubService::new();
    let project_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();

    // Act
    let result = service
        .get_repo_structure(project_id, organization_id)
        .await;

    // Assert
    assert!(result.is_ok());
    let file_tree = result.unwrap();

    // Should not include common generated/ignored patterns
    for node in &file_tree {
        assert!(
            !node.path.contains("node_modules"),
            "Should filter out node_modules"
        );
        assert!(!node.path.contains("target"), "Should filter out target");
        assert!(!node.path.contains(".git"), "Should filter out .git");
    }
}

#[tokio::test]
async fn test_search_code_finds_relevant_files() {
    // Arrange
    let service = MockGitHubService::new();
    let project_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let query = "TaskAnalysis";

    // Act
    let result = service
        .search_code(project_id, organization_id, query)
        .await;

    // Assert
    assert!(result.is_ok());
    let search_results = result.unwrap();
    assert!(
        !search_results.is_empty(),
        "Search should return results for TaskAnalysis"
    );

    // Verify search results have required fields
    for result in &search_results {
        assert!(!result.path.is_empty(), "Path should not be empty");
        assert!(!result.content.is_empty(), "Content should not be empty");
    }
}

#[tokio::test]
async fn test_search_code_handles_no_results() {
    // Arrange
    let service = MockGitHubService::new();
    let project_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let query = "NonExistentSymbolThatWillNeverMatch12345";

    // Act
    let result = service
        .search_code(project_id, organization_id, query)
        .await;

    // Assert
    assert!(result.is_ok());
    let search_results = result.unwrap();
    assert!(
        search_results.is_empty(),
        "Search should return empty results for non-existent query"
    );
}

#[tokio::test]
async fn test_file_node_structure() {
    // Test the FileNode domain model
    let node = FileNode {
        path: "services/readiness/src/lib.rs".to_string(),
        node_type: "file".to_string(),
        size: Some(1024),
    };

    assert_eq!(node.path, "services/readiness/src/lib.rs");
    assert_eq!(node.node_type, "file");
    assert_eq!(node.size, Some(1024));
}

#[tokio::test]
async fn test_search_result_structure() {
    // Test the SearchResult domain model
    let result = SearchResult {
        path: "services/backlog/src/domain/task.rs".to_string(),
        content: "pub struct Task { ... }".to_string(),
        matches: vec![42, 108],
    };

    assert_eq!(result.path, "services/backlog/src/domain/task.rs");
    assert!(!result.content.is_empty());
    assert_eq!(result.matches.len(), 2);
}
