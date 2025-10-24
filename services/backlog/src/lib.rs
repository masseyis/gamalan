pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;

pub use config::AppConfig;

use application::BacklogUsecases;
use event_bus::EventPublisher;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_usecases(pool: PgPool, events: Arc<dyn EventPublisher>) -> Arc<BacklogUsecases> {
    Arc::new(BacklogUsecases::new(Arc::new(pool), events))
}
