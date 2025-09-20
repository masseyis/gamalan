// This service is now used as a library by api-gateway
// The main function here is only for local testing if needed

pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;

pub use crate::{adapters::http::routes::create_readiness_router, config::AppConfig};

// Local testing main - not used in production deployment
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("readiness is now a library service used by api-gateway");
    println!("Use 'cargo run --bin api-gateway' to run the full application");
    Ok(())
}
