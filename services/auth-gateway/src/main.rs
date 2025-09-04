use anyhow::Context;

use shuttle_axum::ShuttleAxum;
use shuttle_shared_db::Postgres;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

mod adapters;
mod application;
mod config;
mod domain;

use crate::{adapters::http::routes::create_auth_router, config::AppConfig};
use common::init_tracing;

#[shuttle_runtime::main]
async fn main(
    #[Postgres(local_uri = "postgres://postgres:password@localhost:5432/gamalan")] db_uri: String,
) -> ShuttleAxum {
    init_tracing("auth-gateway");

    let config = AppConfig::new().context("Failed to load config")?;

    let pool = PgPool::connect(&db_uri)
        .await
        .context("Failed to connect to database")?;

    let verifier = Arc::new(Mutex::new(auth_clerk::JwtVerifier::new(
        config.clerk_jwks_url,
        config.clerk_issuer,
        Some(config.clerk_audience),
    )));

    let app = create_auth_router(pool, verifier).await;

    Ok(app.into())
}
