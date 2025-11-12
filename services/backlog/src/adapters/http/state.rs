use std::sync::Arc;

use crate::adapters::websocket::WebSocketManager;
use crate::application::BacklogUsecases;
use sqlx::PgPool;

/// Shared application state for HTTP handlers
#[derive(Clone)]
pub struct BacklogAppState {
    pub usecases: Arc<BacklogUsecases>,
    pub ws_manager: Arc<WebSocketManager>,
    pub pool: PgPool,
}

impl BacklogAppState {
    pub fn new(
        usecases: Arc<BacklogUsecases>,
        ws_manager: Arc<WebSocketManager>,
        pool: PgPool,
    ) -> Self {
        Self {
            usecases,
            ws_manager,
            pool,
        }
    }
}
