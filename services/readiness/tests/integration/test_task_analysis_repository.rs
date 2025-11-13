// Integration tests for TaskAnalysisRepository
// Tests the persistence layer for saving and retrieving task analyses

use readiness::application::ports::TaskAnalysisRepository;
use readiness::domain::{GapType, Recommendation, TaskAnalysis};
use serial_test::serial;
use sqlx::Row;
use uuid::Uuid;

use crate::common::{create_simple_test_task, create_test_story, setup_test_db};

#[tokio::test]
#[serial]
async fn test_save_analysis_stores_in_database() {
    // RED: Write test that should fail
    // Given: A task analysis with recommendations
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Test Story", Some("Test description")).await;
    let task_id = create_simple_test_task(
        &pool,
        story_id,
        org_id,
        "Test Task",
        Some("Task description"),
    )
    .await;

    let analysis = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id,
        story_id,
        organization_id: Some(org_id),
        clarity_score: 65,
        missing_elements: vec!["File paths".to_string(), "Test coverage".to_string()],
        summary: "Task needs more technical details".to_string(),
        recommendations: vec![
            Recommendation {
                gap_type: GapType::MissingTechnicalDetails,
                message: "Add file paths to modify".to_string(),
                specific_suggestions: vec!["Specify src/services/readiness/...".to_string()],
                ac_references: vec!["AC1".to_string()],
            },
            Recommendation {
                gap_type: GapType::MissingTestCoverage,
                message: "Define test coverage expectations".to_string(),
                specific_suggestions: vec!["Add unit and integration tests".to_string()],
                ac_references: vec!["AC2".to_string()],
            },
        ],
    };

    // When: Saving the analysis
    let result = pool.save_analysis(&analysis).await;

    // Then: Should succeed
    assert!(result.is_ok(), "save_analysis should succeed");

    // Verify the analysis was stored by querying directly
    let row = sqlx::query(
        "SELECT task_id, story_id, organization_id, analysis_json FROM task_analyses WHERE task_id = $1"
    )
    .bind(task_id)
    .fetch_one(&pool)
    .await
    .expect("Should find saved analysis");

    let saved_task_id: Uuid = row.get("task_id");
    let saved_story_id: Uuid = row.get("story_id");
    let saved_org_id: Option<Uuid> = row.get("organization_id");

    assert_eq!(saved_task_id, task_id);
    assert_eq!(saved_story_id, story_id);
    assert_eq!(saved_org_id, Some(org_id));

    // Verify JSON structure contains our data
    let analysis_json: serde_json::Value = row.get("analysis_json");
    assert_eq!(analysis_json["task_id"], task_id.to_string());
    assert_eq!(analysis_json["clarity_score"], 65);
    assert!(analysis_json["recommendations"].is_array());
    assert_eq!(
        analysis_json["recommendations"].as_array().unwrap().len(),
        2
    );
}

#[tokio::test]
#[serial]
async fn test_save_analysis_handles_minimal_data() {
    // Given: A minimal analysis with no recommendations
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", None).await;
    let task_id = create_simple_test_task(&pool, story_id, org_id, "Task", None).await;

    let analysis = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id,
        story_id,
        organization_id: Some(org_id),
        clarity_score: 100,
        missing_elements: vec![],
        summary: "Task is well-defined".to_string(),
        recommendations: vec![],
    };

    // When: Saving the minimal analysis
    let result = pool.save_analysis(&analysis).await;

    // Then: Should succeed
    assert!(result.is_ok(), "Should save minimal analysis");

    // Verify stored
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM task_analyses WHERE task_id = $1")
        .bind(task_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(count.0, 1, "Should have one analysis record");
}

#[tokio::test]
#[serial]
async fn test_save_analysis_supports_null_organization() {
    // Given: An analysis with no organization
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", None).await;
    let task_id = create_simple_test_task(&pool, story_id, org_id, "Task", None).await;

    let analysis = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id,
        story_id,
        organization_id: None, // No organization
        clarity_score: 75,
        missing_elements: vec![],
        summary: "Test".to_string(),
        recommendations: vec![],
    };

    // When: Saving analysis with null org_id
    let result = pool.save_analysis(&analysis).await;

    // Then: Should succeed
    assert!(result.is_ok());

    let row = sqlx::query("SELECT organization_id FROM task_analyses WHERE task_id = $1")
        .bind(task_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    let org_id: Option<Uuid> = row.get("organization_id");
    assert_eq!(org_id, None);
}

#[tokio::test]
#[serial]
async fn test_get_latest_analysis_returns_most_recent() {
    // Given: Multiple analyses for the same task
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", None).await;
    let task_id = create_simple_test_task(&pool, story_id, org_id, "Task", None).await;

    // Save first analysis
    let analysis1 = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id,
        story_id,
        organization_id: Some(org_id),
        clarity_score: 50,
        missing_elements: vec!["Many things missing".to_string()],
        summary: "First analysis".to_string(),
        recommendations: vec![],
    };
    pool.save_analysis(&analysis1).await.unwrap();

    // Wait a bit to ensure different timestamps
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    // Save second analysis (more recent)
    let analysis2 = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id,
        story_id,
        organization_id: Some(org_id),
        clarity_score: 75,
        missing_elements: vec![],
        summary: "Second analysis - improved".to_string(),
        recommendations: vec![],
    };
    pool.save_analysis(&analysis2).await.unwrap();

    // When: Retrieving latest analysis
    let result = pool.get_latest_analysis(task_id, Some(org_id)).await;

    // Then: Should return the most recent one
    assert!(result.is_ok());
    let latest = result.unwrap();
    assert!(latest.is_some());

    let latest_analysis = latest.unwrap();
    assert_eq!(latest_analysis.clarity_score, 75);
    assert_eq!(latest_analysis.summary, "Second analysis - improved");
}

#[tokio::test]
#[serial]
async fn test_get_latest_analysis_returns_none_when_not_found() {
    // Given: A task with no analysis
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let non_existent_task_id = Uuid::new_v4();

    // When: Retrieving analysis for non-existent task
    let result = pool
        .get_latest_analysis(non_existent_task_id, Some(org_id))
        .await;

    // Then: Should return None
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[tokio::test]
#[serial]
async fn test_get_latest_analysis_respects_organization_isolation() {
    // Given: Analyses for same task in different organizations
    let pool = setup_test_db().await;
    let org1_id = Uuid::new_v4();
    let org2_id = Uuid::new_v4();

    let story1_id = create_test_story(&pool, org1_id, "Org1 Story", None).await;
    let task1_id = create_simple_test_task(&pool, story1_id, org1_id, "Org1 Task", None).await;

    let story2_id = create_test_story(&pool, org2_id, "Org2 Story", None).await;
    let task2_id = create_simple_test_task(&pool, story2_id, org2_id, "Org2 Task", None).await;

    // Save analysis for org1
    let analysis_org1 = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id: task1_id,
        story_id: story1_id,
        organization_id: Some(org1_id),
        clarity_score: 80,
        missing_elements: vec![],
        summary: "Org1 analysis".to_string(),
        recommendations: vec![],
    };
    pool.save_analysis(&analysis_org1).await.unwrap();

    // Save analysis for org2
    let analysis_org2 = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id: task2_id,
        story_id: story2_id,
        organization_id: Some(org2_id),
        clarity_score: 60,
        missing_elements: vec![],
        summary: "Org2 analysis".to_string(),
        recommendations: vec![],
    };
    pool.save_analysis(&analysis_org2).await.unwrap();

    // When: Retrieving org1's analysis with org1 context
    let result1 = pool.get_latest_analysis(task1_id, Some(org1_id)).await;

    // Then: Should get org1's analysis
    assert!(result1.is_ok());
    let analysis1 = result1.unwrap().unwrap();
    assert_eq!(analysis1.summary, "Org1 analysis");

    // When: Attempting to retrieve org1's task with org2 context
    let result_wrong_org = pool.get_latest_analysis(task1_id, Some(org2_id)).await;

    // Then: Should not find it (organization isolation)
    assert!(result_wrong_org.is_ok());
    assert!(result_wrong_org.unwrap().is_none());
}

#[tokio::test]
#[serial]
async fn test_save_analysis_preserves_all_gap_types() {
    // Given: An analysis with all gap types
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", None).await;
    let task_id = create_simple_test_task(&pool, story_id, org_id, "Task", None).await;

    let all_gap_types = [
        GapType::MissingTechnicalDetails,
        GapType::VagueLanguage,
        GapType::MissingAcceptanceCriteria,
        GapType::MissingAiAgentCompatibility,
        GapType::MissingSuccessCriteria,
        GapType::MissingDependencies,
        GapType::MissingEnvironmentSetup,
        GapType::MissingTestCoverage,
        GapType::MissingDefinitionOfDone,
    ];

    let recommendations: Vec<Recommendation> = all_gap_types
        .iter()
        .map(|gap_type| Recommendation {
            gap_type: gap_type.clone(),
            message: format!("Recommendation for {:?}", gap_type),
            specific_suggestions: vec![format!("Suggestion for {:?}", gap_type)],
            ac_references: vec![],
        })
        .collect();

    let analysis = TaskAnalysis {
        id: Uuid::new_v4(),
        task_id,
        story_id,
        organization_id: Some(org_id),
        clarity_score: 40,
        missing_elements: vec![],
        summary: "Analysis with all gap types".to_string(),
        recommendations,
    };

    // When: Saving and retrieving
    pool.save_analysis(&analysis).await.unwrap();
    let retrieved = pool
        .get_latest_analysis(task_id, Some(org_id))
        .await
        .unwrap()
        .unwrap();

    // Then: All gap types should be preserved
    assert_eq!(retrieved.recommendations.len(), 9);
    for (original, retrieved_rec) in analysis
        .recommendations
        .iter()
        .zip(retrieved.recommendations.iter())
    {
        assert_eq!(
            format!("{:?}", original.gap_type),
            format!("{:?}", retrieved_rec.gap_type)
        );
    }
}

#[tokio::test]
#[serial]
async fn test_save_multiple_analyses_same_task_creates_history() {
    // Given: Saving 3 analyses for the same task
    let pool = setup_test_db().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", None).await;
    let task_id = create_simple_test_task(&pool, story_id, org_id, "Task", None).await;

    for i in 1..=3 {
        let analysis = TaskAnalysis {
            id: Uuid::new_v4(),
            task_id,
            story_id,
            organization_id: Some(org_id),
            clarity_score: i * 20,
            missing_elements: vec![],
            summary: format!("Analysis {}", i),
            recommendations: vec![],
        };
        pool.save_analysis(&analysis).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }

    // When: Counting all analyses for the task
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM task_analyses WHERE task_id = $1")
        .bind(task_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Then: Should have all 3
    assert_eq!(count.0, 3);

    // And: get_latest_analysis should return the most recent
    let latest = pool
        .get_latest_analysis(task_id, Some(org_id))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(latest.summary, "Analysis 3");
    assert_eq!(latest.clarity_score, 60);
}
