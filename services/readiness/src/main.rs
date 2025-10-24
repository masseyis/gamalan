// Local testing main - not used in production deployment
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("readiness is now a library service used by api-gateway");
    println!("Use 'cargo run --bin api-gateway' to run the full application");
    Ok(())
}
