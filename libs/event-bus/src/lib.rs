use async_trait::async_trait;
use chrono::{DateTime, Utc};
use pubsub::PubSub;
use serde::{Deserialize, Serialize};

use std::sync::Arc;
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver},
    Mutex,
};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptanceCriterionRecord {
    pub id: Uuid,
    pub story_id: Uuid,
    pub description: String,
    pub given: String,
    pub when: String,
    pub then: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryRecord {
    pub id: Uuid,
    pub project_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub labels: Vec<String>,
    pub acceptance_criteria: Vec<AcceptanceCriterionRecord>,
    pub story_points: Option<u32>,
    pub sprint_id: Option<Uuid>,
    pub assigned_to_user_id: Option<Uuid>,
    pub readiness_override: bool,
    pub readiness_override_by: Option<Uuid>,
    pub readiness_override_reason: Option<String>,
    pub readiness_override_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRecord {
    pub id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
    pub status: String,
    pub owner_user_id: Option<Uuid>,
    pub estimated_hours: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub owned_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BacklogEvent {
    StoryCreated {
        story: StoryRecord,
    },
    StoryUpdated {
        story: StoryRecord,
    },
    StoryDeleted {
        story_id: Uuid,
        organization_id: Option<Uuid>,
    },
    TaskCreated {
        task: TaskRecord,
    },
    TaskUpdated {
        task: TaskRecord,
    },
    TaskDeleted {
        task_id: Uuid,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprintRecord {
    pub id: Uuid,
    pub team_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub name: String,
    pub goal: Option<String>,
    pub capacity_points: Option<u32>,
    pub status: String,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub committed_points: Option<u32>,
    pub completed_points: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SprintEvent {
    Created {
        sprint: SprintRecord,
    },
    Updated {
        sprint: SprintRecord,
    },
    Deleted {
        sprint_id: Uuid,
        organization_id: Option<Uuid>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DomainEvent {
    Backlog(BacklogEvent),
    Sprint(SprintEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub event: DomainEvent,
}

impl EventEnvelope {
    pub fn new(event: DomainEvent) -> Self {
        Self {
            id: Uuid::new_v4(),
            occurred_at: Utc::now(),
            event,
        }
    }
}

const CHANNEL: &str = "domain-events";

#[derive(Clone)]
pub struct EventBus {
    inner: Arc<PubSub>,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(PubSub::new(2)),
        }
    }

    pub async fn publish_envelope(&self, event: EventEnvelope) {
        if let Ok(payload) = serde_json::to_string(&event) {
            self.inner.notify(CHANNEL, &payload);
        }
    }

    pub fn subscribe(&self) -> EventSubscription {
        let (tx, rx) = unbounded_channel();
        let sender = tx.clone();
        let subscription = self.inner.lazy_subscribe(CHANNEL).activate(move |message| {
            if let Ok(envelope) = serde_json::from_str::<EventEnvelope>(&message) {
                let _ = sender.send(envelope);
            }
        });

        EventSubscription {
            receiver: Arc::new(Mutex::new(rx)),
            _subscription: subscription,
        }
    }
}

pub struct EventSubscription {
    receiver: Arc<Mutex<UnboundedReceiver<EventEnvelope>>>,
    _subscription: pubsub::Subscription,
}

impl EventSubscription {
    pub async fn recv(&self) -> EventEnvelope {
        let mut guard = self.receiver.lock().await;
        guard.recv().await.expect("event stream closed")
    }
}

#[async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, event: DomainEvent);
}

#[async_trait]
pub trait EventListener: Send + Sync {
    async fn handle(&self, event: &EventEnvelope);
}

#[async_trait]
impl EventPublisher for EventBus {
    async fn publish(&self, event: DomainEvent) {
        self.publish_envelope(EventEnvelope::new(event)).await;
    }
}
