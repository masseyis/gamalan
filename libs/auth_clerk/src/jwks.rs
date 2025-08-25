use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Jwk {
    pub kty: String,
    pub r#use: String,
    pub alg: String,
    pub kid: String,
    pub n: String,
    pub e: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

#[derive(Clone)]
pub struct JwksCache {
    pub jwks: Arc<RwLock<HashMap<String, Jwk>>>,
    jwks_url: String,
}

impl JwksCache {
    pub fn new(jwks_url: String) -> Self {
        Self {
            jwks: Arc::new(RwLock::new(HashMap::new())),
            jwks_url,
        }
    }

    pub async fn get_key(&self, kid: &str) -> Option<Jwk> {
        let jwks = self.jwks.read().await;
        jwks.get(kid).cloned()
    }

    pub async fn refresh(&self) -> Result<(), reqwest::Error> {
        let res = reqwest::get(&self.jwks_url).await?;
        let jwks: Jwks = res.json().await?;

        let mut jwks_map = self.jwks.write().await;
        jwks_map.clear();
        for jwk in jwks.keys {
            jwks_map.insert(jwk.kid.clone(), jwk);
        }

        Ok(())
    }
}
