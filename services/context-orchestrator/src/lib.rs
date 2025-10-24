// Library exports for context-orchestrator service
// This allows tests to import modules from the service

pub mod adapters;
pub mod application;
pub mod domain;
mod projections;

// Re-export the router creation function for api-gateway integration
pub use adapters::http::handlers::create_context_orchestrator_router;
