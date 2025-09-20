// This service is now used as a library by api-gateway
// The main function here is only for local testing if needed

use anyhow::Context;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;

pub use crate::{adapters::http::routes::create_prompt_builder_router, config::AppConfig};

// Local testing main - not used in production deployment
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("prompt-builder is now a library service used by api-gateway");
    println!("Use 'cargo run --bin api-gateway' to run the full application");
    Ok(())
}
