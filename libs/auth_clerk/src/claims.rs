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
    #[serde(rename = "org_id")]
    pub org_id: Option<String>,
    #[serde(rename = "org_slug")]
    pub org_slug: Option<String>,
    #[serde(rename = "org_role")]
    pub org_role: Option<String>,
    #[serde(rename = "org_name")]
    pub org_name: Option<String>,
    #[serde(rename = "o")]
    pub org: Option<OrgClaim>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrgClaim {
    #[serde(rename = "id")]
    pub id: Option<String>,
    #[serde(rename = "rol")]
    pub role: Option<String>,
    #[serde(rename = "slg")]
    pub slug: Option<String>,
    #[serde(rename = "nam")]
    pub name: Option<String>,
}
