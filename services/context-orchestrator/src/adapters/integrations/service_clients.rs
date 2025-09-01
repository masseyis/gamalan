use crate::application::ports::{
    BacklogServiceClient, CreateTaskRequest, PromptBuilderServiceClient, ReadinessResult,
    ReadinessServiceClient, ServiceClient, ServiceResult,
};
use async_trait::async_trait;
use common::AppError;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use uuid::Uuid;

#[derive(Clone)]
pub struct HttpBacklogClient {
    client: Client,
    base_url: String,
}

#[derive(Clone)]
pub struct HttpPromptBuilderClient {
    client: Client,
    base_url: String,
}

#[derive(Clone)]
pub struct HttpReadinessClient {
    client: Client,
    base_url: String,
}

// Request/Response DTOs
#[derive(Serialize, Deserialize)]
struct UpdateStatusRequest {
    status: String,
}

#[derive(Serialize, Deserialize)]
struct AssignTaskRequest {
    user_id: Uuid,
}

#[derive(Serialize, Deserialize)]
struct UpdatePriorityRequest {
    priority: u32,
}

#[derive(Serialize, Deserialize)]
struct ServiceResponse {
    success: bool,
    message: String,
    affected_entities: Vec<Uuid>,
    data: Option<Value>,
}

impl HttpBacklogClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }

    async fn make_request<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        endpoint: &str,
        body: Option<T>,
        tenant_id: Uuid,
    ) -> Result<R, AppError> {
        let url = format!("{}{}", self.base_url, endpoint);
        let mut request = self
            .client
            .request(method, &url)
            .header("x-tenant-id", tenant_id.to_string());

        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("HTTP request failed: {}", e)))?;

        match response.status() {
            StatusCode::OK | StatusCode::CREATED => {
                response.json::<R>().await.map_err(|e| {
                    AppError::ExternalServiceError(format!("Failed to parse response: {}", e))
                })
            }
            StatusCode::BAD_REQUEST => Err(AppError::BadRequest("Invalid request".to_string())),
            StatusCode::NOT_FOUND => Err(AppError::NotFound),
            StatusCode::TOO_MANY_REQUESTS => Err(AppError::RateLimitExceeded),
            StatusCode::INTERNAL_SERVER_ERROR => Err(AppError::ExternalServiceError(
                "Backlog service internal error".to_string(),
            )),
            status => Err(AppError::ExternalServiceError(format!(
                "Unexpected status: {}",
                status
            ))),
        }
    }
}

#[async_trait]
impl BacklogServiceClient for HttpBacklogClient {
    async fn update_story_status(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
        status: &str,
    ) -> Result<ServiceResult, AppError> {
        let request = UpdateStatusRequest {
            status: status.to_string(),
        };

        let response: ServiceResponse = self
            .make_request(
                reqwest::Method::PUT,
                &format!("/stories/{}/status", story_id),
                Some(request),
                tenant_id,
            )
            .await?;

        Ok(ServiceResult {
            success: response.success,
            message: response.message,
            affected_entities: response.affected_entities,
            data: response.data,
        })
    }

    async fn create_task(
        &self,
        tenant_id: Uuid,
        task_data: CreateTaskRequest,
    ) -> Result<ServiceResult, AppError> {
        let response: ServiceResponse = self
            .make_request(
                reqwest::Method::POST,
                "/tasks",
                Some(task_data),
                tenant_id,
            )
            .await?;

        Ok(ServiceResult {
            success: response.success,
            message: response.message,
            affected_entities: response.affected_entities,
            data: response.data,
        })
    }

    async fn assign_task(
        &self,
        tenant_id: Uuid,
        task_id: Uuid,
        user_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        let request = AssignTaskRequest { user_id };

        let response: ServiceResponse = self
            .make_request(
                reqwest::Method::PUT,
                &format!("/tasks/{}/assign", task_id),
                Some(request),
                tenant_id,
            )
            .await?;

        Ok(ServiceResult {
            success: response.success,
            message: response.message,
            affected_entities: response.affected_entities,
            data: response.data,
        })
    }

    async fn update_priority(
        &self,
        tenant_id: Uuid,
        item_id: Uuid,
        priority: u32,
    ) -> Result<ServiceResult, AppError> {
        let request = UpdatePriorityRequest { priority };

        let response: ServiceResponse = self
            .make_request(
                reqwest::Method::PUT,
                &format!("/items/{}/priority", item_id),
                Some(request),
                tenant_id,
            )
            .await?;

        Ok(ServiceResult {
            success: response.success,
            message: response.message,
            affected_entities: response.affected_entities,
            data: response.data,
        })
    }

}

#[async_trait]
impl ServiceClient for HttpBacklogClient {
    async fn health_check(&self) -> Result<(), AppError> {
        let url = format!("{}/health", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("Health check failed: {}", e)))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::ExternalServiceError(
                "Backlog service health check failed".to_string(),
            ))
        }
    }
}

impl HttpPromptBuilderClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(60)) // Longer timeout for LLM operations
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }
}

#[async_trait]
impl PromptBuilderServiceClient for HttpPromptBuilderClient {
    async fn get_context_prompt(
        &self,
        tenant_id: Uuid,
        entity_ids: &[Uuid],
    ) -> Result<String, AppError> {
        let url = format!("{}/context-prompt", self.base_url);
        let request = serde_json::json!({
            "entity_ids": entity_ids
        });

        let response = self
            .client
            .post(&url)
            .header("x-tenant-id", tenant_id.to_string())
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("HTTP request failed: {}", e)))?;

        if response.status().is_success() {
            let result: Value = response.json().await.map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to parse response: {}", e))
            })?;

            result
                .get("prompt")
                .and_then(|p| p.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| AppError::ExternalServiceError("No prompt in response".to_string()))
        } else {
            Err(AppError::ExternalServiceError(format!(
                "Prompt builder error: {}",
                response.status()
            )))
        }
    }

    async fn generate_task_pack(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        let url = format!("{}/task-pack/{}", self.base_url, story_id);

        let response = self
            .client
            .post(&url)
            .header("x-tenant-id", tenant_id.to_string())
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("HTTP request failed: {}", e)))?;

        if response.status().is_success() {
            let result: ServiceResponse = response.json().await.map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to parse response: {}", e))
            })?;

            Ok(ServiceResult {
                success: result.success,
                message: result.message,
                affected_entities: result.affected_entities,
                data: result.data,
            })
        } else {
            Err(AppError::ExternalServiceError(format!(
                "Task pack generation failed: {}",
                response.status()
            )))
        }
    }

}

#[async_trait]
impl ServiceClient for HttpPromptBuilderClient {
    async fn health_check(&self) -> Result<(), AppError> {
        let url = format!("{}/health", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("Health check failed: {}", e)))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::ExternalServiceError(
                "Prompt builder service health check failed".to_string(),
            ))
        }
    }
}

impl HttpReadinessClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }
}

#[async_trait]
impl ReadinessServiceClient for HttpReadinessClient {
    async fn check_story_readiness(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
    ) -> Result<ReadinessResult, AppError> {
        let url = format!("{}/check/{}", self.base_url, story_id);

        let response = self
            .client
            .get(&url)
            .header("x-tenant-id", tenant_id.to_string())
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("HTTP request failed: {}", e)))?;

        if response.status().is_success() {
            let result: Value = response.json().await.map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to parse response: {}", e))
            })?;

            Ok(ReadinessResult {
                is_ready: result
                    .get("is_ready")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                missing_criteria: result
                    .get("missing_criteria")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                readiness_score: result
                    .get("readiness_score")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0) as f32,
                blockers: result
                    .get("blockers")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
            })
        } else if response.status() == StatusCode::NOT_FOUND {
            Err(AppError::NotFound)
        } else {
            Err(AppError::ExternalServiceError(format!(
                "Readiness check failed: {}",
                response.status()
            )))
        }
    }

    async fn mark_story_ready(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        let url = format!("{}/mark-ready/{}", self.base_url, story_id);

        let response = self
            .client
            .post(&url)
            .header("x-tenant-id", tenant_id.to_string())
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("HTTP request failed: {}", e)))?;

        if response.status().is_success() {
            let result: ServiceResponse = response.json().await.map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to parse response: {}", e))
            })?;

            Ok(ServiceResult {
                success: result.success,
                message: result.message,
                affected_entities: result.affected_entities,
                data: result.data,
            })
        } else {
            Err(AppError::ExternalServiceError(format!(
                "Mark ready failed: {}",
                response.status()
            )))
        }
    }

}

#[async_trait]
impl ServiceClient for HttpReadinessClient {
    async fn health_check(&self) -> Result<(), AppError> {
        let url = format!("{}/health", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("Health check failed: {}", e)))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(AppError::ExternalServiceError(
                "Readiness service health check failed".to_string(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let backlog_client = HttpBacklogClient::new("http://localhost:8080".to_string());
        assert_eq!(backlog_client.base_url, "http://localhost:8080");

        let prompt_client = HttpPromptBuilderClient::new("http://localhost:8081".to_string());
        assert_eq!(prompt_client.base_url, "http://localhost:8081");

        let readiness_client = HttpReadinessClient::new("http://localhost:8082".to_string());
        assert_eq!(readiness_client.base_url, "http://localhost:8082");
    }

    #[test]
    fn test_request_serialization() {
        let update_request = UpdateStatusRequest {
            status: "in_progress".to_string(),
        };
        let json = serde_json::to_string(&update_request).unwrap();
        assert!(json.contains("in_progress"));

        let assign_request = AssignTaskRequest {
            user_id: Uuid::new_v4(),
        };
        let json = serde_json::to_string(&assign_request).unwrap();
        assert!(json.contains("user_id"));
    }

    #[tokio::test]
    async fn test_health_check_url_formation() {
        let client = HttpBacklogClient::new("http://localhost:8080".to_string());
        // This test would need to mock the HTTP client to avoid actual network calls
        // For now, we just verify the client can be created
        assert!(!client.base_url.is_empty());
    }
}