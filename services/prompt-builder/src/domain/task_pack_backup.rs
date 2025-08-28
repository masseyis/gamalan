use serde::{Deserialize, Serialize};
use uuid::Uuid;
use common::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TaskConstraints {
    pub file_paths: Vec<String>,
    pub ports_to_implement: Vec<String>,
    pub dtos_to_create: Vec<String>,
    pub architecture_notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestPlan {
    pub unit_tests: Vec<String>,
    pub integration_tests: Vec<String>,
    pub contract_tests: Vec<String>,
    pub coverage_threshold: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DoNotList {
    pub forbidden_actions: Vec<String>,
    pub no_shortcuts: Vec<String>,
    pub required_practices: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommitPlan {
    pub commit_message_template: String,
    pub pre_commit_checks: Vec<String>,
    pub branch_naming_convention: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPack {
    pub id: Uuid,
    pub task_id: Uuid,
    pub plan_pack_id: Option<Uuid>,
    pub objectives: String,
    pub non_goals: Vec<String>,
    pub story_context: String,
    pub acceptance_criteria_covered: Vec<AcceptanceCriterionCoverage>,
    pub constraints: TaskConstraints,
    pub test_plan: TestPlan,
    pub do_not_list: DoNotList,
    pub commit_plan: CommitPlan,
    pub run_instructions: Vec<String>,
    pub markdown_content: String,
    pub json_content: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AcceptanceCriterionCoverage {
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
    pub test_approach: String,
}

impl TaskPack {
    pub fn new(
        task_id: Uuid,
        plan_pack_id: Option<Uuid>,
        objectives: String,
        non_goals: Vec<String>,
        story_context: String,
        acceptance_criteria_covered: Vec<AcceptanceCriterionCoverage>,
        constraints: TaskConstraints,
        test_plan: TestPlan,
        do_not_list: DoNotList,
        commit_plan: CommitPlan,
        run_instructions: Vec<String>,
    ) -> Result<Self, AppError> {
        if objectives.trim().is_empty() {
            return Err(AppError::BadRequest("Objectives cannot be empty".to_string()));
        }

        if acceptance_criteria_covered.is_empty() {
            return Err(AppError::BadRequest("Task must cover at least one acceptance criterion".to_string()));
        }

        let task_pack = Self {
            id: Uuid::new_v4(),
            task_id,
            plan_pack_id,
            objectives: objectives.trim().to_string(),
            non_goals,
            story_context,
            acceptance_criteria_covered,
            constraints,
            test_plan,
            do_not_list,
            commit_plan,
            run_instructions,
            markdown_content: String::new(), // Will be generated
            json_content: serde_json::Value::Null, // Will be generated
            created_at: chrono::Utc::now(),
        };

        Ok(task_pack)
    }

    pub fn generate_markdown(&self) -> String {
        let mut markdown = String::new();
        
        markdown.push_str(&format!(\"# Task Pack: {}\n\n\", self.objectives));\n        
        // Story Context\n        markdown.push_str(\"## Story Context\n\");\n        markdown.push_str(&format!(\"{}\n\n\", self.story_context));\n        \n        // Objectives\n        markdown.push_str(\"## Objectives\n\");\n        markdown.push_str(&format!(\"{}\n\n\", self.objectives));\n        \n        // Non-goals\n        if !self.non_goals.is_empty() {\n            markdown.push_str(\"## Non-Goals\n\");\n            for non_goal in &self.non_goals {\n                markdown.push_str(&format!(\"- {}\n\", non_goal));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        // Acceptance Criteria Coverage\n        markdown.push_str(\"## Acceptance Criteria Covered\n\");\n        for ac in &self.acceptance_criteria_covered {\n            markdown.push_str(&format!(\"### {} ({})\n\", ac.ac_id, ac.test_approach));\n            markdown.push_str(&format!(\"- **Given:** {}\n\", ac.given));\n            markdown.push_str(&format!(\"- **When:** {}\n\", ac.when));\n            markdown.push_str(&format!(\"- **Then:** {}\n\", ac.then));\n            markdown.push_str(\"\n\");\n        }\n        \n        // Technical Constraints\n        markdown.push_str(\"## Technical Constraints\n\");\n        if !self.constraints.file_paths.is_empty() {\n            markdown.push_str(\"### File Paths\n\");\n            for path in &self.constraints.file_paths {\n                markdown.push_str(&format!(\"- `{}`\n\", path));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        if !self.constraints.ports_to_implement.is_empty() {\n            markdown.push_str(\"### Ports to Implement\n\");\n            for port in &self.constraints.ports_to_implement {\n                markdown.push_str(&format!(\"- `{}`\n\", port));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        if !self.constraints.dtos_to_create.is_empty() {\n            markdown.push_str(\"### DTOs to Create\n\");\n            for dto in &self.constraints.dtos_to_create {\n                markdown.push_str(&format!(\"- `{}`\n\", dto));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        markdown.push_str(&format!(\"### Architecture Notes\n{}\n\n\", self.constraints.architecture_notes));\n        \n        // Test Plan\n        markdown.push_str(\"## Test Plan\n\");\n        if let Some(threshold) = self.test_plan.coverage_threshold {\n            markdown.push_str(&format!(\"**Coverage Target:** {}%\n\n\", threshold));\n        }\n        \n        if !self.test_plan.unit_tests.is_empty() {\n            markdown.push_str(\"### Unit Tests\n\");\n            for test in &self.test_plan.unit_tests {\n                markdown.push_str(&format!(\"- {}\n\", test));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        if !self.test_plan.integration_tests.is_empty() {\n            markdown.push_str(\"### Integration Tests\n\");\n            for test in &self.test_plan.integration_tests {\n                markdown.push_str(&format!(\"- {}\n\", test));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        if !self.test_plan.contract_tests.is_empty() {\n            markdown.push_str(\"### Contract Tests\n\");\n            for test in &self.test_plan.contract_tests {\n                markdown.push_str(&format!(\"- {}\n\", test));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        // Do Not List\n        markdown.push_str(\"## ⚠️ DO NOT LIST\n\");\n        if !self.do_not_list.forbidden_actions.is_empty() {\n            markdown.push_str(\"### Forbidden Actions\n\");\n            for action in &self.do_not_list.forbidden_actions {\n                markdown.push_str(&format!(\"- ❌ {}\n\", action));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        if !self.do_not_list.no_shortcuts.is_empty() {\n            markdown.push_str(\"### No Shortcuts\n\");\n            for shortcut in &self.do_not_list.no_shortcuts {\n                markdown.push_str(&format!(\"- 🚫 {}\n\", shortcut));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        if !self.do_not_list.required_practices.is_empty() {\n            markdown.push_str(\"### Required Practices\n\");\n            for practice in &self.do_not_list.required_practices {\n                markdown.push_str(&format!(\"- ✅ {}\n\", practice));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        // Commit Plan\n        markdown.push_str(\"## Commit Plan\n\");\n        markdown.push_str(&format!(\"**Message Template:** `{}`\n\n\", self.commit_plan.commit_message_template));\n        \n        if let Some(branch) = &self.commit_plan.branch_naming_convention {\n            markdown.push_str(&format!(\"**Branch Naming:** `{}`\n\n\", branch));\n        }\n        \n        if !self.commit_plan.pre_commit_checks.is_empty() {\n            markdown.push_str(\"### Pre-commit Checks\n\");\n            for check in &self.commit_plan.pre_commit_checks {\n                markdown.push_str(&format!(\"- {}\n\", check));\n            }\n            markdown.push_str(\"\n\");\n        }\n        \n        // Run Instructions\n        if !self.run_instructions.is_empty() {\n            markdown.push_str(\"## Run Instructions\n\");\n            for (i, instruction) in self.run_instructions.iter().enumerate() {\n                markdown.push_str(&format!(\"{}. {}\n\", i + 1, instruction));\n            }\n        }\n        \n        markdown\n    }\n\n    pub fn generate_json(&self) -> Result<serde_json::Value, AppError> {\n        serde_json::to_value(self)\n            .map_err(|_| AppError::InternalServerError)\n    }\n\n    pub fn with_generated_content(mut self) -> Result<Self, AppError> {\n        self.markdown_content = self.generate_markdown();\n        self.json_content = self.generate_json()?;\n        Ok(self)\n    }\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    fn create_test_task_pack() -> TaskPack {\n        let constraints = TaskConstraints {\n            file_paths: vec![\"src/handlers.rs\".to_string()],\n            ports_to_implement: vec![\"UserRepository\".to_string()],\n            dtos_to_create: vec![\"CreateUserRequest\".to_string()],\n            architecture_notes: \"Follow hexagonal architecture\".to_string(),\n        };\n\n        let test_plan = TestPlan {\n            unit_tests: vec![\"Test user creation\".to_string()],\n            integration_tests: vec![\"Test user API endpoint\".to_string()],\n            contract_tests: vec![\"Test OpenAPI compliance\".to_string()],\n            coverage_threshold: Some(85),\n        };\n\n        let do_not_list = DoNotList {\n            forbidden_actions: vec![\"Skip tests\".to_string()],\n            no_shortcuts: vec![\"Bypass validation\".to_string()],\n            required_practices: vec![\"Write tests first\".to_string()],\n        };\n\n        let commit_plan = CommitPlan {\n            commit_message_template: \"feat: add user creation endpoint\".to_string(),\n            pre_commit_checks: vec![\"cargo fmt\".to_string(), \"cargo clippy\".to_string()],\n            branch_naming_convention: Some(\"feature/user-creation\".to_string()),\n        };\n\n        let ac_coverage = vec![AcceptanceCriterionCoverage {\n            ac_id: \"AC1\".to_string(),\n            given: \"user provides valid data\".to_string(),\n            when: \"user submits form\".to_string(),\n            then: \"user is created\".to_string(),\n            test_approach: \"Unit + Integration tests\".to_string(),\n        }];\n\n        TaskPack::new(\n            Uuid::new_v4(),\n            Some(Uuid::new_v4()),\n            \"Implement user creation functionality\".to_string(),\n            vec![\"Don't implement user deletion\".to_string()],\n            \"User management story context\".to_string(),\n            ac_coverage,\n            constraints,\n            test_plan,\n            do_not_list,\n            commit_plan,\n            vec![\"Run cargo test\".to_string()],\n        ).unwrap()\n    }\n\n    #[test]\n    fn test_task_pack_creation() {\n        let task_pack = create_test_task_pack();\n        assert_eq!(task_pack.objectives, \"Implement user creation functionality\");\n        assert_eq!(task_pack.acceptance_criteria_covered.len(), 1);\n    }\n\n    #[test]\n    fn test_empty_objectives_fails() {\n        let task_id = Uuid::new_v4();\n        let ac_coverage = vec![AcceptanceCriterionCoverage {\n            ac_id: \"AC1\".to_string(),\n            given: \"test\".to_string(),\n            when: \"test\".to_string(),\n            then: \"test\".to_string(),\n            test_approach: \"test\".to_string(),\n        }];\n\n        let result = TaskPack::new(\n            task_id,\n            None,\n            \"\".to_string(),\n            vec![],\n            \"context\".to_string(),\n            ac_coverage,\n            TaskConstraints {\n                file_paths: vec![],\n                ports_to_implement: vec![],\n                dtos_to_create: vec![],\n                architecture_notes: \"notes\".to_string(),\n            },\n            TestPlan {\n                unit_tests: vec![],\n                integration_tests: vec![],\n                contract_tests: vec![],\n                coverage_threshold: None,\n            },\n            DoNotList {\n                forbidden_actions: vec![],\n                no_shortcuts: vec![],\n                required_practices: vec![],\n            },\n            CommitPlan {\n                commit_message_template: \"msg\".to_string(),\n                pre_commit_checks: vec![],\n                branch_naming_convention: None,\n            },\n            vec![],\n        );\n\n        assert!(result.is_err());\n    }\n\n    #[test]\n    fn test_markdown_generation() {\n        let task_pack = create_test_task_pack();\n        let markdown = task_pack.generate_markdown();\n        \n        assert!(markdown.contains(\"# Task Pack:\"));\n        assert!(markdown.contains(\"## Objectives\"));\n        assert!(markdown.contains(\"## Acceptance Criteria Covered\"));\n        assert!(markdown.contains(\"⚠️ DO NOT LIST\"));\n    }\n\n    #[test]\n    fn test_json_generation() {\n        let task_pack = create_test_task_pack();\n        let json_result = task_pack.generate_json();\n        \n        assert!(json_result.is_ok());\n        let json = json_result.unwrap();\n        assert!(json.is_object());\n    }\n\n    #[test]\n    fn test_with_generated_content() {\n        let task_pack = create_test_task_pack();\n        let result = task_pack.with_generated_content();\n        \n        assert!(result.is_ok());\n        let task_pack = result.unwrap();\n        assert!(!task_pack.markdown_content.is_empty());\n        assert!(!task_pack.json_content.is_null());\n    }\n}"
        },
    ]
}