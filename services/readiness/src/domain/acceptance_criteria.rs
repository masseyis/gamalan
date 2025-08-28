use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AcceptanceCriterion {
    pub id: Uuid,
    pub story_id: Uuid,
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

impl AcceptanceCriterion {
    pub fn new(
        story_id: Uuid,
        ac_id: String,
        given: String,
        when: String,
        then: String,
    ) -> Result<Self, AppError> {
        if ac_id.trim().is_empty() {
            return Err(AppError::BadRequest("AC ID cannot be empty".to_string()));
        }
        if given.trim().is_empty() || when.trim().is_empty() || then.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Given/When/Then cannot be empty".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            story_id,
            ac_id: ac_id.trim().to_string(),
            given: given.trim().to_string(),
            when: when.trim().to_string(),
            then: then.trim().to_string(),
        })
    }

    pub fn update_content(
        &mut self,
        given: Option<String>,
        when: Option<String>,
        then: Option<String>,
    ) -> Result<(), AppError> {
        if let Some(given) = given {
            if given.trim().is_empty() {
                return Err(AppError::BadRequest("Given cannot be empty".to_string()));
            }
            self.given = given.trim().to_string();
        }

        if let Some(when) = when {
            if when.trim().is_empty() {
                return Err(AppError::BadRequest("When cannot be empty".to_string()));
            }
            self.when = when.trim().to_string();
        }

        if let Some(then) = then {
            if then.trim().is_empty() {
                return Err(AppError::BadRequest("Then cannot be empty".to_string()));
            }
            self.then = then.trim().to_string();
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_acceptance_criterion() {
        let story_id = Uuid::new_v4();
        let ac = AcceptanceCriterion::new(
            story_id,
            "AC1".to_string(),
            "user is logged in".to_string(),
            "user clicks save".to_string(),
            "data is saved".to_string(),
        );

        assert!(ac.is_ok());
        let ac = ac.unwrap();
        assert_eq!(ac.story_id, story_id);
        assert_eq!(ac.ac_id, "AC1");
    }

    #[test]
    fn test_empty_ac_id_fails() {
        let story_id = Uuid::new_v4();
        let ac = AcceptanceCriterion::new(
            story_id,
            "".to_string(),
            "given".to_string(),
            "when".to_string(),
            "then".to_string(),
        );

        assert!(ac.is_err());
    }

    #[test]
    fn test_empty_given_when_then_fails() {
        let story_id = Uuid::new_v4();

        let ac = AcceptanceCriterion::new(
            story_id,
            "AC1".to_string(),
            "".to_string(),
            "when".to_string(),
            "then".to_string(),
        );
        assert!(ac.is_err());
    }
}
