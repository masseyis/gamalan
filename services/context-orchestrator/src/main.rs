use shuttle_axum::axum::{routing::get, Router};
use shuttle_axum::ShuttleAxum;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

#[shuttle_runtime::main]
async fn main() -> ShuttleAxum {
    // Simple working router for now
    let app = Router::new()
        .route("/", get(home))
        .route("/health", get(health))
        .route("/ready", get(ready))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    Ok(app.into())
}

async fn home() -> &'static str {
    "Salunga AI - Context Orchestrator Service"
}

async fn health() -> &'static str {
    "OK"
}

async fn ready() -> &'static str {
    "READY"
}
