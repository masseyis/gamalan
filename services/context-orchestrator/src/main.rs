// This service is now used as a library by api-gateway
// The main function here is only for local testing if needed

// Local testing main - not used in production deployment
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("context-orchestrator is now a library service used by api-gateway");
    println!("Use 'cargo run --bin api-gateway' to run the full application");
    Ok(())
}
