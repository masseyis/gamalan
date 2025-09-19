use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StoryStatus {
    Ready,
    InProgress,
    InReview,
    Done,
}

impl StoryStatus {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "ready" => Some(Self::Ready),
            "inprogress" => Some(Self::InProgress),
            "inreview" => Some(Self::InReview),
            "done" => Some(Self::Done),
            _ => None,
        }
    }
}

impl std::fmt::Display for StoryStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Ready => write!(f, "Ready"),
            Self::InProgress => write!(f, "InProgress"),
            Self::InReview => write!(f, "InReview"),
            Self::Done => write!(f, "Done"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: Uuid,
    pub project_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: StoryStatus,
    pub labels: Vec<String>,
}

impl Story {
    pub fn new(
        project_id: Uuid,
        organization_id: Option<Uuid>,
        title: String,
        description: Option<String>,
    ) -> Result<Self, common::AppError> {
        if title.trim().is_empty() {
            return Err(common::AppError::BadRequest(
                "Story title cannot be empty".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            project_id,
            organization_id,
            title,
            description,
            status: StoryStatus::Ready,
            labels: Vec::new(),
        })
    }

    pub fn update_status(&mut self, status: StoryStatus) {
        self.status = status;
    }

    pub fn add_label(&mut self, label: String) {
        if !self.labels.contains(&label) {
            self.labels.push(label);
        }
    }

    #[allow(dead_code)]
    pub fn remove_label(&mut self, label: &str) {
        self.labels.retain(|l| l != label);
    }
}
