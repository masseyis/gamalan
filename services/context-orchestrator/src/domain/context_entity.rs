use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContextSnapshot {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub entities: Vec<ContextEntity>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContextEntity {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<u32>,
    pub tags: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub last_updated: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EntityType {
    Story,
    Task,
    Project,
    PlanPack,
    TaskPack,
    AcceptanceCriterion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub utterance_hash: String, // SHA256 hash for privacy
    pub parsed_intent: ParsedIntent,
    pub llm_confidence: f32,
    pub service_confidence: f32,
    pub candidates_considered: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedIntent {
    pub intent_type: IntentType,
    pub entities: Vec<EntityReference>,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IntentType {
    UpdateStatus,
    AssignTask, // Legacy - kept for backward compatibility
    TakeOwnership,
    ReleaseOwnership,
    StartWork,
    CompleteTask,
    CreateItem,
    QueryStatus,
    SearchItems,
    UpdatePriority,
    AddComment,
    MoveToSprint,
    GenerateReport,
    Archive,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EntityReference {
    pub entity_id: Uuid,
    pub entity_type: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateEntity {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<u32>,
    pub tags: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub similarity_score: f32,
    pub last_updated: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionCommand {
    pub action_type: ActionType,
    pub target_entities: Vec<Uuid>,
    pub parameters: HashMap<String, serde_json::Value>,
    pub require_confirmation: bool,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ActionType {
    UpdateStatus,
    AssignUser, // Legacy - kept for backward compatibility
    TakeOwnership,
    ReleaseOwnership,
    StartWork,
    CompleteTask,
    UpdatePriority,
    AddComment,
    CreateTask,
    CreateStory,
    MoveToSprint,
    Archive,
}

impl std::fmt::Display for ActionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UpdateStatus => write!(f, "update_status"),
            Self::AssignUser => write!(f, "assign_user"),
            Self::TakeOwnership => write!(f, "take_ownership"),
            Self::ReleaseOwnership => write!(f, "release_ownership"),
            Self::StartWork => write!(f, "start_work"),
            Self::CompleteTask => write!(f, "complete_task"),
            Self::UpdatePriority => write!(f, "update_priority"),
            Self::AddComment => write!(f, "add_comment"),
            Self::CreateTask => write!(f, "create_task"),
            Self::CreateStory => write!(f, "create_story"),
            Self::MoveToSprint => write!(f, "move_to_sprint"),
            Self::Archive => write!(f, "archive"),
        }
    }
}

impl ActionType {
    pub fn from_string(s: &str) -> Result<Self, AppError> {
        match s {
            "update_status" => Ok(Self::UpdateStatus),
            "assign_user" => Ok(Self::AssignUser),
            "take_ownership" => Ok(Self::TakeOwnership),
            "release_ownership" => Ok(Self::ReleaseOwnership),
            "start_work" => Ok(Self::StartWork),
            "complete_task" => Ok(Self::CompleteTask),
            "update_priority" => Ok(Self::UpdatePriority),
            "add_comment" => Ok(Self::AddComment),
            "create_task" => Ok(Self::CreateTask),
            "create_story" => Ok(Self::CreateStory),
            "move_to_sprint" => Ok(Self::MoveToSprint),
            "archive" => Ok(Self::Archive),
            _ => Err(AppError::BadRequest(format!("Invalid action type: {}", s))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd, Ord, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

impl std::fmt::Display for RiskLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Low => write!(f, "low"),
            Self::Medium => write!(f, "medium"),
            Self::High => write!(f, "high"),
        }
    }
}

impl RiskLevel {
    pub fn from_string(s: &str) -> Result<Self, AppError> {
        match s {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            _ => Err(AppError::BadRequest(format!("Invalid risk level: {}", s))),
        }
    }
}

impl ContextSnapshot {
    pub fn new(
        tenant_id: Uuid,
        user_id: Uuid,
        entities: Vec<ContextEntity>,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            tenant_id,
            user_id,
            timestamp: Utc::now(),
            entities,
            metadata,
        }
    }
}

impl IntentRecord {
    pub fn new(
        tenant_id: Uuid,
        user_id: Uuid,
        utterance: &str,
        parsed_intent: ParsedIntent,
        llm_confidence: f32,
        service_confidence: f32,
        candidates_considered: Vec<Uuid>,
    ) -> Self {
        let utterance_hash = sha2::Sha256::digest(utterance.as_bytes()).iter().fold(
            String::new(),
            |mut output, b| {
                use std::fmt::Write;
                let _ = write!(output, "{:02x}", b);
                output
            },
        );

        Self {
            id: Uuid::new_v4(),
            tenant_id,
            user_id,
            utterance_hash,
            parsed_intent,
            llm_confidence,
            service_confidence,
            candidates_considered,
            created_at: Utc::now(),
        }
    }
}

impl ActionCommand {
    pub fn validate(&self) -> Result<(), AppError> {
        // Create actions don't require target entities
        if !matches!(
            self.action_type,
            ActionType::CreateTask | ActionType::CreateStory
        ) && self.target_entities.is_empty()
        {
            return Err(AppError::BadRequest(
                "No target entities specified".to_string(),
            ));
        }

        // Validate action type matches parameters
        match self.action_type {
            ActionType::UpdateStatus => {
                if !self.parameters.contains_key("new_status") {
                    return Err(AppError::BadRequest(
                        "Missing new_status parameter".to_string(),
                    ));
                }
            }
            ActionType::CreateTask => {
                if !self.parameters.contains_key("title") {
                    return Err(AppError::BadRequest("Missing title parameter".to_string()));
                }
            }
            ActionType::CreateStory => {
                if !self.parameters.contains_key("title") {
                    return Err(AppError::BadRequest("Missing title parameter".to_string()));
                }
            }
            _ => {} // Other validations can be added here
        }

        Ok(())
    }

    pub fn requires_confirmation(&self) -> bool {
        // All destructive operations require confirmation
        matches!(
            self.action_type,
            ActionType::Archive | ActionType::UpdateStatus | ActionType::MoveToSprint
        )
    }
}

impl std::fmt::Display for EntityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EntityType::Story => write!(f, "story"),
            EntityType::Task => write!(f, "task"),
            EntityType::Project => write!(f, "project"),
            EntityType::PlanPack => write!(f, "plan_pack"),
            EntityType::TaskPack => write!(f, "task_pack"),
            EntityType::AcceptanceCriterion => write!(f, "acceptance_criterion"),
        }
    }
}

impl std::fmt::Display for IntentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntentType::UpdateStatus => write!(f, "update_status"),
            IntentType::AssignTask => write!(f, "assign_task"),
            IntentType::TakeOwnership => write!(f, "take_ownership"),
            IntentType::ReleaseOwnership => write!(f, "release_ownership"),
            IntentType::StartWork => write!(f, "start_work"),
            IntentType::CompleteTask => write!(f, "complete_task"),
            IntentType::CreateItem => write!(f, "create_item"),
            IntentType::QueryStatus => write!(f, "query_status"),
            IntentType::SearchItems => write!(f, "search_items"),
            IntentType::UpdatePriority => write!(f, "update_priority"),
            IntentType::AddComment => write!(f, "add_comment"),
            IntentType::MoveToSprint => write!(f, "move_to_sprint"),
            IntentType::GenerateReport => write!(f, "generate_report"),
            IntentType::Archive => write!(f, "archive"),
            IntentType::Unknown => write!(f, "unknown"),
        }
    }
}
