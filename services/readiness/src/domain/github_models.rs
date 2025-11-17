//! GitHub integration domain models
//!
//! AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration for code context)

use serde::{Deserialize, Serialize};

/// Represents a file or directory node in the repository structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    /// Path to the file/directory (e.g., "services/readiness/src/lib.rs")
    pub path: String,
    /// Type of node: "file" or "directory"
    pub node_type: String,
    /// Size in bytes (for files)
    pub size: Option<usize>,
}

impl FileNode {
    pub fn new(path: String, node_type: String, size: Option<usize>) -> Self {
        Self {
            path,
            node_type,
            size,
        }
    }

    pub fn is_file(&self) -> bool {
        self.node_type == "file"
    }

    pub fn is_directory(&self) -> bool {
        self.node_type == "directory" || self.node_type == "tree"
    }
}

/// Represents a search result from code search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// Path to the file containing the match
    pub path: String,
    /// Content snippet showing the match
    pub content: String,
    /// Line numbers where matches occur
    pub matches: Vec<usize>,
}

impl SearchResult {
    pub fn new(path: String, content: String, matches: Vec<usize>) -> Self {
        Self {
            path,
            content,
            matches,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_node_creation() {
        let node = FileNode::new(
            "services/readiness/src/lib.rs".to_string(),
            "file".to_string(),
            Some(1024),
        );

        assert_eq!(node.path, "services/readiness/src/lib.rs");
        assert!(node.is_file());
        assert!(!node.is_directory());
        assert_eq!(node.size, Some(1024));
    }

    #[test]
    fn test_directory_node_creation() {
        let node = FileNode::new("services".to_string(), "directory".to_string(), None);

        assert_eq!(node.path, "services");
        assert!(!node.is_file());
        assert!(node.is_directory());
        assert_eq!(node.size, None);
    }

    #[test]
    fn test_search_result_creation() {
        let result = SearchResult::new(
            "services/backlog/src/domain/task.rs".to_string(),
            "pub struct Task { ... }".to_string(),
            vec![42, 108],
        );

        assert_eq!(result.path, "services/backlog/src/domain/task.rs");
        assert_eq!(result.content, "pub struct Task { ... }");
        assert_eq!(result.matches, vec![42, 108]);
    }
}
