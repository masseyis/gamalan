use color_eyre::eyre::Result;
use std::env;
use tracing_subscriber::{
    fmt::{self, format::JsonFields},
    prelude::*,
    EnvFilter, Registry,
};

/// Initialize production-ready tracing with enhanced debugging capabilities
pub fn init_production_tracing(service_name: &str) -> Result<()> {
    // Check if a global subscriber is already set
    use std::sync::Once;
    static INIT: Once = Once::new();
    static mut ALREADY_INITIALIZED: bool = false;

    INIT.call_once(|| {
        // Install color-eyre for better error reports
        let _ = color_eyre::install();

        // Enable backtraces in production for debugging
        if env::var("RUST_BACKTRACE").is_err() {
            env::set_var("RUST_BACKTRACE", "1");
        }

        let env_filter = EnvFilter::try_from_default_env()
            .or_else(|_| EnvFilter::try_new("info"))
            .unwrap()
            .add_directive(
                format!("{}=debug", service_name.replace("-", "_"))
                    .parse()
                    .unwrap(),
            );

        let fmt_layer = fmt::layer()
            .with_file(true)
            .with_line_number(true)
            .with_target(true)
            .with_thread_ids(true)
            .with_thread_names(true)
            .json()
            .fmt_fields(JsonFields::new())
            .with_span_events(fmt::format::FmtSpan::CLOSE);

        let error_layer = tracing_error::ErrorLayer::default();

        let registry = Registry::default()
            .with(env_filter)
            .with(fmt_layer)
            .with(error_layer);

        // Only try to set global default if no subscriber is already set
        match tracing::subscriber::set_global_default(registry) {
            Ok(_) => {
                unsafe {
                    ALREADY_INITIALIZED = true;
                }
                // Set up panic handler to capture panics with context
                setup_panic_handler(service_name);
            }
            Err(_) => {
                // Global subscriber already set, which is fine
                eprintln!(
                    "Tracing subscriber already initialized for {}",
                    service_name
                );
            }
        }
    });

    Ok(())
}

fn setup_panic_handler(service_name: &str) {
    let service_name = service_name.to_string();

    std::panic::set_hook(Box::new(move |panic_info| {
        let backtrace = std::backtrace::Backtrace::capture();

        // Create a span for the panic
        let span = tracing::error_span!(
            "panic",
            service = %service_name,
            backtrace = %backtrace,
        );

        let _enter = span.enter();

        let panic_message = panic_info
            .payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| {
                panic_info
                    .payload()
                    .downcast_ref::<String>()
                    .map(|s| s.as_str())
            })
            .unwrap_or("unknown panic message");

        if let Some(location) = panic_info.location() {
            tracing::error!(
                file = %location.file(),
                line = location.line(),
                column = location.column(),
                "Service panicked: {}",
                panic_message
            );
        } else {
            tracing::error!("Service panicked with no location info: {}", panic_message);
        }

        // Also log to stderr for immediate visibility
        eprintln!(
            "PANIC in {}: {:?}\nBacktrace:\n{}",
            service_name, panic_info, backtrace
        );
    }));
}

/// Create a detailed health check response with subsystem status
pub async fn detailed_health_check() -> serde_json::Value {
    serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "version": env!("CARGO_PKG_VERSION"),
        "service": env!("CARGO_PKG_NAME"),
        "uptime": get_uptime_seconds(),
        "subsystems": {
            "logging": check_logging_health(),
            "memory": check_memory_health(),
        }
    })
}

fn get_uptime_seconds() -> u64 {
    static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();
    let start_time = START_TIME.get_or_init(std::time::Instant::now);
    start_time.elapsed().as_secs()
}

fn check_logging_health() -> serde_json::Value {
    serde_json::json!({
        "status": "healthy",
        "rust_backtrace": env::var("RUST_BACKTRACE").unwrap_or_else(|_| "not_set".to_string())
    })
}

fn check_memory_health() -> serde_json::Value {
    // Basic memory health check - could be expanded with more detailed metrics
    serde_json::json!({
        "status": "healthy",
        "process_id": std::process::id()
    })
}

// TODO: Re-enable metrics module when properly configured
/*
pub mod metrics {
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Mutex;
    use lazy_static::lazy_static;

    lazy_static! {
        static ref ERROR_COUNTER: Mutex<HashMap<String, AtomicU64>> = Mutex::new(HashMap::new());
        static ref REQUEST_DURATION: Mutex<Vec<u64>> = Mutex::new(Vec::new());
    }

    pub fn increment_error_counter(error_type: &str) {
        let mut counter = ERROR_COUNTER.lock().unwrap();
        counter
            .entry(error_type.to_string())
            .or_insert_with(|| AtomicU64::new(0))
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_request_duration(duration_ms: u64) {
        let mut durations = REQUEST_DURATION.lock().unwrap();
        durations.push(duration_ms);

        // Keep only last 1000 requests to prevent memory growth
        if durations.len() > 1000 {
            durations.drain(0..500);
        }
    }

    pub fn get_error_counts() -> HashMap<String, u64> {
        let counter = ERROR_COUNTER.lock().unwrap();
        counter
            .iter()
            .map(|(k, v)| (k.clone(), v.load(Ordering::Relaxed)))
            .collect()
    }

    pub fn get_request_stats() -> (f64, u64) {
        let durations = REQUEST_DURATION.lock().unwrap();
        if durations.is_empty() {
            return (0.0, 0);
        }

        let sum: u64 = durations.iter().sum();
        let count = durations.len() as u64;
        let average = sum as f64 / count as f64;

        (average, count)
    }
}
*/
