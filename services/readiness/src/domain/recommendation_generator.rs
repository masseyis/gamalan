use super::{GapType, Recommendation};

/// Enhanced recommendation generator that provides context-aware, specific suggestions
/// for improving task definitions based on identified gaps.
///
/// This module implements AC 81054dee - generating specific recommendations including:
/// - File paths to modify
/// - Specific function/component names
/// - AC ID suggestions
/// - Test coverage needs
pub struct RecommendationGenerator;

impl RecommendationGenerator {
    /// Generates context-aware file path suggestions based on task type
    pub fn suggest_file_paths(task_title: &str, task_description: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        let title_lower = task_title.to_lowercase();
        let desc_lower = task_description.to_lowercase();

        // Determine task category from title prefix or content
        if title_lower.contains("[backend]") || title_lower.contains("backend") {
            suggestions.extend(Self::suggest_backend_paths(&title_lower, &desc_lower));
        } else if title_lower.contains("[frontend]") || title_lower.contains("frontend") {
            suggestions.extend(Self::suggest_frontend_paths(&title_lower, &desc_lower));
        } else if title_lower.contains("[qa]") || title_lower.contains("test") {
            suggestions.extend(Self::suggest_test_paths(&title_lower, &desc_lower));
        } else if title_lower.contains("[devops]") || title_lower.contains("deployment") {
            suggestions.extend(Self::suggest_devops_paths(&title_lower, &desc_lower));
        } else {
            // Generic suggestions
            suggestions.push(
                "Specify file paths to modify (e.g., services/<service-name>/src/domain/...)"
                    .to_string(),
            );
        }

        suggestions
    }

    fn suggest_backend_paths(title: &str, description: &str) -> Vec<String> {
        let mut paths = Vec::new();

        // Suggest paths based on hexagonal architecture
        if title.contains("recommendation") || description.contains("recommendation") {
            paths.push(
                "Example: services/readiness/src/domain/recommendation_generator.rs".to_string(),
            );
            paths.push(
                "Consider: services/readiness/src/application/usecases.rs for use case logic"
                    .to_string(),
            );
        }

        if title.contains("analysis") || description.contains("analysis") {
            paths.push("Example: services/readiness/src/domain/task_analyzer.rs".to_string());
        }

        if title.contains("endpoint") || title.contains("api") || description.contains("endpoint") {
            paths.push(
                "Example: services/<service>/src/adapters/http/handlers.rs for HTTP endpoints"
                    .to_string(),
            );
            paths.push(
                "Update: services/<service>/docs/openapi.yaml for API specification".to_string(),
            );
        }

        if title.contains("database")
            || title.contains("migration")
            || description.contains("database")
        {
            paths.push(
                "Example: services/<service>/migrations/<timestamp>_<description>.sql".to_string(),
            );
            paths.push("Consider: services/<service>/src/adapters/persistence/repo.rs for repository implementation".to_string());
        }

        if description.contains("auth") || title.contains("auth") {
            paths.push("Example: services/auth-gateway/src/domain/auth.rs".to_string());
        }

        if paths.is_empty() {
            paths.push(
                "Specify domain logic files: services/<service>/src/domain/<feature>.rs"
                    .to_string(),
            );
            paths.push(
                "Specify use case files: services/<service>/src/application/usecases.rs"
                    .to_string(),
            );
            paths.push(
                "Specify adapter files: services/<service>/src/adapters/http/handlers.rs"
                    .to_string(),
            );
        }

        paths
    }

    fn suggest_frontend_paths(title: &str, description: &str) -> Vec<String> {
        let mut paths = Vec::new();

        if title.contains("component") || description.contains("component") {
            paths
                .push("Example: apps/web/components/<FeatureName>/<ComponentName>.tsx".to_string());
        }

        if title.contains("page") || description.contains("page") {
            paths.push("Example: apps/web/app/<route>/page.tsx for Next.js app router".to_string());
        }

        if title.contains("hook") || description.contains("hook") {
            paths.push("Example: apps/web/lib/hooks/use<FeatureName>.ts".to_string());
        }

        if title.contains("api") || description.contains("api client") {
            paths.push(
                "Example: apps/web/lib/api/<service>-client.ts for API integration".to_string(),
            );
        }

        if paths.is_empty() {
            paths.push(
                "Specify component files: apps/web/components/<Feature>/<Component>.tsx"
                    .to_string(),
            );
            paths.push("Specify type definitions: apps/web/types/<feature>.ts".to_string());
        }

        paths
    }

    fn suggest_test_paths(title: &str, description: &str) -> Vec<String> {
        let mut paths = Vec::new();

        if title.contains("unit") || description.contains("unit test") {
            paths.push("Example: services/<service>/tests/unit/domain/test_<module>.rs for Rust unit tests".to_string());
            paths.push(
                "Example: apps/web/<component>/<Component>.test.tsx for React unit tests"
                    .to_string(),
            );
        }

        if title.contains("integration") || description.contains("integration test") {
            paths.push(
                "Example: services/<service>/tests/integration/<feature>_test.rs".to_string(),
            );
        }

        if title.contains("e2e")
            || description.contains("e2e")
            || description.contains("end-to-end")
        {
            paths.push(
                "Example: apps/web/tests/e2e/<feature>.spec.ts for Playwright tests".to_string(),
            );
        }

        if title.contains("contract") || description.contains("contract test") {
            paths.push(
                "Example: services/<service>/tests/contract/<endpoint>_contract_test.rs"
                    .to_string(),
            );
        }

        if paths.is_empty() {
            paths.push("Specify test file paths following project test conventions".to_string());
            paths.push(
                "Consider: Unit tests in tests/unit/, integration in tests/integration/"
                    .to_string(),
            );
        }

        paths
    }

    fn suggest_devops_paths(_title: &str, description: &str) -> Vec<String> {
        let mut paths = Vec::new();

        if description.contains("github") || description.contains("workflow") {
            paths.push(
                "Example: .github/workflows/<workflow-name>.yml for CI/CD pipelines".to_string(),
            );
        }

        if description.contains("docker") || description.contains("container") {
            paths
                .push("Example: Dockerfile or docker-compose.yml for containerization".to_string());
        }

        if description.contains("openapi") || description.contains("api spec") {
            paths.push(
                "Example: services/<service>/docs/openapi.yaml for API documentation".to_string(),
            );
        }

        if paths.is_empty() {
            paths.push("Specify infrastructure/config files to modify".to_string());
        }

        paths
    }

    /// Suggests specific function or component names based on task context
    pub fn suggest_functions_or_components(
        task_title: &str,
        task_description: &str,
    ) -> Vec<String> {
        let mut suggestions = Vec::new();
        let title_lower = task_title.to_lowercase();
        let desc_lower = task_description.to_lowercase();

        // Extract action verbs and nouns to suggest naming
        if title_lower.contains("recommendation") {
            suggestions.push("Example struct: RecommendationGenerator".to_string());
            suggestions.push("Example function: generate_recommendations(task_info: &TaskInfo) -> Vec<Recommendation>".to_string());
        }

        if title_lower.contains("analysis") || title_lower.contains("analyzer") {
            suggestions.push("Example struct: TaskAnalyzer".to_string());
            suggestions.push("Example function: analyze(task: &Task) -> Analysis".to_string());
        }

        if title_lower.contains("validation") || title_lower.contains("validator") {
            suggestions.push("Example struct: Validator or <Entity>Validator".to_string());
            suggestions.push(
                "Example function: validate(input: &Input) -> Result<(), ValidationError>"
                    .to_string(),
            );
        }

        if desc_lower.contains("endpoint") || desc_lower.contains("handler") {
            suggestions.push("Example handler: async fn handle_<operation>(State(state): State<AppState>) -> Result<Json<Response>>".to_string());
        }

        if title_lower.contains("[frontend]") {
            suggestions
                .push("Example component: <FeatureName>Component with props interface".to_string());
            suggestions
                .push("Example hook: use<FeatureName>() returning state and actions".to_string());
        }

        if suggestions.is_empty() {
            suggestions.push(
                "Specify struct/class names following project naming conventions".to_string(),
            );
            suggestions
                .push("Specify function signatures: fn name(params) -> ReturnType".to_string());
            suggestions.push("Include input parameter types and output return types".to_string());
        }

        suggestions
    }

    /// Suggests which acceptance criteria IDs might be relevant based on task context
    pub fn suggest_relevant_ac_ids(
        task_title: &str,
        task_description: &str,
        valid_ac_ids: &[String],
    ) -> Vec<String> {
        let mut suggestions = Vec::new();
        let title_lower = task_title.to_lowercase();
        let desc_lower = task_description.to_lowercase();

        // Try to match AC IDs that contain relevant keywords
        let keywords = Self::extract_keywords(&title_lower, &desc_lower);

        let relevant_acs: Vec<String> = valid_ac_ids
            .iter()
            .filter(|ac_id| {
                let ac_lower = ac_id.to_lowercase();
                keywords.iter().any(|keyword| ac_lower.contains(keyword))
            })
            .cloned()
            .collect();

        if !relevant_acs.is_empty() {
            suggestions.push(format!(
                "Consider linking to these relevant ACs: {}",
                relevant_acs.join(", ")
            ));
        }

        // If we found some relevant ones, highlight them; otherwise suggest reviewing all
        if relevant_acs.is_empty() && !valid_ac_ids.is_empty() {
            suggestions.push("Review all available acceptance criteria to identify which ones this task addresses".to_string());
            suggestions.push(format!("Available AC IDs: {}", valid_ac_ids.join(", ")));
        }

        suggestions
    }

    fn extract_keywords(title: &str, description: &str) -> Vec<String> {
        let combined = format!("{} {}", title, description);
        let words: Vec<&str> = combined.split_whitespace().collect();

        // Extract meaningful keywords (filter out common words)
        let stop_words = [
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
            "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has",
            "had", "do", "does", "did", "will", "would", "should", "could", "may", "might", "must",
            "can", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
        ];

        words
            .iter()
            .filter(|w| w.len() > 3 && !stop_words.contains(&w.to_lowercase().as_str()))
            .map(|w| w.to_lowercase())
            .collect()
    }

    /// Suggests specific test coverage needs based on task type
    pub fn suggest_test_coverage(task_title: &str, task_description: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        let title_lower = task_title.to_lowercase();
        let desc_lower = task_description.to_lowercase();

        if title_lower.contains("[backend]") {
            suggestions.push(
                "Unit tests: Test domain logic in isolation (services/<service>/tests/unit/)"
                    .to_string(),
            );
            suggestions.push("Integration tests: Test with database/external services (services/<service>/tests/integration/)".to_string());

            if desc_lower.contains("endpoint") || desc_lower.contains("api") {
                suggestions.push(
                    "Contract tests: Validate OpenAPI compliance (status codes, schemas)"
                        .to_string(),
                );
            }

            suggestions
                .push("Target coverage: ≥85% as per project standards (CLAUDE.md)".to_string());
        } else if title_lower.contains("[frontend]") {
            suggestions.push(
                "Component tests: Test React components with React Testing Library".to_string(),
            );
            suggestions.push(
                "Integration tests: Test component interactions and state management".to_string(),
            );

            if desc_lower.contains("user") || desc_lower.contains("interaction") {
                suggestions.push(
                    "E2E tests: Test user workflows with Playwright (apps/web/tests/e2e/)"
                        .to_string(),
                );
            }
        } else if title_lower.contains("[qa]") {
            suggestions.push(
                "Create comprehensive test suite covering happy path and edge cases".to_string(),
            );
            suggestions
                .push("Include negative test cases for validation and error handling".to_string());
        } else {
            suggestions.push(
                "Specify expected test coverage: unit tests, integration tests, e2e tests"
                    .to_string(),
            );
            suggestions
                .push("Define test success criteria: what scenarios must be covered?".to_string());
        }

        suggestions
    }

    /// Generates enhanced technical details recommendation with specific examples
    pub fn generate_technical_details_recommendation(
        task_title: &str,
        task_description: &str,
        missing_elements: &[&str],
    ) -> Recommendation {
        let mut specific_suggestions = Vec::new();

        // ALWAYS provide context-aware suggestions for each missing element
        // even if the description mentions the concept vaguely

        for element in missing_elements {
            let element_lower = element.to_lowercase();

            if element_lower.contains("file") || element_lower.contains("path") {
                specific_suggestions.extend(Self::suggest_file_paths(task_title, task_description));
            } else if element_lower.contains("function")
                || element_lower.contains("component")
                || element_lower.contains("struct")
            {
                specific_suggestions.extend(Self::suggest_functions_or_components(
                    task_title,
                    task_description,
                ));
            } else if element_lower.contains("input")
                || element_lower.contains("output")
                || element_lower.contains("parameter")
            {
                specific_suggestions.push(
                    "Define input parameters with types (e.g., Input: TaskInfo struct with id, title, description)".to_string()
                );
                specific_suggestions.push(
                    "Define output/return type (e.g., Output: Result<TaskAnalysis, AnalysisError>)"
                        .to_string(),
                );
            } else if element_lower.contains("architecture")
                || element_lower.contains("approach")
                || element_lower.contains("design")
            {
                specific_suggestions.push(
                    "Specify technical approach: Follow hexagonal architecture (domain → application → adapters)".to_string()
                );
                specific_suggestions.push(
                    "Reference existing patterns: Check similar features in the codebase for consistency".to_string()
                );
            } else {
                // Add the original missing element suggestion
                specific_suggestions.push(element.to_string());
            }
        }

        // Deduplicate while preserving order
        let mut seen = std::collections::HashSet::new();
        specific_suggestions.retain(|s| seen.insert(s.clone()));

        Recommendation {
            gap_type: GapType::MissingTechnicalDetails,
            message: "Task description lacks specific technical details".to_string(),
            specific_suggestions,
            ac_references: vec![],
        }
    }

    /// Generates enhanced AI compatibility recommendation with specific examples
    pub fn generate_ai_compatibility_recommendation(
        task_title: &str,
        task_description: &str,
        missing_elements: &[&str],
    ) -> Recommendation {
        let mut specific_suggestions = Vec::new();

        for element in missing_elements {
            let element_lower = element.to_lowercase();

            if element_lower.contains("test") || element_lower.contains("coverage") {
                specific_suggestions
                    .extend(Self::suggest_test_coverage(task_title, task_description));
            } else if element_lower.contains("success") {
                specific_suggestions.push(
                    "Define success criteria: What does 'done' look like? (e.g., 'User can login with valid JWT token')".to_string()
                );
            } else if element_lower.contains("depend") {
                specific_suggestions.push(
                    "List dependencies: External crates, services, or prerequisite tasks (e.g., 'Requires: jsonwebtoken v9, bcrypt')".to_string()
                );
            } else if element_lower.contains("environment") {
                specific_suggestions.push(
                    "Document environment setup: Required env vars, config files (e.g., 'Requires: DATABASE_URL, JWT_SECRET')".to_string()
                );
            } else if element_lower.contains("done") {
                specific_suggestions.push(
                    "Include definition of done: Specific checkpoints (e.g., 'Tests pass, code reviewed, deployed to staging')".to_string()
                );
            } else {
                specific_suggestions.push(element.to_string());
            }
        }

        Recommendation {
            gap_type: GapType::MissingAiAgentCompatibility,
            message: "Task missing elements for AI agent compatibility".to_string(),
            specific_suggestions,
            ac_references: vec![],
        }
    }

    /// Generates enhanced AC recommendation with relevant AC suggestions
    pub fn generate_ac_recommendation(
        task_title: &str,
        task_description: &str,
        valid_ac_ids: &[String],
        is_invalid_refs: bool,
        invalid_refs: Vec<String>,
    ) -> Recommendation {
        let mut specific_suggestions = Vec::new();

        if is_invalid_refs {
            specific_suggestions.push(format!(
                "Invalid AC references: {}",
                invalid_refs.join(", ")
            ));
            specific_suggestions.push(format!("Valid AC IDs: {}", valid_ac_ids.join(", ")));
            specific_suggestions
                .push("Update task to reference only valid acceptance criteria".to_string());
        } else if valid_ac_ids.is_empty() {
            specific_suggestions.push(
                "No acceptance criteria available for this story. Consider defining story-level acceptance criteria first.".to_string()
            );
        } else {
            specific_suggestions
                .push("Link this task to specific acceptance criteria IDs".to_string());

            // Add context-aware AC suggestions
            specific_suggestions.extend(Self::suggest_relevant_ac_ids(
                task_title,
                task_description,
                valid_ac_ids,
            ));

            specific_suggestions
                .push("Identify which acceptance criteria this task addresses".to_string());
        }

        let message = if is_invalid_refs {
            "Task references invalid acceptance criteria IDs".to_string()
        } else {
            "Task is not linked to acceptance criteria".to_string()
        };

        Recommendation {
            gap_type: GapType::MissingAcceptanceCriteria,
            message,
            specific_suggestions,
            ac_references: valid_ac_ids.to_vec(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backend_file_path_suggestions() {
        let suggestions = RecommendationGenerator::suggest_file_paths(
            "[Backend] Build recommendation generation logic",
            "Generate specific recommendations based on gaps",
        );

        assert!(!suggestions.is_empty());
        assert!(suggestions
            .iter()
            .any(|s| s.contains("services/") || s.contains("src/")));
    }

    #[test]
    fn test_frontend_file_path_suggestions() {
        let suggestions = RecommendationGenerator::suggest_file_paths(
            "[Frontend] Create recommendation display component",
            "Show recommendations to user",
        );

        assert!(!suggestions.is_empty());
        assert!(suggestions.iter().any(|s| s.contains("components/")));
    }

    #[test]
    fn test_function_suggestions_for_analyzer() {
        let suggestions = RecommendationGenerator::suggest_functions_or_components(
            "Build task analyzer",
            "Analyze task completeness",
        );

        assert!(suggestions
            .iter()
            .any(|s| s.contains("Analyzer") || s.contains("analyze")));
    }

    #[test]
    fn test_relevant_ac_suggestions() {
        let valid_ac_ids = vec![
            "ac-auth-001".to_string(),
            "ac-auth-002".to_string(),
            "ac-ui-001".to_string(),
        ];

        let suggestions = RecommendationGenerator::suggest_relevant_ac_ids(
            "Add JWT authentication",
            "Implement token-based auth",
            &valid_ac_ids,
        );

        // Should suggest auth-related ACs
        let text = suggestions.join(" ");
        assert!(text.contains("ac-auth"));
    }

    #[test]
    fn test_test_coverage_suggestions_for_backend() {
        let suggestions = RecommendationGenerator::suggest_test_coverage(
            "[Backend] Add API endpoint",
            "Create POST endpoint",
        );

        assert!(suggestions.iter().any(|s| s.contains("Unit tests")));
        assert!(suggestions.iter().any(|s| s.contains("Integration tests")));
        assert!(suggestions.iter().any(|s| s.contains("85%")));
    }

    #[test]
    fn test_keyword_extraction() {
        let keywords = RecommendationGenerator::extract_keywords(
            "JWT authentication system",
            "Implement token-based authentication with refresh tokens",
        );

        assert!(keywords.contains(&"authentication".to_string()));
        assert!(
            keywords.contains(&"tokens".to_string())
                || keywords.contains(&"token-based".to_string())
        );
        assert!(!keywords.contains(&"the".to_string()));
        assert!(!keywords.contains(&"with".to_string()));
    }
}
