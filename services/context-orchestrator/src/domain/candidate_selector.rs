use crate::domain::{CandidateEntity, EntityType};
use uuid::Uuid;

pub struct CandidateSelector;

impl CandidateSelector {
    pub fn rank_candidates(
        candidates: Vec<CandidateEntity>,
        intent_context: &str,
    ) -> Vec<CandidateEntity> {
        let mut ranked = candidates;

        // Sort by match score (from vector similarity search)
        ranked.sort_by(|a, b| {
            b.similarity_score
                .partial_cmp(&a.similarity_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Apply additional ranking factors
        Self::apply_context_boost(&mut ranked, intent_context);
        Self::apply_type_priority(&mut ranked, intent_context);

        // Re-sort after applying boosts
        ranked.sort_by(|a, b| {
            b.similarity_score
                .partial_cmp(&a.similarity_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Limit results to top 10 for performance
        ranked.truncate(10);

        ranked
    }

    pub fn filter_by_tenant(
        candidates: Vec<CandidateEntity>,
        tenant_id: Uuid,
    ) -> Vec<CandidateEntity> {
        candidates
            .into_iter()
            .filter(|candidate| candidate.tenant_id == tenant_id)
            .collect()
    }

    pub fn deduplicate_candidates(candidates: Vec<CandidateEntity>) -> Vec<CandidateEntity> {
        let mut seen_ids = std::collections::HashSet::new();
        let mut deduplicated = Vec::new();

        for candidate in candidates {
            if seen_ids.insert(candidate.id) {
                deduplicated.push(candidate);
            }
        }

        deduplicated
    }

    fn apply_context_boost(candidates: &mut [CandidateEntity], intent_context: &str) {
        let context_lower = intent_context.to_lowercase();
        let boost_keywords = vec![
            ("ready", 0.1),
            ("progress", 0.1),
            ("review", 0.1),
            ("done", 0.1),
            ("create", 0.15),
            ("delete", 0.15),
            ("move", 0.1),
            ("plan", 0.2),
            ("task", 0.1),
            ("story", 0.1),
        ];

        for candidate in candidates.iter_mut() {
            let title_lower = candidate.title.to_lowercase();
            let description_lower = candidate
                .description
                .as_deref()
                .unwrap_or("")
                .to_lowercase();

            for (keyword, boost) in &boost_keywords {
                if context_lower.contains(keyword)
                    && (title_lower.contains(keyword) || description_lower.contains(keyword))
                {
                    candidate.similarity_score += boost;
                    break; // Apply only one boost per candidate to avoid over-boosting
                }
            }

            // Cap match score at 1.0
            candidate.similarity_score = candidate.similarity_score.min(1.0);
        }
    }

    fn apply_type_priority(candidates: &mut [CandidateEntity], intent_context: &str) {
        let context_lower = intent_context.to_lowercase();

        // Define type priorities based on context
        let type_boosts = if context_lower.contains("story") || context_lower.contains("ready") {
            vec![(EntityType::Story, 0.15)]
        } else if context_lower.contains("task") {
            vec![(EntityType::Task, 0.15)]
        } else if context_lower.contains("project") {
            vec![(EntityType::Project, 0.15)]
        } else if context_lower.contains("plan") {
            vec![(EntityType::PlanPack, 0.2), (EntityType::TaskPack, 0.15)]
        } else {
            vec![] // No type priority
        };

        for candidate in candidates.iter_mut() {
            for (entity_type, boost) in &type_boosts {
                if candidate.entity_type == entity_type.to_string() {
                    candidate.similarity_score += boost;
                    break;
                }
            }

            // Cap match score at 1.0
            candidate.similarity_score = candidate.similarity_score.min(1.0);
        }
    }

    pub fn calculate_confidence(candidates: &[CandidateEntity]) -> f32 {
        if candidates.is_empty() {
            return 0.0;
        }

        // Base confidence on the top candidate's score and the distribution
        let top_score = candidates[0].similarity_score;

        // If we have multiple candidates, look at the score gap
        let confidence = if candidates.len() == 1 {
            top_score
        } else {
            let second_score = candidates[1].similarity_score;
            let score_gap = top_score - second_score;

            // Higher confidence when there's a clear winner
            top_score + (score_gap * 0.2)
        };

        confidence.min(1.0)
    }
}

// Module-level convenience functions
pub fn rank_candidates(
    candidates: Vec<CandidateEntity>,
    intent_context: &str,
) -> Vec<CandidateEntity> {
    CandidateSelector::rank_candidates(candidates, intent_context)
}

pub fn filter_by_tenant(candidates: Vec<CandidateEntity>, tenant_id: Uuid) -> Vec<CandidateEntity> {
    CandidateSelector::filter_by_tenant(candidates, tenant_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_candidate(
        id: Uuid,
        title: &str,
        similarity_score: f32,
        entity_type: String,
    ) -> CandidateEntity {
        CandidateEntity {
            id,
            tenant_id: Uuid::new_v4(),
            entity_type,
            title: title.to_string(),
            description: None,
            status: None,
            priority: None,
            tags: vec![],
            metadata: std::collections::HashMap::new(),
            similarity_score,
            last_updated: chrono::Utc::now(),
            created_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_rank_candidates_basic_sorting() {
        let candidates = vec![
            create_test_candidate(Uuid::new_v4(), "Low Score", 0.3, "story".to_string()),
            create_test_candidate(Uuid::new_v4(), "High Score", 0.9, "story".to_string()),
            create_test_candidate(Uuid::new_v4(), "Medium Score", 0.6, "story".to_string()),
        ];

        let ranked = CandidateSelector::rank_candidates(candidates, "");

        assert_eq!(ranked[0].title, "High Score");
        assert_eq!(ranked[1].title, "Medium Score");
        assert_eq!(ranked[2].title, "Low Score");
    }

    #[test]
    fn test_context_boost() {
        let mut candidates = vec![
            create_test_candidate(Uuid::new_v4(), "User Story Ready", 0.5, "story".to_string()),
            create_test_candidate(Uuid::new_v4(), "Other Story", 0.6, "story".to_string()),
        ];

        CandidateSelector::apply_context_boost(&mut candidates, "move to ready");

        // The "User Story Ready" should get boosted because it contains "ready"
        assert!(candidates[0].similarity_score > 0.5);
        assert_eq!(candidates[1].similarity_score, 0.6); // No boost
    }

    #[test]
    fn test_type_priority() {
        let mut candidates = vec![
            create_test_candidate(Uuid::new_v4(), "Task Item", 0.5, "task".to_string()),
            create_test_candidate(Uuid::new_v4(), "Story Item", 0.5, "story".to_string()),
        ];

        CandidateSelector::apply_type_priority(&mut candidates, "create new story");

        // Story should get priority boost
        assert!(candidates[1].similarity_score > 0.5);
        assert_eq!(candidates[0].similarity_score, 0.5); // No boost
    }

    #[test]
    fn test_filter_by_tenant() {
        let tenant1 = Uuid::new_v4();
        let tenant2 = Uuid::new_v4();

        let mut candidates = vec![
            create_test_candidate(Uuid::new_v4(), "Story 1", 0.8, "story".to_string()),
            create_test_candidate(Uuid::new_v4(), "Story 2", 0.7, "story".to_string()),
        ];

        candidates[0].tenant_id = tenant1;
        candidates[1].tenant_id = tenant2;

        let filtered = CandidateSelector::filter_by_tenant(candidates, tenant1);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].title, "Story 1");
    }

    #[test]
    fn test_deduplicate_candidates() {
        let id = Uuid::new_v4();
        let candidates = vec![
            create_test_candidate(id, "Story 1", 0.8, "story".to_string()),
            create_test_candidate(id, "Story 1 Duplicate", 0.7, "story".to_string()), // Same ID
            create_test_candidate(Uuid::new_v4(), "Story 2", 0.6, "story".to_string()),
        ];

        let deduplicated = CandidateSelector::deduplicate_candidates(candidates);

        assert_eq!(deduplicated.len(), 2);
        assert_eq!(deduplicated[0].title, "Story 1"); // First occurrence kept
    }

    #[test]
    fn test_calculate_confidence_single_candidate() {
        let candidates = vec![create_test_candidate(
            Uuid::new_v4(),
            "Story",
            0.8,
            "story".to_string(),
        )];

        let confidence = CandidateSelector::calculate_confidence(&candidates);
        assert_eq!(confidence, 0.8);
    }

    #[test]
    fn test_calculate_confidence_multiple_candidates() {
        let candidates = vec![
            create_test_candidate(Uuid::new_v4(), "Story 1", 0.9, "story".to_string()),
            create_test_candidate(Uuid::new_v4(), "Story 2", 0.7, "story".to_string()),
        ];

        let confidence = CandidateSelector::calculate_confidence(&candidates);

        // Should be 0.9 + (0.2 * 0.2) = 0.94
        assert!((confidence - 0.94).abs() < 0.01);
    }

    #[test]
    fn test_calculate_confidence_empty() {
        let candidates = vec![];
        let confidence = CandidateSelector::calculate_confidence(&candidates);
        assert_eq!(confidence, 0.0);
    }
}
