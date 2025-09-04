pub mod contract;
pub mod integration;
pub mod unit;

// Test utilities and helpers
pub mod test_helpers {
    use serde_json::{json, Value};
    use uuid::Uuid;

    pub fn create_test_story_json(project_id: Uuid, title: &str) -> Value {
        json!({
            "title": title,
            "description": format!("Test description for {}", title),
            "labels": ["test"]
        })
    }

    pub fn create_test_task_json(title: &str, ac_refs: Vec<&str>) -> Value {
        json!({
            "title": title,
            "description": format!("Test description for {}", title),
            "acceptance_criteria_refs": ac_refs
        })
    }

    pub fn generate_test_uuid() -> Uuid {
        Uuid::new_v4()
    }

    pub fn create_auth_header(token: &str) -> (&'static str, String) {
        ("authorization", format!("Bearer {}", token))
    }
}
