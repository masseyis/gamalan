use common::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AcceptanceCriteriaMap {
    pub criteria: HashMap<String, AcceptanceCriterionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AcceptanceCriterionInfo {
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProposedTask {
    pub title: String,
    pub description: String,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_effort: Option<String>,
    pub technical_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanPack {
    pub id: Uuid,
    pub story_id: Uuid,
    pub acceptance_criteria_map: AcceptanceCriteriaMap,
    pub proposed_tasks: Vec<ProposedTask>,
    pub architecture_impact: Option<String>,
    pub risks: Vec<String>,
    pub unknowns: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl PlanPack {
    pub fn new(
        story_id: Uuid,
        acceptance_criteria_map: AcceptanceCriteriaMap,
        proposed_tasks: Vec<ProposedTask>,
        architecture_impact: Option<String>,
        risks: Vec<String>,
        unknowns: Vec<String>,
    ) -> Result<Self, AppError> {
        // Validate that all proposed tasks reference valid AC IDs
        let valid_ac_ids: std::collections::HashSet<String> =
            acceptance_criteria_map.criteria.keys().cloned().collect();

        for task in &proposed_tasks {
            for ac_ref in &task.acceptance_criteria_refs {
                if !valid_ac_ids.contains(ac_ref) {
                    return Err(AppError::BadRequest(format!(
                        "Task '{}' references invalid AC ID: {}",
                        task.title, ac_ref
                    )));
                }
            }
        }

        // Validate that every AC is covered by at least one task
        let covered_ac_ids: std::collections::HashSet<String> = proposed_tasks
            .iter()
            .flat_map(|t| &t.acceptance_criteria_refs)
            .cloned()
            .collect();

        let uncovered_acs: Vec<String> =
            valid_ac_ids.difference(&covered_ac_ids).cloned().collect();

        if !uncovered_acs.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Acceptance criteria not covered by any task: {}",
                uncovered_acs.join(", ")
            )));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            story_id,
            acceptance_criteria_map,
            proposed_tasks,
            architecture_impact,
            risks,
            unknowns,
            created_at: chrono::Utc::now(),
        })
    }

    #[allow(dead_code)]
    pub fn get_coverage_map(&self) -> HashMap<String, Vec<String>> {
        let mut coverage = HashMap::new();

        for task in &self.proposed_tasks {
            for ac_ref in &task.acceptance_criteria_refs {
                coverage
                    .entry(ac_ref.clone())
                    .or_insert_with(Vec::new)
                    .push(task.title.clone());
            }
        }

        coverage
    }

    #[allow(dead_code)]
    pub fn validate_completeness(&self) -> Result<(), AppError> {
        let ac_ids: std::collections::HashSet<String> = self
            .acceptance_criteria_map
            .criteria
            .keys()
            .cloned()
            .collect();

        let covered_ids: std::collections::HashSet<String> = self
            .proposed_tasks
            .iter()
            .flat_map(|t| &t.acceptance_criteria_refs)
            .cloned()
            .collect();

        let missing: Vec<String> = ac_ids.difference(&covered_ids).cloned().collect();

        if !missing.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Plan Pack incomplete - missing coverage for: {}",
                missing.join(", ")
            )));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_ac_map() -> AcceptanceCriteriaMap {
        let mut criteria = HashMap::new();
        criteria.insert(
            "AC1".to_string(),
            AcceptanceCriterionInfo {
                ac_id: "AC1".to_string(),
                given: "user is logged in".to_string(),
                when: "user clicks save".to_string(),
                then: "data is saved".to_string(),
            },
        );
        criteria.insert(
            "AC2".to_string(),
            AcceptanceCriterionInfo {
                ac_id: "AC2".to_string(),
                given: "user has data".to_string(),
                when: "user submits form".to_string(),
                then: "form is validated".to_string(),
            },
        );

        AcceptanceCriteriaMap { criteria }
    }

    fn create_test_tasks() -> Vec<ProposedTask> {
        vec![
            ProposedTask {
                title: "Implement save functionality".to_string(),
                description: "Add save endpoint and UI".to_string(),
                acceptance_criteria_refs: vec!["AC1".to_string()],
                estimated_effort: Some("Medium".to_string()),
                technical_notes: None,
            },
            ProposedTask {
                title: "Add form validation".to_string(),
                description: "Validate form inputs".to_string(),
                acceptance_criteria_refs: vec!["AC2".to_string()],
                estimated_effort: Some("Small".to_string()),
                technical_notes: None,
            },
        ]
    }

    #[test]
    fn test_plan_pack_creation_success() {
        let story_id = Uuid::new_v4();
        let ac_map = create_test_ac_map();
        let tasks = create_test_tasks();

        let plan_pack = PlanPack::new(
            story_id,
            ac_map,
            tasks,
            Some("No significant impact".to_string()),
            vec![],
            vec![],
        );

        assert!(plan_pack.is_ok());
        let plan_pack = plan_pack.unwrap();
        assert_eq!(plan_pack.story_id, story_id);
        assert_eq!(plan_pack.proposed_tasks.len(), 2);
    }

    #[test]
    fn test_plan_pack_invalid_ac_reference() {
        let story_id = Uuid::new_v4();
        let ac_map = create_test_ac_map();
        let mut tasks = create_test_tasks();
        tasks[0]
            .acceptance_criteria_refs
            .push("INVALID_AC".to_string());

        let plan_pack = PlanPack::new(story_id, ac_map, tasks, None, vec![], vec![]);

        assert!(plan_pack.is_err());
    }

    #[test]
    fn test_plan_pack_missing_coverage() {
        let story_id = Uuid::new_v4();
        let ac_map = create_test_ac_map();
        let tasks = vec![create_test_tasks()[0].clone()]; // Only covers AC1

        let plan_pack = PlanPack::new(story_id, ac_map, tasks, None, vec![], vec![]);

        assert!(plan_pack.is_err());
    }

    #[test]
    fn test_coverage_map() {
        let story_id = Uuid::new_v4();
        let ac_map = create_test_ac_map();
        let tasks = create_test_tasks();

        let plan_pack = PlanPack::new(story_id, ac_map, tasks, None, vec![], vec![]).unwrap();

        let coverage = plan_pack.get_coverage_map();
        assert_eq!(coverage.len(), 2);
        assert!(coverage.contains_key("AC1"));
        assert!(coverage.contains_key("AC2"));
    }
}
