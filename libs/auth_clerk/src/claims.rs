use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub iss: String,
    pub sub: String,
    pub aud: Option<String>,
    pub exp: usize,
    pub iat: usize,
    pub email: Option<String>,
    pub orgs: Option<Vec<String>>,
}
