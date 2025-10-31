pub mod events;
pub mod recommendation;
pub mod story;
pub mod task;

pub use events::*;
pub use recommendation::*;
pub use story::*;
pub use task::*;

use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
    pub organization_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
