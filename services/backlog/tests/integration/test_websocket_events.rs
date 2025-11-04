use backlog::adapters::websocket::WebSocketManager;
use backlog::domain::TaskEvent;
use uuid::Uuid;

#[tokio::test]
async fn test_websocket_manager_broadcasts_ownership_taken() {
    // Create WebSocket manager
    let ws_manager = WebSocketManager::new(100);

    // Subscribe to events
    let mut rx = ws_manager.subscribe();

    // Create test data
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let owner_user_id = Uuid::new_v4();

    // Broadcast ownership taken event
    let event = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id,
        timestamp: chrono::Utc::now(),
    };
    ws_manager.broadcast(event.clone());

    // Verify event received
    let received = rx.recv().await.expect("Failed to receive event");
    assert_eq!(received.task_id(), task_id);
    assert_eq!(received.story_id(), story_id);

    match received {
        TaskEvent::OwnershipTaken {
            task_id: recv_task_id,
            owner_user_id: recv_owner,
            ..
        } => {
            assert_eq!(recv_task_id, task_id);
            assert_eq!(recv_owner, owner_user_id);
        }
        _ => panic!("Expected OwnershipTaken event"),
    }
}

#[tokio::test]
async fn test_websocket_manager_broadcasts_ownership_released() {
    // Create WebSocket manager
    let ws_manager = WebSocketManager::new(100);

    // Subscribe to events
    let mut rx = ws_manager.subscribe();

    // Create test data
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let previous_owner_user_id = Uuid::new_v4();

    // Broadcast ownership released event
    let event = TaskEvent::OwnershipReleased {
        task_id,
        story_id,
        previous_owner_user_id,
        timestamp: chrono::Utc::now(),
    };
    ws_manager.broadcast(event.clone());

    // Verify event received
    let received = rx.recv().await.expect("Failed to receive event");
    assert_eq!(received.task_id(), task_id);
    assert_eq!(received.story_id(), story_id);

    match received {
        TaskEvent::OwnershipReleased {
            task_id: recv_task_id,
            previous_owner_user_id: recv_prev_owner,
            ..
        } => {
            assert_eq!(recv_task_id, task_id);
            assert_eq!(recv_prev_owner, previous_owner_user_id);
        }
        _ => panic!("Expected OwnershipReleased event"),
    }
}

#[tokio::test]
async fn test_websocket_manager_broadcasts_status_changed() {
    // Create WebSocket manager
    let ws_manager = WebSocketManager::new(100);

    // Subscribe to events
    let mut rx = ws_manager.subscribe();

    // Create test data
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let changed_by_user_id = Uuid::new_v4();
    let old_status = "available".to_string();
    let new_status = "inprogress".to_string();

    // Broadcast status changed event
    let event = TaskEvent::StatusChanged {
        task_id,
        story_id,
        old_status: old_status.clone(),
        new_status: new_status.clone(),
        changed_by_user_id,
        timestamp: chrono::Utc::now(),
    };
    ws_manager.broadcast(event.clone());

    // Verify event received
    let received = rx.recv().await.expect("Failed to receive event");
    assert_eq!(received.task_id(), task_id);
    assert_eq!(received.story_id(), story_id);

    match received {
        TaskEvent::StatusChanged {
            task_id: recv_task_id,
            old_status: recv_old,
            new_status: recv_new,
            changed_by_user_id: recv_changed_by,
            ..
        } => {
            assert_eq!(recv_task_id, task_id);
            assert_eq!(recv_old, old_status);
            assert_eq!(recv_new, new_status);
            assert_eq!(recv_changed_by, changed_by_user_id);
        }
        _ => panic!("Expected StatusChanged event"),
    }
}

#[tokio::test]
async fn test_websocket_manager_multiple_subscribers() {
    // Create WebSocket manager
    let ws_manager = WebSocketManager::new(100);

    // Subscribe multiple times
    let mut rx1 = ws_manager.subscribe();
    let mut rx2 = ws_manager.subscribe();
    let mut rx3 = ws_manager.subscribe();

    // Create test data
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let owner_user_id = Uuid::new_v4();

    // Broadcast event
    let event = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id,
        timestamp: chrono::Utc::now(),
    };
    ws_manager.broadcast(event.clone());

    // Verify all subscribers receive the event
    let received1 = rx1.recv().await.expect("Subscriber 1 failed to receive");
    let received2 = rx2.recv().await.expect("Subscriber 2 failed to receive");
    let received3 = rx3.recv().await.expect("Subscriber 3 failed to receive");

    assert_eq!(received1.task_id(), task_id);
    assert_eq!(received2.task_id(), task_id);
    assert_eq!(received3.task_id(), task_id);
}

#[tokio::test]
async fn test_websocket_event_serialization() {
    // Test that events can be serialized/deserialized for WebSocket transmission
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let owner_user_id = Uuid::new_v4();

    let event = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id,
        timestamp: chrono::Utc::now(),
    };

    // Serialize
    let json = serde_json::to_string(&event).expect("Failed to serialize");
    assert!(json.contains("ownership_taken"));
    assert!(json.contains(&task_id.to_string()));

    // Deserialize
    let deserialized: TaskEvent = serde_json::from_str(&json).expect("Failed to deserialize");
    assert_eq!(deserialized.task_id(), task_id);
    assert_eq!(deserialized.story_id(), story_id);
}
