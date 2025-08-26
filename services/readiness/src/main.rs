use anyhow::Context;

use shuttle_axum::ShuttleAxum;
use shuttle_shared_db::Postgres;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::trace::TraceLayer;

mod adapters;
mod application;
mod config;
mod domain;

use crate::{adapters::http::routes::app_router, config::AppConfig};
use common::{correlation_id_extractor, init_tracing};

#[shuttle_runtime::main]
async fn main(
    #[Postgres(local_uri = "postgres://postgres:password@localhost:5432/gamalan")] db_uri: String,
) -> ShuttleAxum {
    init_tracing();

    let config = AppConfig::new().context("Failed to load config")?;

    let pool = PgPool::connect(&db_uri)
        .await
        .context("Failed to connect to database")?;

    let verifier = Arc::new(Mutex::new(auth_clerk::JwtVerifier::new(
        config.clerk_jwks_url,
        config.clerk_issuer,
        config.clerk_audience,
    )));

    let app = app_router(pool, verifier)
        .await
        .layer(axum::middleware::from_fn(correlation_id_extractor))
        .layer(TraceLayer::new_for_http());

    Ok(app.into())
}
