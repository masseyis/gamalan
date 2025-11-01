use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Domain events for real-time WebSocket updates
/// These events represent state changes that should be broadcast to connected clients
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TaskEvent {
    /// Task ownership has been taken by a user
    OwnershipTaken {
        task_id: Uuid,
        story_id: Uuid,
        owner_user_id: Uuid,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    /// Task ownership has been released
    OwnershipReleased {
        task_id: Uuid,
        story_id: Uuid,
        previous_owner_user_id: Uuid,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
    /// Task status has changed
    StatusChanged {
        task_id: Uuid,
        story_id: Uuid,
        old_status: String,
        new_status: String,
        changed_by_user_id: Uuid,
        timestamp: chrono::DateTime<chrono::Utc>,
    },
}

impl TaskEvent {
    pub fn task_id(&self) -> Uuid {
        match self {
            TaskEvent::OwnershipTaken { task_id, .. }
            | TaskEvent::OwnershipReleased { task_id, .. }
            | TaskEvent::StatusChanged { task_id, .. } => *task_id,
        }
    }

    pub fn story_id(&self) -> Uuid {
        match self {
            TaskEvent::OwnershipTaken { story_id, .. }
            | TaskEvent::OwnershipReleased { story_id, .. }
            | TaskEvent::StatusChanged { story_id, .. } => *story_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_event_serialization() {
        let event = TaskEvent::OwnershipTaken {
            task_id: Uuid::new_v4(),
            story_id: Uuid::new_v4(),
            owner_user_id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
        };

        let json = serde_json::to_string(&event).expect("Failed to serialize");
        let deserialized: TaskEvent = serde_json::from_str(&json).expect("Failed to deserialize");

        assert_eq!(event.task_id(), deserialized.task_id());
    }

    #[test]
    fn test_ownership_released_event() {
        let task_id = Uuid::new_v4();
        let story_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let event = TaskEvent::OwnershipReleased {
            task_id,
            story_id,
            previous_owner_user_id: user_id,
            timestamp: chrono::Utc::now(),
        };

        assert_eq!(event.task_id(), task_id);
        assert_eq!(event.story_id(), story_id);
    }

    #[test]
    fn test_status_changed_event() {
        let task_id = Uuid::new_v4();
        let story_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let event = TaskEvent::StatusChanged {
            task_id,
            story_id,
            old_status: "available".to_string(),
            new_status: "inprogress".to_string(),
            changed_by_user_id: user_id,
            timestamp: chrono::Utc::now(),
        };

        assert_eq!(event.task_id(), task_id);
        assert_eq!(event.story_id(), story_id);
    }
}
