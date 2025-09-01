use context_orchestrator::domain::*;
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

#[cfg(test)]
mod candidate_selector_tests {
    use super::*;

    fn create_test_candidate(title: &str, similarity_score: f32, tenant_id: Uuid) -> CandidateEntity {
        CandidateEntity {
            id: Uuid::new_v4(),
            tenant_id,
            entity_type: "story".to_string(),
            title: title.to_string(),
            description: Some(format!("Description for {}", title)),
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score,
            last_updated: Utc::now(),
            created_at: Utc::now(),
        }
    }

    #[test]
    fn test_filter_by_tenant_single_tenant() {
        let tenant_id = Uuid::new_v4();
        let other_tenant_id = Uuid::new_v4();

        let candidates = vec![
            create_test_candidate("Story 1", 0.9, tenant_id),
            create_test_candidate("Story 2", 0.8, other_tenant_id), // Different tenant
            create_test_candidate("Story 3", 0.7, tenant_id),
        ];

        let filtered = candidate_selector::filter_by_tenant(candidates, tenant_id);

        assert_eq!(filtered.len(), 2);
        assert_eq!(filtered[0].title, "Story 1");
        assert_eq!(filtered[1].title, "Story 3");
        
        // Verify all returned candidates belong to the correct tenant
        for candidate in &filtered {
            assert_eq!(candidate.tenant_id, tenant_id);
        }
    }

    #[test]
    fn test_filter_by_tenant_empty_list() {
        let tenant_id = Uuid::new_v4();
        let candidates = vec![];

        let filtered = candidate_selector::filter_by_tenant(candidates, tenant_id);

        assert_eq!(filtered.len(), 0);
    }

    #[test]
    fn test_filter_by_tenant_no_matches() {
        let tenant_id = Uuid::new_v4();
        let other_tenant_id = Uuid::new_v4();

        let candidates = vec![
            create_test_candidate("Story 1", 0.9, other_tenant_id),
            create_test_candidate("Story 2", 0.8, other_tenant_id),
        ];

        let filtered = candidate_selector::filter_by_tenant(candidates, tenant_id);

        assert_eq!(filtered.len(), 0);
    }

    #[test]
    fn test_rank_candidates_by_similarity() {
        let tenant_id = Uuid::new_v4();
        let candidates = vec![
            create_test_candidate("Low Score Story", 0.3, tenant_id),
            create_test_candidate("High Score Story", 0.9, tenant_id),
            create_test_candidate("Medium Score Story", 0.6, tenant_id),
        ];

        let ranked = candidate_selector::rank_candidates(candidates, "story");

        // Should be sorted by similarity score descending
        assert_eq!(ranked.len(), 3);
        assert_eq!(ranked[0].title, "High Score Story");
        assert_eq!(ranked[0].similarity_score, 0.9);
        assert_eq!(ranked[1].title, "Medium Score Story");
        assert_eq!(ranked[1].similarity_score, 0.6);
        assert_eq!(ranked[2].title, "Low Score Story");
        assert_eq!(ranked[2].similarity_score, 0.3);
    }

    #[test]
    fn test_rank_candidates_with_title_boost() {
        let tenant_id = Uuid::new_v4();
        
        // Create candidates where exact title match has lower similarity
        let mut exact_match = create_test_candidate("Update Story", 0.5, tenant_id);
        let partial_match = create_test_candidate("Story Update Process", 0.7, tenant_id);
        let no_match = create_test_candidate("Different Title", 0.9, tenant_id);

        let candidates = vec![exact_match.clone(), partial_match, no_match];
        let ranked = candidate_selector::rank_candidates(candidates, "Update Story");

        // The exact match should be boosted and ranked higher despite lower similarity
        assert_eq!(ranked[0].title, "Update Story");
        // Verify that boost was applied (should be > 0.5 but still reasonable)
        assert!(ranked[0].similarity_score > 0.5);
        assert!(ranked[0].similarity_score <= 1.0);
    }

    #[test]
    fn test_rank_candidates_empty_query() {
        let tenant_id = Uuid::new_v4();
        let candidates = vec![
            create_test_candidate("Story A", 0.8, tenant_id),
            create_test_candidate("Story B", 0.6, tenant_id),
        ];

        let ranked = candidate_selector::rank_candidates(candidates, "");

        // Should still be sorted by similarity score
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].title, "Story A");
        assert_eq!(ranked[1].title, "Story B");
    }

    #[test]
    fn test_rank_candidates_preserves_original_data() {
        let tenant_id = Uuid::new_v4();
        let original_id = Uuid::new_v4();
        
        let mut candidate = create_test_candidate("Test Story", 0.7, tenant_id);
        candidate.id = original_id;
        candidate.priority = Some(3);
        candidate.tags = vec!["important".to_string()];

        let candidates = vec![candidate];
        let ranked = candidate_selector::rank_candidates(candidates, "story");

        assert_eq!(ranked.len(), 1);
        assert_eq!(ranked[0].id, original_id);
        assert_eq!(ranked[0].tenant_id, tenant_id);
        assert_eq!(ranked[0].priority, Some(3));
        assert_eq!(ranked[0].tags, vec!["important".to_string()]);
    }
}

#[cfg(test)]
mod boost_logic_tests {
    use super::*;

    #[test]
    fn test_title_matching_boost() {
        let tenant_id = Uuid::new_v4();
        
        // Test various levels of title matching
        let exact_match = create_test_candidate("Update Story Status", 0.5, tenant_id);
        let partial_match = create_test_candidate("Story Status Update", 0.5, tenant_id);
        let word_match = create_test_candidate("Update Task", 0.5, tenant_id);
        let no_match = create_test_candidate("Different Title", 0.5, tenant_id);

        let candidates = vec![
            exact_match.clone(),
            partial_match.clone(), 
            word_match.clone(),
            no_match.clone(),
        ];

        let ranked = candidate_selector::rank_candidates(candidates, "Update Story Status");

        // Verify ranking order based on title relevance
        assert_eq!(ranked[0].title, "Update Story Status"); // Exact match should be first
        
        // All boosted scores should still be <= 1.0
        for candidate in &ranked {
            assert!(candidate.similarity_score <= 1.0);
            assert!(candidate.similarity_score >= 0.0);
        }
    }

    #[test]
    fn test_boost_doesnt_exceed_maximum() {
        let tenant_id = Uuid::new_v4();
        
        // Start with very high similarity score
        let high_similarity = create_test_candidate("Perfect Match", 0.95, tenant_id);
        let candidates = vec![high_similarity];

        let ranked = candidate_selector::rank_candidates(candidates, "Perfect Match");

        // Even with boost, should not exceed 1.0
        assert!(ranked[0].similarity_score <= 1.0);
        assert!(ranked[0].similarity_score >= 0.95); // Should be boosted but capped
    }

    #[test]
    fn test_case_insensitive_matching() {
        let tenant_id = Uuid::new_v4();
        
        let candidate = create_test_candidate("Update Story Status", 0.5, tenant_id);
        let candidates = vec![candidate];

        // Test with different cases
        let ranked_lower = candidate_selector::rank_candidates(candidates.clone(), "update story status");
        let ranked_upper = candidate_selector::rank_candidates(candidates.clone(), "UPDATE STORY STATUS");
        let ranked_mixed = candidate_selector::rank_candidates(candidates.clone(), "Update STORY status");

        // All should receive similar boosts regardless of case
        assert!(ranked_lower[0].similarity_score > 0.5);
        assert!(ranked_upper[0].similarity_score > 0.5);
        assert!(ranked_mixed[0].similarity_score > 0.5);
    }
}

#[cfg(test)]
mod performance_tests {
    use super::*;

    #[test]
    fn test_large_candidate_list_performance() {
        let tenant_id = Uuid::new_v4();
        
        // Create a large list of candidates
        let mut candidates = Vec::new();
        for i in 0..1000 {
            candidates.push(create_test_candidate(
                &format!("Story {}", i), 
                (i as f32) / 1000.0, 
                tenant_id
            ));
        }

        let start = std::time::Instant::now();
        let filtered = candidate_selector::filter_by_tenant(candidates, tenant_id);
        let filter_duration = start.elapsed();

        let start = std::time::Instant::now();
        let _ranked = candidate_selector::rank_candidates(filtered, "Story 500");
        let rank_duration = start.elapsed();

        // Performance should be reasonable (under 100ms for 1000 items)
        assert!(filter_duration.as_millis() < 100, "Filtering took too long: {:?}", filter_duration);
        assert!(rank_duration.as_millis() < 100, "Ranking took too long: {:?}", rank_duration);
    }

    #[test]
    fn test_rank_candidates_stability() {
        let tenant_id = Uuid::new_v4();
        
        // Create candidates with identical similarity scores
        let candidates = vec![
            create_test_candidate("Story A", 0.5, tenant_id),
            create_test_candidate("Story B", 0.5, tenant_id),
            create_test_candidate("Story C", 0.5, tenant_id),
        ];

        let ranked1 = candidate_selector::rank_candidates(candidates.clone(), "test");
        let ranked2 = candidate_selector::rank_candidates(candidates.clone(), "test");

        // Results should be consistent (stable sort)
        assert_eq!(ranked1.len(), ranked2.len());
        for (i, (c1, c2)) in ranked1.iter().zip(ranked2.iter()).enumerate() {
            assert_eq!(c1.id, c2.id, "Candidate order changed at index {}", i);
        }
    }
}