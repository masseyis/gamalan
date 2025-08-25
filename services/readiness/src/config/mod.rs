use anyhow::{anyhow, Result};

pub struct AppConfig {
    pub clerk_jwks_url: String,
    pub clerk_issuer: String,
    pub clerk_audience: String,
}

impl AppConfig {
    pub fn new() -> Result<Self> {
        let clerk_jwks_url = std::env::var("CLERK_JWKS_URL")
            .map_err(|_| anyhow!("CLERK_JWKS_URL must be set"))?;
        let clerk_issuer = std::env::var("CLERK_ISSUER")
            .map_err(|_| anyhow!("CLERK_ISSUER must be set"))?;
        let clerk_audience = std::env::var("CLERK_AUDIENCE")
            .map_err(|_| anyhow!("CLERK_AUDIENCE must be set"))?;

        Ok(Self {
            clerk_jwks_url,
            clerk_issuer,
            clerk_audience,
        })
    }
}
