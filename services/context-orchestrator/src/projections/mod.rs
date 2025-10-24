use event_bus::{DomainEvent, EventBus, EventEnvelope, SprintEvent, SprintRecord};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tracing::error;
use uuid::Uuid;

#[derive(Clone)]
struct SprintProjectionStore {
    pool: Arc<PgPool>,
}

impl SprintProjectionStore {
    fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    async fn handle_event(&self, envelope: &EventEnvelope) {
        if let Err(err) = self.apply_event(&envelope.event).await {
            error!(
                error = %err,
                event_id = %envelope.id,
                "Failed to apply sprint event to context projections"
            );
        }
    }

    async fn apply_event(&self, event: &DomainEvent) -> Result<(), sqlx::Error> {
        if let DomainEvent::Sprint(evt) = event {
            match evt {
                SprintEvent::Created { sprint } | SprintEvent::Updated { sprint } => {
                    self.upsert_sprint(sprint).await?
                }
                SprintEvent::Deleted { sprint_id, .. } => self.delete_sprint(*sprint_id).await?,
            }
        }
        Ok(())
    }

    async fn upsert_sprint(&self, sprint: &SprintRecord) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO context_sprint_projections (
                id,
                organization_id,
                team_id,
                name,
                goal,
                status,
                start_date,
                end_date,
                committed_points,
                completed_points,
                updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
            )
            ON CONFLICT (id) DO UPDATE SET
                organization_id = EXCLUDED.organization_id,
                team_id = EXCLUDED.team_id,
                name = EXCLUDED.name,
                goal = EXCLUDED.goal,
                status = EXCLUDED.status,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                committed_points = EXCLUDED.committed_points,
                completed_points = EXCLUDED.completed_points,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(sprint.id)
        .bind(sprint.organization_id)
        .bind(sprint.team_id)
        .bind(&sprint.name)
        .bind(&sprint.goal)
        .bind(&sprint.status)
        .bind(sprint.start_date)
        .bind(sprint.end_date)
        .bind(sprint.committed_points.map(|v| v as i32))
        .bind(sprint.completed_points.map(|v| v as i32))
        .bind(sprint.updated_at)
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    async fn delete_sprint(&self, sprint_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM context_sprint_projections WHERE id = $1")
            .bind(sprint_id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }
}

pub struct SprintProjectionWorker {
    #[allow(dead_code)]
    handle: JoinHandle<()>,
}

impl SprintProjectionWorker {
    pub fn spawn(pool: Arc<PgPool>, event_bus: Arc<EventBus>) -> Self {
        let store = SprintProjectionStore::new(pool);
        let subscription = event_bus.subscribe();
        let handle = tokio::spawn(async move {
            loop {
                let envelope = subscription.recv().await;
                store.handle_event(&envelope).await;
            }
        });

        Self { handle }
    }
}
