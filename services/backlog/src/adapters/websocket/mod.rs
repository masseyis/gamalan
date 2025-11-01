use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::domain::TaskEvent;
use auth_clerk::AuthenticatedWithOrg;

/// WebSocket connection manager that broadcasts task events to connected clients
#[derive(Clone)]
pub struct WebSocketManager {
    tx: broadcast::Sender<TaskEvent>,
}

impl WebSocketManager {
    pub fn new(capacity: usize) -> Self {
        let (tx, _rx) = broadcast::channel(capacity);
        Self { tx }
    }

    /// Broadcast a task event to all connected clients
    pub fn broadcast(&self, event: TaskEvent) {
        let subscriber_count = self.tx.receiver_count();
        debug!(
            "Broadcasting event for task {} to {} subscribers",
            event.task_id(),
            subscriber_count
        );

        if let Err(e) = self.tx.send(event) {
            warn!("Failed to broadcast event: {}", e);
        }
    }

    /// Subscribe to task events
    pub fn subscribe(&self) -> broadcast::Receiver<TaskEvent> {
        self.tx.subscribe()
    }
}

/// WebSocket handler for real-time task updates
/// Authenticated users can connect to receive task event notifications
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    State(state): State<Arc<crate::adapters::http::BacklogAppState>>,
) -> impl IntoResponse {
    let org_id = org_context.effective_organization_uuid();
    let user_id = auth.sub.clone();

    info!(
        org_id = ?org_id,
        user_id = %user_id,
        "WebSocket connection established"
    );

    ws.on_upgrade(move |socket| handle_socket(socket, org_id, user_id, state.ws_manager.clone()))
}

async fn handle_socket(
    socket: WebSocket,
    org_id: Option<Uuid>,
    user_id: String,
    ws_manager: Arc<WebSocketManager>,
) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to task events
    let mut rx = ws_manager.subscribe();

    // Clone user_id for both async tasks
    let user_id_send = user_id.clone();
    let user_id_recv = user_id.clone();

    // Send task for receiving events and forwarding to client
    let mut send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            // Serialize event to JSON
            match serde_json::to_string(&event) {
                Ok(json) => {
                    debug!(
                        org_id = ?org_id,
                        user_id = %user_id_send,
                        "Sending event to client: {}",
                        json
                    );

                    if sender.send(Message::Text(json.into())).await.is_err() {
                        error!(
                            org_id = ?org_id,
                            user_id = %user_id_send,
                            "Failed to send message to client, closing connection"
                        );
                        break;
                    }
                }
                Err(e) => {
                    error!(
                        org_id = ?org_id,
                        user_id = %user_id_send,
                        "Failed to serialize event: {}",
                        e
                    );
                }
            }
        }
    });

    // Task for receiving client messages (ping/pong for keepalive)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => {
                    info!(
                        org_id = ?org_id,
                        user_id = %user_id_recv,
                        "Client closed WebSocket connection"
                    );
                    break;
                }
                Message::Ping(_data) => {
                    debug!(
                        org_id = ?org_id,
                        user_id = %user_id_recv,
                        "Received ping from client"
                    );
                    // Pong is sent automatically by axum
                }
                Message::Pong(_) => {
                    debug!(
                        org_id = ?org_id,
                        user_id = %user_id_recv,
                        "Received pong from client"
                    );
                }
                Message::Text(text) => {
                    debug!(
                        org_id = ?org_id,
                        user_id = %user_id_recv,
                        "Received text message from client: {}",
                        text
                    );
                }
                Message::Binary(_) => {
                    warn!(
                        org_id = ?org_id,
                        user_id = %user_id_recv,
                        "Received unexpected binary message from client"
                    );
                }
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        },
    }

    info!(
        org_id = ?org_id,
        user_id = %user_id,
        "WebSocket connection closed"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_websocket_manager_creation() {
        let manager = WebSocketManager::new(100);
        assert_eq!(manager.tx.receiver_count(), 0);
    }

    #[test]
    fn test_websocket_manager_subscribe() {
        let manager = WebSocketManager::new(100);
        let _rx1 = manager.subscribe();
        let _rx2 = manager.subscribe();
        assert_eq!(manager.tx.receiver_count(), 2);
    }

    #[tokio::test]
    async fn test_websocket_manager_broadcast() {
        let manager = WebSocketManager::new(100);
        let mut rx = manager.subscribe();

        let event = TaskEvent::OwnershipTaken {
            task_id: Uuid::new_v4(),
            story_id: Uuid::new_v4(),
            owner_user_id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
        };

        manager.broadcast(event.clone());

        let received = rx.recv().await.expect("Failed to receive event");
        assert_eq!(received.task_id(), event.task_id());
    }
}
