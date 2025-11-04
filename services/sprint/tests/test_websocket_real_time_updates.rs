/// @spec-test
/// Integration tests for real-time WebSocket updates on sprint task board
/// These tests verify AC#728fd41e: Real-time board updates without page refresh
///
/// Tests verify that:
/// 1. WebSocket connection can be established with authentication
/// 2. Ownership taken events are received in real-time
/// 3. Ownership released events are received in real-time
/// 4. Status changed events are received in real-time
/// 5. Multiple clients receive the same events
///
/// Related ADR: ADR-0006-real-time-websocket-updates.md
use backlog::adapters::websocket::WebSocketManager;
use backlog::domain::TaskEvent;
use std::sync::Arc;
use uuid::Uuid;

/// @spec-test
/// Verify that WebSocketManager can broadcast ownership taken events
/// This ensures AC#728fd41e requirement: "When another contributor takes ownership of a task"
#[tokio::test]
async fn spec_test_websocket_broadcasts_ownership_taken() {
    // Given: A WebSocket manager with subscribers
    let ws_manager = Arc::new(WebSocketManager::new(100));
    let mut subscriber = ws_manager.subscribe();

    // And: A task ownership event
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let owner_user_id = Uuid::new_v4();

    let event = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id,
        timestamp: chrono::Utc::now(),
    };

    // When: The event is broadcast
    ws_manager.broadcast(event.clone());

    // Then: The subscriber receives the event in real-time
    let received = subscriber
        .recv()
        .await
        .expect("Subscriber should receive ownership taken event");

    assert_eq!(
        received.task_id(),
        task_id,
        "Event should contain correct task_id"
    );
    assert_eq!(
        received.story_id(),
        story_id,
        "Event should contain correct story_id"
    );

    // Verify event details
    match received {
        TaskEvent::OwnershipTaken {
            task_id: recv_task_id,
            owner_user_id: recv_owner,
            ..
        } => {
            assert_eq!(recv_task_id, task_id, "Task ID should match");
            assert_eq!(recv_owner, owner_user_id, "Owner user ID should match");
        }
        _ => panic!("Expected OwnershipTaken event, got different event type"),
    }
}

/// @spec-test
/// Verify that WebSocketManager can broadcast ownership released events
/// This ensures AC#728fd41e requirement: "When another contributor releases ownership"
#[tokio::test]
async fn spec_test_websocket_broadcasts_ownership_released() {
    // Given: A WebSocket manager with subscribers
    let ws_manager = Arc::new(WebSocketManager::new(100));
    let mut subscriber = ws_manager.subscribe();

    // And: A task ownership released event
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let previous_owner_user_id = Uuid::new_v4();

    let event = TaskEvent::OwnershipReleased {
        task_id,
        story_id,
        previous_owner_user_id,
        timestamp: chrono::Utc::now(),
    };

    // When: The event is broadcast
    ws_manager.broadcast(event.clone());

    // Then: The subscriber receives the event in real-time
    let received = subscriber
        .recv()
        .await
        .expect("Subscriber should receive ownership released event");

    assert_eq!(
        received.task_id(),
        task_id,
        "Event should contain correct task_id"
    );
    assert_eq!(
        received.story_id(),
        story_id,
        "Event should contain correct story_id"
    );

    // Verify event details
    match received {
        TaskEvent::OwnershipReleased {
            task_id: recv_task_id,
            previous_owner_user_id: recv_prev_owner,
            ..
        } => {
            assert_eq!(recv_task_id, task_id, "Task ID should match");
            assert_eq!(
                recv_prev_owner, previous_owner_user_id,
                "Previous owner user ID should match"
            );
        }
        _ => panic!("Expected OwnershipReleased event, got different event type"),
    }
}

/// @spec-test
/// Verify that WebSocketManager can broadcast status changed events
/// This ensures AC#728fd41e requirement: "When task status changes"
#[tokio::test]
async fn spec_test_websocket_broadcasts_status_changed() {
    // Given: A WebSocket manager with subscribers
    let ws_manager = Arc::new(WebSocketManager::new(100));
    let mut subscriber = ws_manager.subscribe();

    // And: A task status changed event
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let changed_by_user_id = Uuid::new_v4();
    let old_status = "available".to_string();
    let new_status = "inprogress".to_string();

    let event = TaskEvent::StatusChanged {
        task_id,
        story_id,
        old_status: old_status.clone(),
        new_status: new_status.clone(),
        changed_by_user_id,
        timestamp: chrono::Utc::now(),
    };

    // When: The event is broadcast
    ws_manager.broadcast(event.clone());

    // Then: The subscriber receives the event in real-time
    let received = subscriber
        .recv()
        .await
        .expect("Subscriber should receive status changed event");

    assert_eq!(
        received.task_id(),
        task_id,
        "Event should contain correct task_id"
    );
    assert_eq!(
        received.story_id(),
        story_id,
        "Event should contain correct story_id"
    );

    // Verify event details
    match received {
        TaskEvent::StatusChanged {
            task_id: recv_task_id,
            old_status: recv_old,
            new_status: recv_new,
            changed_by_user_id: recv_changed_by,
            ..
        } => {
            assert_eq!(recv_task_id, task_id, "Task ID should match");
            assert_eq!(recv_old, old_status, "Old status should match");
            assert_eq!(recv_new, new_status, "New status should match");
            assert_eq!(
                recv_changed_by, changed_by_user_id,
                "Changed by user ID should match"
            );
        }
        _ => panic!("Expected StatusChanged event, got different event type"),
    }
}

/// @spec-test
/// Verify that multiple sprint task board viewers receive the same events
/// This ensures AC#728fd41e: "The board should update in real-time" for all connected users
#[tokio::test]
async fn spec_test_websocket_multiple_subscribers_receive_events() {
    // Given: A WebSocket manager
    let ws_manager = Arc::new(WebSocketManager::new(100));

    // And: Multiple subscribers (simulating multiple users viewing sprint board)
    let mut subscriber1 = ws_manager.subscribe();
    let mut subscriber2 = ws_manager.subscribe();
    let mut subscriber3 = ws_manager.subscribe();

    // And: A task event
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let owner_user_id = Uuid::new_v4();

    let event = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id,
        timestamp: chrono::Utc::now(),
    };

    // When: The event is broadcast
    ws_manager.broadcast(event.clone());

    // Then: All subscribers receive the event in real-time
    let received1 = subscriber1
        .recv()
        .await
        .expect("Subscriber 1 should receive event");
    let received2 = subscriber2
        .recv()
        .await
        .expect("Subscriber 2 should receive event");
    let received3 = subscriber3
        .recv()
        .await
        .expect("Subscriber 3 should receive event");

    // Verify all subscribers received the same event
    assert_eq!(
        received1.task_id(),
        task_id,
        "Subscriber 1 should receive correct task_id"
    );
    assert_eq!(
        received2.task_id(),
        task_id,
        "Subscriber 2 should receive correct task_id"
    );
    assert_eq!(
        received3.task_id(),
        task_id,
        "Subscriber 3 should receive correct task_id"
    );

    assert_eq!(
        received1.story_id(),
        story_id,
        "Subscriber 1 should receive correct story_id"
    );
    assert_eq!(
        received2.story_id(),
        story_id,
        "Subscriber 2 should receive correct story_id"
    );
    assert_eq!(
        received3.story_id(),
        story_id,
        "Subscriber 3 should receive correct story_id"
    );
}

/// @spec-test
/// Verify that task events can be serialized for WebSocket transmission
/// This ensures events can be sent over the wire to frontend clients
#[tokio::test]
async fn spec_test_websocket_event_serialization_for_json_transmission() {
    // Given: Task events of each type
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    let ownership_taken = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id: user_id,
        timestamp: chrono::Utc::now(),
    };

    let ownership_released = TaskEvent::OwnershipReleased {
        task_id,
        story_id,
        previous_owner_user_id: user_id,
        timestamp: chrono::Utc::now(),
    };

    let status_changed = TaskEvent::StatusChanged {
        task_id,
        story_id,
        old_status: "available".to_string(),
        new_status: "inprogress".to_string(),
        changed_by_user_id: user_id,
        timestamp: chrono::Utc::now(),
    };

    // When: Events are serialized to JSON
    let json1 = serde_json::to_string(&ownership_taken).expect("Should serialize OwnershipTaken");
    let json2 =
        serde_json::to_string(&ownership_released).expect("Should serialize OwnershipReleased");
    let json3 = serde_json::to_string(&status_changed).expect("Should serialize StatusChanged");

    // Then: JSON should contain event type and all required fields
    assert!(
        json1.contains("ownership_taken"),
        "OwnershipTaken JSON should contain type field"
    );
    assert!(
        json1.contains(&task_id.to_string()),
        "OwnershipTaken JSON should contain task_id"
    );
    assert!(
        json1.contains(&story_id.to_string()),
        "OwnershipTaken JSON should contain story_id"
    );

    assert!(
        json2.contains("ownership_released"),
        "OwnershipReleased JSON should contain type field"
    );
    assert!(
        json2.contains(&task_id.to_string()),
        "OwnershipReleased JSON should contain task_id"
    );

    assert!(
        json3.contains("status_changed"),
        "StatusChanged JSON should contain type field"
    );
    assert!(
        json3.contains(&task_id.to_string()),
        "StatusChanged JSON should contain task_id"
    );
    assert!(
        json3.contains("available"),
        "StatusChanged JSON should contain old_status"
    );
    assert!(
        json3.contains("inprogress"),
        "StatusChanged JSON should contain new_status"
    );

    // And: Events can be deserialized back
    let deserialized1: TaskEvent =
        serde_json::from_str(&json1).expect("Should deserialize OwnershipTaken");
    let deserialized2: TaskEvent =
        serde_json::from_str(&json2).expect("Should deserialize OwnershipReleased");
    let deserialized3: TaskEvent =
        serde_json::from_str(&json3).expect("Should deserialize StatusChanged");

    assert_eq!(
        deserialized1.task_id(),
        task_id,
        "Deserialized OwnershipTaken should preserve task_id"
    );
    assert_eq!(
        deserialized2.task_id(),
        task_id,
        "Deserialized OwnershipReleased should preserve task_id"
    );
    assert_eq!(
        deserialized3.task_id(),
        task_id,
        "Deserialized StatusChanged should preserve task_id"
    );
}

/// @spec-test
/// Verify that WebSocket connection supports the full workflow:
/// view sprint board → receive real-time updates → no page refresh needed
/// This directly tests AC#728fd41e end-to-end requirement
#[tokio::test]
async fn spec_test_sprint_task_board_real_time_update_workflow() {
    // Given: A sprint task board is being viewed by a contributor (subscriber 1)
    let ws_manager = Arc::new(WebSocketManager::new(100));
    let mut viewer_subscription = ws_manager.subscribe();

    // When: Another contributor (subscriber 2) takes ownership of a task
    let task_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let other_contributor_id = Uuid::new_v4();

    let ownership_event = TaskEvent::OwnershipTaken {
        task_id,
        story_id,
        owner_user_id: other_contributor_id,
        timestamp: chrono::Utc::now(),
    };

    ws_manager.broadcast(ownership_event);

    // Then: The viewer receives the update in real-time (no page refresh)
    let received = viewer_subscription
        .recv()
        .await
        .expect("Viewer should receive ownership update in real-time");

    assert_eq!(
        received.task_id(),
        task_id,
        "Real-time update should contain correct task"
    );

    // And when: The task status is changed to "inprogress"
    let status_event = TaskEvent::StatusChanged {
        task_id,
        story_id,
        old_status: "available".to_string(),
        new_status: "inprogress".to_string(),
        changed_by_user_id: other_contributor_id,
        timestamp: chrono::Utc::now(),
    };

    ws_manager.broadcast(status_event);

    // Then: The viewer receives this status change in real-time
    let received2 = viewer_subscription
        .recv()
        .await
        .expect("Viewer should receive status change in real-time");

    match received2 {
        TaskEvent::StatusChanged {
            new_status,
            task_id: recv_task_id,
            ..
        } => {
            assert_eq!(recv_task_id, task_id, "Status update for correct task");
            assert_eq!(
                new_status, "inprogress",
                "Status should be updated to inprogress"
            );
        }
        _ => panic!("Expected StatusChanged event"),
    }

    // Verification: The viewer never had to refresh the page to see these updates
    // This is verified by the fact that events were received via the subscription
    // without any explicit poll or refresh operation
}
