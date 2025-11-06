use crate::domain::task::{Task, TaskStatus};
use std::cmp::Ordering;
use uuid::Uuid;

/// Represents a task recommendation for a user or agent
#[derive(Debug, Clone, serde::Serialize)]
pub struct TaskRecommendation {
    pub task: Task,
    pub score: f64,
    pub reason: String,
}

/// Filters for task recommendations
#[derive(Debug, Clone, Default)]
pub struct RecommendationFilters {
    /// Filter by sprint ID
    pub sprint_id: Option<Uuid>,
    /// Filter by project ID
    pub project_id: Option<Uuid>,
    /// Filter by story IDs
    pub story_ids: Option<Vec<Uuid>>,
    /// Filter by task type/role (e.g., "dev", "qa", "po")
    pub role: Option<String>,
    /// Exclude tasks owned by user
    pub exclude_user_id: Option<Uuid>,
    /// Current user requesting recommendations (used to prioritize owned tasks)
    pub current_user_id: Option<Uuid>,
    /// Maximum number of recommendations
    pub limit: Option<usize>,
}

/// Strategy for scoring and ranking tasks
pub trait RecommendationStrategy {
    fn score_task(&self, task: &Task) -> f64;
    fn explain_score(&self, task: &Task) -> String;
}

/// Default recommendation strategy
/// Prioritizes tasks by:
/// 1. Story priority (if available)
/// 2. Task estimate (prefer smaller tasks)
/// 3. Task creation date (older first)
pub struct DefaultRecommendationStrategy;

impl RecommendationStrategy for DefaultRecommendationStrategy {
    fn score_task(&self, task: &Task) -> f64 {
        let mut score = 100.0;

        // Prefer tasks without estimates (likely simpler or need attention)
        if task.estimated_hours.is_some() {
            let estimate = task.estimated_hours.unwrap();
            // Reduce score for larger estimates (prefer smaller tasks)
            score -= estimate as f64 * 2.0;
        }

        // Boost score for older tasks (creation date)
        // This encourages working on backlogged tasks
        let age_days = (chrono::Utc::now() - task.created_at).num_days();
        score += age_days as f64 * 0.5;

        score.max(0.0)
    }

    fn explain_score(&self, task: &Task) -> String {
        let mut reasons = Vec::new();

        if let Some(estimate) = task.estimated_hours {
            if estimate <= 8 {
                reasons.push("Small task (quick win)".to_string());
            } else {
                reasons.push("Larger task (needs attention)".to_string());
            }
        } else {
            reasons.push("Unestimated (may need attention)".to_string());
        }

        let age_days = (chrono::Utc::now() - task.created_at).num_days();
        if age_days > 7 {
            reasons.push(format!("Waiting {} days", age_days));
        }

        if task.acceptance_criteria_refs.is_empty() {
            reasons.push("No AC refs (infrastructure task?)".to_string());
        } else {
            reasons.push(format!("{} AC refs", task.acceptance_criteria_refs.len()));
        }

        reasons.join(", ")
    }
}

/// Recommender that applies filters and scoring strategy
pub struct TaskRecommender {
    strategy: Box<dyn RecommendationStrategy + Send + Sync>,
}

impl TaskRecommender {
    pub fn new(strategy: Box<dyn RecommendationStrategy + Send + Sync>) -> Self {
        Self { strategy }
    }

    pub fn with_default_strategy() -> Self {
        Self::new(Box::new(DefaultRecommendationStrategy))
    }

    /// Filter and score tasks to generate recommendations
    pub fn recommend(
        &self,
        tasks: Vec<Task>,
        filters: &RecommendationFilters,
    ) -> Vec<TaskRecommendation> {
        let mut recommendations: Vec<(bool, TaskRecommendation)> = Vec::new();

        for task in tasks.into_iter() {
            if let Some(exclude_user_id) = filters.exclude_user_id {
                if task.owner_user_id == Some(exclude_user_id) {
                    continue;
                }
            }

            let is_current_user_owner = filters
                .current_user_id
                .map(|user_id| {
                    task.owner_user_id == Some(user_id)
                        && matches!(task.status, TaskStatus::Owned | TaskStatus::InProgress)
                })
                .unwrap_or(false);

            if is_current_user_owner {
                let score = self.strategy.score_task(&task);
                let reason = format!(
                    "Currently assigned to you. {}",
                    self.strategy.explain_score(&task)
                );

                recommendations.push((
                    true,
                    TaskRecommendation {
                        task,
                        score,
                        reason,
                    },
                ));
                continue;
            }

            if task.status != TaskStatus::Available {
                continue;
            }

            if let Some(ref story_ids) = filters.story_ids {
                if !story_ids.contains(&task.story_id) {
                    continue;
                }
            }

            if let Some(ref role) = filters.role {
                let role_lower = role.to_lowercase();
                let title_lower = task.title.to_lowercase();
                let desc_lower = task
                    .description
                    .as_ref()
                    .map(|d| d.to_lowercase())
                    .unwrap_or_default();

                let role_match = match role_lower.as_str() {
                    "dev" | "developer" => {
                        title_lower.contains("implement")
                            || title_lower.contains("create")
                            || title_lower.contains("build")
                            || title_lower.contains("add ")
                            || desc_lower.contains("implement")
                            || !title_lower.contains("test")
                    }
                    "qa" | "tester" => {
                        title_lower.contains("test")
                            || title_lower.contains("verify")
                            || title_lower.contains("e2e")
                            || desc_lower.contains("test")
                    }
                    "po" | "product" => {
                        title_lower.contains("review")
                            || title_lower.contains("accept")
                            || title_lower.contains("validate")
                    }
                    _ => true, // Unknown role, include all tasks
                };

                if !role_match {
                    continue;
                }
            }

            let score = self.strategy.score_task(&task);
            let reason = self.strategy.explain_score(&task);

            recommendations.push((
                false,
                TaskRecommendation {
                    task,
                    score,
                    reason,
                },
            ));
        }

        recommendations.sort_by(
            |(owned_a, rec_a), (owned_b, rec_b)| match owned_b.cmp(owned_a) {
                Ordering::Equal => rec_b
                    .score
                    .partial_cmp(&rec_a.score)
                    .unwrap_or(Ordering::Equal),
                other => other,
            },
        );

        let mut sorted: Vec<TaskRecommendation> =
            recommendations.into_iter().map(|(_, rec)| rec).collect();

        if let Some(limit) = filters.limit {
            sorted.truncate(limit);
        }

        sorted
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_task(title: &str, estimated_hours: Option<u32>, days_old: i64) -> Task {
        Task {
            id: Uuid::new_v4(),
            story_id: Uuid::new_v4(),
            organization_id: None,
            title: title.to_string(),
            description: None,
            status: TaskStatus::Available,
            owner_user_id: None,
            estimated_hours,
            acceptance_criteria_refs: vec![],
            created_at: Utc::now() - chrono::Duration::days(days_old),
            updated_at: Utc::now(),
            owned_at: None,
            completed_at: None,
        }
    }

    #[test]
    fn test_scores_smaller_tasks_higher() {
        let strategy = DefaultRecommendationStrategy;
        let small_task = create_test_task("Small task", Some(2), 0);
        let large_task = create_test_task("Large task", Some(8), 0);

        let small_score = strategy.score_task(&small_task);
        let large_score = strategy.score_task(&large_task);

        assert!(
            small_score > large_score,
            "Small tasks should score higher than large tasks"
        );
    }

    #[test]
    fn test_scores_older_tasks_higher() {
        let strategy = DefaultRecommendationStrategy;
        let old_task = create_test_task("Old task", Some(3), 10);
        let new_task = create_test_task("New task", Some(3), 1);

        let old_score = strategy.score_task(&old_task);
        let new_score = strategy.score_task(&new_task);

        assert!(
            old_score > new_score,
            "Older tasks should score higher than newer tasks"
        );
    }

    #[test]
    fn test_filters_dev_tasks() {
        let recommender = TaskRecommender::with_default_strategy();
        let tasks = vec![
            create_test_task("Implement feature X", Some(3), 1),
            create_test_task("Write E2E tests for feature", Some(2), 1),
            create_test_task("Create API endpoint", Some(5), 2),
        ];

        let filters = RecommendationFilters {
            role: Some("dev".to_string()),
            limit: Some(10),
            ..Default::default()
        };

        let recommendations = recommender.recommend(tasks, &filters);

        // Should include "Implement" and "Create" but not "test"
        assert!(recommendations
            .iter()
            .any(|r| r.task.title.contains("Implement")));
        assert!(recommendations
            .iter()
            .any(|r| r.task.title.contains("Create")));
        assert!(!recommendations
            .iter()
            .any(|r| r.task.title.contains("test")));
    }

    #[test]
    fn test_filters_qa_tasks() {
        let recommender = TaskRecommender::with_default_strategy();
        let tasks = vec![
            create_test_task("Implement feature X", Some(3), 1),
            create_test_task("Write E2E tests for feature", Some(2), 1),
            create_test_task("Test API integration", Some(2), 1),
        ];

        let filters = RecommendationFilters {
            role: Some("qa".to_string()),
            limit: Some(10),
            ..Default::default()
        };

        let recommendations = recommender.recommend(tasks, &filters);

        // Should only include test tasks
        assert_eq!(recommendations.len(), 2);
        assert!(recommendations
            .iter()
            .all(|r| r.task.title.to_lowercase().contains("test")));
    }

    #[test]
    fn test_limits_recommendations() {
        let recommender = TaskRecommender::with_default_strategy();
        let tasks = vec![
            create_test_task("Task 1", Some(1), 1),
            create_test_task("Task 2", Some(2), 2),
            create_test_task("Task 3", Some(3), 3),
            create_test_task("Task 4", Some(4), 4),
            create_test_task("Task 5", Some(5), 5),
        ];

        let filters = RecommendationFilters {
            limit: Some(3),
            ..Default::default()
        };

        let recommendations = recommender.recommend(tasks, &filters);

        assert_eq!(recommendations.len(), 3);
    }

    #[test]
    fn test_excludes_owned_tasks() {
        let recommender = TaskRecommender::with_default_strategy();
        let user_id = Uuid::new_v4();

        let mut owned_task = create_test_task("Owned task", Some(2), 1);
        owned_task.owner_user_id = Some(user_id);
        owned_task.status = TaskStatus::Owned;

        let tasks = vec![owned_task, create_test_task("Available task", Some(2), 1)];

        let filters = RecommendationFilters {
            exclude_user_id: Some(user_id),
            ..Default::default()
        };

        let recommendations = recommender.recommend(tasks, &filters);

        assert_eq!(recommendations.len(), 1);
        assert_eq!(recommendations[0].task.title, "Available task");
    }

    #[test]
    fn test_prioritizes_tasks_owned_by_current_user() {
        let recommender = TaskRecommender::with_default_strategy();
        let user_id = Uuid::new_v4();

        let mut my_task = create_test_task("My owned task", Some(2), 1);
        my_task.owner_user_id = Some(user_id);
        my_task.status = TaskStatus::Owned;

        let tasks = vec![create_test_task("Available task", Some(3), 3), my_task];

        let filters = RecommendationFilters {
            current_user_id: Some(user_id),
            ..Default::default()
        };

        let recommendations = recommender.recommend(tasks, &filters);

        assert_eq!(recommendations.len(), 2);
        assert_eq!(recommendations[0].task.title, "My owned task");
        assert!(recommendations[0]
            .reason
            .contains("Currently assigned to you"));
    }
}
