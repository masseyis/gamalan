use axum::{
    extract::{
        ws::{Message, WebSocket},
        FromRequestParts, State, WebSocketUpgrade,
    },
    http::{header::HeaderName, header::AUTHORIZATION, request::Parts, HeaderValue},
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use percent_encoding::percent_decode_str;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::domain::TaskEvent;
use auth_clerk::AuthenticatedWithOrg;
use common::AppError;

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

pub struct WsAuthenticatedWithOrg(pub AuthenticatedWithOrg);

impl<S> FromRequestParts<S> for WsAuthenticatedWithOrg
where
    S: Send + Sync,
{
    type Rejection = AppError;

    fn from_request_parts(
        parts: &mut Parts,
        state: &S,
    ) -> impl std::future::Future<Output = Result<Self, Self::Rejection>> + Send {
        let (additional_auth, additional_api_key, query_snapshot) =
            if parts.headers.get(AUTHORIZATION).is_none() {
                let result = parts
                    .uri
                    .query()
                    .map(parse_auth_from_query)
                    .unwrap_or_default();
                (result.0, result.1, parts.uri.query().map(|q| q.to_string()))
            } else {
                (None, None, parts.uri.query().map(|q| q.to_string()))
            };

        async move {
            if let Some(ref query) = query_snapshot {
                debug!(query, "WebSocket auth query string");
            }

            if let Some(header) = additional_auth {
                debug!(
                    ?header,
                    "Injecting Authorization header from query parameter"
                );
                parts.headers.insert(AUTHORIZATION, header);
            }
            if let Some(header) = additional_api_key {
                debug!(?header, "Injecting X-API-Key header from query parameter");
                parts.headers.insert(X_API_KEY, header);
            }

            match AuthenticatedWithOrg::from_request_parts(parts, state).await {
                Ok(auth) => {
                    debug!(user_id = %auth.auth.sub, "WebSocket authentication succeeded");
                    Ok(WsAuthenticatedWithOrg(auth))
                }
                Err(err) => {
                    error!(?err, "WebSocket authentication failed");
                    Err(err)
                }
            }
        }
    }
}

const X_API_KEY: HeaderName = HeaderName::from_static("x-api-key");

fn parse_auth_from_query(query: &str) -> (Option<HeaderValue>, Option<HeaderValue>) {
    let mut auth_header: Option<HeaderValue> = None;
    let mut api_key_header: Option<HeaderValue> = None;

    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        match (parts.next(), parts.next()) {
            (Some("token"), Some(value)) => {
                if let Some(decoded) = decode_query_value(value) {
                    debug!("Found token query parameter");
                    if let Ok(header) = HeaderValue::from_str(&format!("Bearer {}", decoded)) {
                        auth_header = Some(header);
                    }
                }
            }
            (Some("api_key"), Some(value)) => {
                if let Some(decoded) = decode_query_value(value) {
                    debug!("Found api_key query parameter");
                    if let Ok(header) = HeaderValue::from_str(&format!("ApiKey {}", decoded)) {
                        auth_header = Some(header);
                    }
                    if let Ok(x_header) = HeaderValue::from_str(&decoded) {
                        api_key_header = Some(x_header);
                    }
                }
            }
            _ => continue,
        }
    }

    (auth_header, api_key_header)
}

fn decode_query_value(raw: &str) -> Option<String> {
    percent_decode_str(raw)
        .decode_utf8()
        .ok()
        .map(|cow| cow.to_string())
}

/// WebSocket handler for real-time task updates
/// Authenticated users can connect to receive task event notifications
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    WsAuthenticatedWithOrg(AuthenticatedWithOrg { org_context, auth }): WsAuthenticatedWithOrg,
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
