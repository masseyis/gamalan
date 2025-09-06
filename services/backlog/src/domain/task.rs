use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
}

impl Task {
    pub fn new(
        story_id: Uuid,
        title: String,
        description: Option<String>,
        acceptance_criteria_refs: Vec<String>,
    ) -> Result<Self, AppError> {
        // Validate title is not empty or whitespace-only
        if title.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Task title cannot be empty".to_string(),
            ));
        }

        // Validate acceptance criteria refs vector is not empty
        if acceptance_criteria_refs.is_empty() {
            return Err(AppError::BadRequest(
                "Task must have at least one acceptance criteria reference".to_string(),
            ));
        }

        // Validate AC refs are not empty strings
        for ac_ref in &acceptance_criteria_refs {
            if ac_ref.trim().is_empty() {
                return Err(AppError::BadRequest(
                    "Acceptance criteria references cannot be empty".to_string(),
                ));
            }
        }

        Ok(Self {
            id: Uuid::new_v4(),
            story_id,
            title,
            description,
            acceptance_criteria_refs,
        })
    }

    #[allow(dead_code)]
    pub fn update_acceptance_criteria_refs(&mut self, refs: Vec<String>) -> Result<(), AppError> {
        // Validate acceptance criteria refs vector is not empty
        if refs.is_empty() {
            return Err(AppError::BadRequest(
                "Task must have at least one acceptance criteria reference".to_string(),
            ));
        }

        // Validate AC refs are not empty strings
        for ac_ref in &refs {
            if ac_ref.trim().is_empty() {
                return Err(AppError::BadRequest(
                    "Acceptance criteria references cannot be empty".to_string(),
                ));
            }
        }

        self.acceptance_criteria_refs = refs;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_task_with_valid_ac_refs() {
        let story_id = Uuid::new_v4();
        let ac_refs = vec!["AC1".to_string(), "AC2".to_string()];
        let task = Task::new(
            story_id,
            "Test task".to_string(),
            Some("Description".to_string()),
            ac_refs.clone(),
        );

        assert!(task.is_ok());
        let task = task.unwrap();
        assert_eq!(task.acceptance_criteria_refs, ac_refs);
    }

    #[test]
    fn test_new_task_with_empty_ac_ref() {
        let story_id = Uuid::new_v4();
        let ac_refs = vec!["AC1".to_string(), "".to_string()];
        let task = Task::new(story_id, "Test task".to_string(), None, ac_refs);

        assert!(task.is_err());
    }

    #[test]
    fn test_update_acceptance_criteria_refs() {
        let story_id = Uuid::new_v4();
        let mut task = Task::new(
            story_id,
            "Test task".to_string(),
            None,
            vec!["AC1".to_string()],
        )
        .unwrap();

        let new_refs = vec!["AC2".to_string(), "AC3".to_string()];
        let result = task.update_acceptance_criteria_refs(new_refs.clone());

        assert!(result.is_ok());
        assert_eq!(task.acceptance_criteria_refs, new_refs);
    }
}
