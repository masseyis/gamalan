use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;

/// Feature flag client for managing feature toggles
/// Integrates with LaunchDarkly and provides fallback for local development
#[derive(Clone, Debug)]
pub struct FeatureFlagClient {
    flags: HashMap<String, FeatureFlag>,
    user_context: Option<UserContext>,
    environment: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FeatureFlag {
    pub key: String,
    pub enabled: bool,
    pub variation: FeatureFlagVariation,
    pub targeting_rules: Vec<TargetingRule>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FeatureFlagVariation {
    Boolean(bool),
    String(String),
    Number(f64),
    Json(serde_json::Value),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TargetingRule {
    pub attribute: String,
    pub operator: String,
    pub values: Vec<String>,
    pub variation: FeatureFlagVariation,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserContext {
    pub key: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub custom: HashMap<String, String>,
}

impl FeatureFlagClient {
    /// Create a new feature flag client
    pub fn new() -> Self {
        let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());

        Self {
            flags: HashMap::new(),
            user_context: None,
            environment,
        }
    }

    /// Initialize with user context
    pub fn with_user_context(mut self, user: UserContext) -> Self {
        self.user_context = Some(user);
        self
    }

    /// Check if a boolean feature flag is enabled
    pub async fn is_enabled(&self, flag_key: &str) -> bool {
        self.is_enabled_for_user(flag_key, None).await
    }

    /// Check if a feature flag is enabled for a specific user
    pub async fn is_enabled_for_user(&self, flag_key: &str, user: Option<&UserContext>) -> bool {
        // In development, check environment variables first
        if self.environment == "development" {
            let env_key = format!("FEATURE_FLAG_{}", flag_key.to_uppercase());
            if let Ok(value) = env::var(&env_key) {
                return value.parse().unwrap_or(false);
            }
        }

        // Check LaunchDarkly or cached flags
        if let Some(flag) = self.flags.get(flag_key) {
            self.evaluate_flag(flag, user.or(self.user_context.as_ref()))
        } else {
            // Fetch from LaunchDarkly API
            self.fetch_and_evaluate(flag_key, user.or(self.user_context.as_ref()))
                .await
        }
    }

    /// Get the variation value for a feature flag
    pub async fn get_variation<T>(&self, flag_key: &str, default_value: T) -> T
    where
        T: for<'de> Deserialize<'de> + Clone,
    {
        if let Some(flag) = self.flags.get(flag_key) {
            match &flag.variation {
                FeatureFlagVariation::Json(value) => {
                    serde_json::from_value(value.clone()).unwrap_or(default_value)
                }
                FeatureFlagVariation::Boolean(b) => {
                    serde_json::from_value(serde_json::Value::Bool(*b)).unwrap_or(default_value)
                }
                FeatureFlagVariation::String(s) => {
                    serde_json::from_value(serde_json::Value::String(s.clone()))
                        .unwrap_or(default_value)
                }
                FeatureFlagVariation::Number(n) => {
                    serde_json::from_value(serde_json::json!(n)).unwrap_or(default_value)
                }
            }
        } else {
            default_value
        }
    }

    /// Fetch flag from LaunchDarkly API
    async fn fetch_and_evaluate(&self, flag_key: &str, user: Option<&UserContext>) -> bool {
        // In a real implementation, this would call LaunchDarkly's API
        // For now, return false as safe default
        tracing::debug!(
            flag_key = flag_key,
            user_key = user.map(|u| u.key.as_str()),
            "Fetching feature flag from LaunchDarkly"
        );

        // Simulate API call
        match self.environment.as_str() {
            "production" => self.get_production_flag_value(flag_key).await,
            "staging" => self.get_staging_flag_value(flag_key).await,
            _ => false, // Safe default for development
        }
    }

    /// Evaluate flag based on targeting rules
    fn evaluate_flag(&self, flag: &FeatureFlag, user: Option<&UserContext>) -> bool {
        if !flag.enabled {
            return false;
        }

        // If no user context, return default variation
        let user = match user {
            Some(u) => u,
            None => return matches!(flag.variation, FeatureFlagVariation::Boolean(true)),
        };

        // Evaluate targeting rules
        for rule in &flag.targeting_rules {
            if self.evaluate_targeting_rule(rule, user) {
                return matches!(rule.variation, FeatureFlagVariation::Boolean(true));
            }
        }

        // Default to flag variation
        matches!(flag.variation, FeatureFlagVariation::Boolean(true))
    }

    /// Evaluate a targeting rule against user context
    fn evaluate_targeting_rule(&self, rule: &TargetingRule, user: &UserContext) -> bool {
        let user_value = match rule.attribute.as_str() {
            "key" => Some(user.key.clone()),
            "email" => user.email.clone(),
            "name" => user.name.clone(),
            custom_attr => user.custom.get(custom_attr).cloned(),
        };

        let user_value = match user_value {
            Some(value) => value,
            None => return false,
        };

        match rule.operator.as_str() {
            "in" => rule.values.contains(&user_value),
            "contains" => rule.values.iter().any(|v| user_value.contains(v)),
            "startsWith" => rule.values.iter().any(|v| user_value.starts_with(v)),
            "endsWith" => rule.values.iter().any(|v| user_value.ends_with(v)),
            "matches" => rule.values.iter().any(|v| {
                // Simple regex matching (in production, use proper regex crate)
                user_value == *v
            }),
            _ => false,
        }
    }

    /// Get flag value from production environment
    async fn get_production_flag_value(&self, flag_key: &str) -> bool {
        // In production, be conservative - return false for unknown flags
        match flag_key {
            "enable_ai_features" => true,
            "enable_context_orchestrator" => true,
            "enable_canary_rollout" => false,
            "enable_debug_logging" => false,
            _ => false,
        }
    }

    /// Get flag value from staging environment
    async fn get_staging_flag_value(&self, flag_key: &str) -> bool {
        // Staging is more permissive
        matches!(
            flag_key,
            "enable_ai_features"
                | "enable_context_orchestrator"
                | "enable_canary_rollout"
                | "enable_debug_logging"
                | "enable_experimental_features"
        )
    }

    /// Refresh all flags from LaunchDarkly
    pub async fn refresh_flags(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tracing::info!("Refreshing feature flags from LaunchDarkly");

        // In a real implementation, this would call LaunchDarkly's SDK
        // For now, simulate with hardcoded flags
        self.flags = self.get_default_flags();

        Ok(())
    }

    /// Get default flags for development/testing
    fn get_default_flags(&self) -> HashMap<String, FeatureFlag> {
        let mut flags = HashMap::new();

        // AI Features
        flags.insert(
            "enable_ai_features".to_string(),
            FeatureFlag {
                key: "enable_ai_features".to_string(),
                enabled: true,
                variation: FeatureFlagVariation::Boolean(true),
                targeting_rules: vec![],
            },
        );

        // Context Orchestrator
        flags.insert(
            "enable_context_orchestrator".to_string(),
            FeatureFlag {
                key: "enable_context_orchestrator".to_string(),
                enabled: self.environment != "production",
                variation: FeatureFlagVariation::Boolean(self.environment != "production"),
                targeting_rules: vec![TargetingRule {
                    attribute: "email".to_string(),
                    operator: "endsWith".to_string(),
                    values: vec!["@company.com".to_string()],
                    variation: FeatureFlagVariation::Boolean(true),
                }],
            },
        );

        // Debug Logging
        flags.insert(
            "enable_debug_logging".to_string(),
            FeatureFlag {
                key: "enable_debug_logging".to_string(),
                enabled: true,
                variation: FeatureFlagVariation::Boolean(self.environment != "production"),
                targeting_rules: vec![],
            },
        );

        flags
    }

    /// Create kill switch for emergency disabling
    pub async fn emergency_disable(
        &mut self,
        flag_key: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        tracing::warn!(
            flag_key = flag_key,
            "Emergency disable activated for feature flag"
        );

        if let Some(flag) = self.flags.get_mut(flag_key) {
            flag.enabled = false;
            flag.variation = FeatureFlagVariation::Boolean(false);
        }

        // In production, this would call LaunchDarkly API to disable the flag
        Ok(())
    }
}

impl Default for FeatureFlagClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Macro for easy feature flag checking
#[macro_export]
macro_rules! feature_enabled {
    ($client:expr, $flag:expr) => {
        $client.is_enabled($flag).await
    };
    ($client:expr, $flag:expr, $user:expr) => {
        $client.is_enabled_for_user($flag, Some($user)).await
    };
}

/// Helper function to create user context from JWT claims
pub fn user_context_from_jwt(
    sub: &str,
    email: Option<String>,
    orgs: Option<Vec<String>>,
) -> UserContext {
    let mut custom = HashMap::new();

    if let Some(orgs) = orgs {
        custom.insert("organizations".to_string(), orgs.join(","));
    }

    UserContext {
        key: sub.to_string(),
        email,
        name: None,
        custom,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_feature_flag_enabled() {
        let mut client = FeatureFlagClient::new();
        client.refresh_flags().await.unwrap();

        assert!(client.is_enabled("enable_ai_features").await);
    }

    #[tokio::test]
    async fn test_feature_flag_with_user_context() {
        let user = UserContext {
            key: "user123".to_string(),
            email: Some("user@company.com".to_string()),
            name: Some("Test User".to_string()),
            custom: HashMap::new(),
        };

        let mut client = FeatureFlagClient::new().with_user_context(user.clone());
        client.refresh_flags().await.unwrap();

        // This should be enabled for company users
        assert!(
            client
                .is_enabled_for_user("enable_context_orchestrator", Some(&user))
                .await
        );
    }

    #[tokio::test]
    async fn test_emergency_disable() {
        let mut client = FeatureFlagClient::new();
        client.refresh_flags().await.unwrap();

        assert!(client.is_enabled("enable_ai_features").await);

        client
            .emergency_disable("enable_ai_features")
            .await
            .unwrap();

        assert!(!client.is_enabled("enable_ai_features").await);
    }
}
