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

impl ToString for StoryStatus {
    fn to_string(&self) -> String {
        match self {
            Self::Ready => "Ready".to_string(),
            Self::InProgress => "InProgress".to_string(),
            Self::InReview => "InReview".to_string(),
            Self::Done => "Done".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: StoryStatus,
    pub labels: Vec<String>,
}

impl Story {
    pub fn new(project_id: Uuid, title: String, description: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            project_id,
            title,
            description,
            status: StoryStatus::Ready,
            labels: Vec::new(),
        }
    }

    pub fn update_status(&mut self, status: StoryStatus) {
        self.status = status;
    }

    pub fn add_label(&mut self, label: String) {
        if !self.labels.contains(&label) {
            self.labels.push(label);
        }
    }

    pub fn remove_label(&mut self, label: &str) {
        self.labels.retain(|l| l != label);
    }
}
