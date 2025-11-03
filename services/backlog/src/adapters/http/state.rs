use std::sync::Arc;

use crate::adapters::websocket::WebSocketManager;
use crate::application::BacklogUsecases;

/// Shared application state for HTTP handlers
#[derive(Clone)]
pub struct BacklogAppState {
    pub usecases: Arc<BacklogUsecases>,
    pub ws_manager: Arc<WebSocketManager>,
}

impl BacklogAppState {
    pub fn new(usecases: Arc<BacklogUsecases>, ws_manager: Arc<WebSocketManager>) -> Self {
        Self {
            usecases,
            ws_manager,
        }
    }
}
