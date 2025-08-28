use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
            return Err(AppError::BadRequest(
                "Objectives cannot be empty".to_string(),
            ));
        }

        if acceptance_criteria_covered.is_empty() {
            return Err(AppError::BadRequest(
                "Task must cover at least one acceptance criterion".to_string(),
            ));
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

        markdown.push_str(&format!("# Task Pack: {}\n\n", self.objectives));

        // Story Context
        markdown.push_str("## Story Context\n");
        markdown.push_str(&format!("{}\n\n", self.story_context));

        // Objectives
        markdown.push_str("## Objectives\n");
        markdown.push_str(&format!("{}\n\n", self.objectives));

        // Non-goals
        if !self.non_goals.is_empty() {
            markdown.push_str("## Non-Goals\n");
            for non_goal in &self.non_goals {
                markdown.push_str(&format!("- {}\n", non_goal));
            }
            markdown.push('\n');
        }

        // Acceptance Criteria Coverage
        markdown.push_str("## Acceptance Criteria Covered\n");
        for ac in &self.acceptance_criteria_covered {
            markdown.push_str(&format!("### {} ({})\n", ac.ac_id, ac.test_approach));
            markdown.push_str(&format!("- **Given:** {}\n", ac.given));
            markdown.push_str(&format!("- **When:** {}\n", ac.when));
            markdown.push_str(&format!("- **Then:** {}\n", ac.then));
            markdown.push('\n');
        }

        // Technical Constraints
        markdown.push_str("## Technical Constraints\n");
        if !self.constraints.file_paths.is_empty() {
            markdown.push_str("### File Paths\n");
            for path in &self.constraints.file_paths {
                markdown.push_str(&format!("- `{}`\n", path));
            }
            markdown.push('\n');
        }

        if !self.constraints.ports_to_implement.is_empty() {
            markdown.push_str("### Ports to Implement\n");
            for port in &self.constraints.ports_to_implement {
                markdown.push_str(&format!("- `{}`\n", port));
            }
            markdown.push('\n');
        }

        if !self.constraints.dtos_to_create.is_empty() {
            markdown.push_str("### DTOs to Create\n");
            for dto in &self.constraints.dtos_to_create {
                markdown.push_str(&format!("- `{}`\n", dto));
            }
            markdown.push('\n');
        }

        markdown.push_str(&format!(
            "### Architecture Notes\n{}\n\n",
            self.constraints.architecture_notes
        ));

        // Test Plan
        markdown.push_str("## Test Plan\n");
        if let Some(threshold) = self.test_plan.coverage_threshold {
            markdown.push_str(&format!("**Coverage Target:** {}%\n\n", threshold));
        }

        if !self.test_plan.unit_tests.is_empty() {
            markdown.push_str("### Unit Tests\n");
            for test in &self.test_plan.unit_tests {
                markdown.push_str(&format!("- {}\n", test));
            }
            markdown.push('\n');
        }

        if !self.test_plan.integration_tests.is_empty() {
            markdown.push_str("### Integration Tests\n");
            for test in &self.test_plan.integration_tests {
                markdown.push_str(&format!("- {}\n", test));
            }
            markdown.push('\n');
        }

        if !self.test_plan.contract_tests.is_empty() {
            markdown.push_str("### Contract Tests\n");
            for test in &self.test_plan.contract_tests {
                markdown.push_str(&format!("- {}\n", test));
            }
            markdown.push('\n');
        }

        // Do Not List
        markdown.push_str("## ⚠️ DO NOT LIST\n");
        if !self.do_not_list.forbidden_actions.is_empty() {
            markdown.push_str("### Forbidden Actions\n");
            for action in &self.do_not_list.forbidden_actions {
                markdown.push_str(&format!("- ❌ {}\n", action));
            }
            markdown.push('\n');
        }

        if !self.do_not_list.no_shortcuts.is_empty() {
            markdown.push_str("### No Shortcuts\n");
            for shortcut in &self.do_not_list.no_shortcuts {
                markdown.push_str(&format!("- 🚫 {}\n", shortcut));
            }
            markdown.push('\n');
        }

        if !self.do_not_list.required_practices.is_empty() {
            markdown.push_str("### Required Practices\n");
            for practice in &self.do_not_list.required_practices {
                markdown.push_str(&format!("- ✅ {}\n", practice));
            }
            markdown.push('\n');
        }

        // Commit Plan
        markdown.push_str("## Commit Plan\n");
        markdown.push_str(&format!(
            "**Message Template:** `{}`\n\n",
            self.commit_plan.commit_message_template
        ));

        if let Some(branch) = &self.commit_plan.branch_naming_convention {
            markdown.push_str(&format!("**Branch Naming:** `{}`\n\n", branch));
        }

        if !self.commit_plan.pre_commit_checks.is_empty() {
            markdown.push_str("### Pre-commit Checks\n");
            for check in &self.commit_plan.pre_commit_checks {
                markdown.push_str(&format!("- {}\n", check));
            }
            markdown.push('\n');
        }

        // Run Instructions
        if !self.run_instructions.is_empty() {
            markdown.push_str("## Run Instructions\n");
            for (i, instruction) in self.run_instructions.iter().enumerate() {
                markdown.push_str(&format!("{}. {}\n", i + 1, instruction));
            }
        }

        markdown
    }

    pub fn generate_json(&self) -> Result<serde_json::Value, AppError> {
        serde_json::to_value(self).map_err(|_| AppError::InternalServerError)
    }

    pub fn with_generated_content(mut self) -> Result<Self, AppError> {
        self.markdown_content = self.generate_markdown();
        self.json_content = self.generate_json()?;
        Ok(self)
    }
}
