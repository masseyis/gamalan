pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;

pub use adapters::http::routes::create_prompt_builder_router;
pub use config::AppConfig;