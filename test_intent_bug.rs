// Simple test to verify the intent detection bug
use std::collections::HashMap;

#[derive(Debug, PartialEq)]
enum IntentType {
    TakeOwnership,
    ReleaseOwnership,
    CompleteTask,
    StartWork,
    MoveToSprint,
    UpdateStatus,
    Unknown,
}

fn fallback_heuristic_parse(utterance: &str) -> IntentType {
    let utterance_lower = utterance.to_lowercase();

    // Simple keyword-based intent detection
    let intent_type = if utterance_lower.contains("i'll take")
        || utterance_lower.contains("i'm on it")
        || utterance_lower.contains("i'll work on")
        || utterance_lower.contains("i'll handle")
        || utterance_lower.contains("taking this")
        || utterance_lower.contains("picking up")
        || (utterance_lower.contains("take") && utterance_lower.contains("ownership"))
    {
        IntentType::TakeOwnership
    } else if utterance_lower.contains("release")
        || utterance_lower.contains("give up")
        || utterance_lower.contains("drop this")
        || utterance_lower.contains("can't work on")
        || utterance_lower.contains("no longer working")
    {
        IntentType::ReleaseOwnership
    } else if utterance_lower.contains("completed")
        || utterance_lower.contains("finished")
        || utterance_lower.contains("done with")
        || utterance_lower.contains("completed task")
        || utterance_lower.contains("task is done")
    {
        IntentType::CompleteTask
    } else if utterance_lower.contains("starting")
        || utterance_lower.contains("begin work")
        || utterance_lower.contains("working on")
        || (utterance_lower.contains("start") && utterance_lower.contains("task"))
    {
        IntentType::StartWork
    } else if utterance_lower.contains("move") || utterance_lower.contains("change") {
        if utterance_lower.contains("ready") || utterance_lower.contains("status") {
            IntentType::UpdateStatus
        } else if utterance_lower.contains("sprint") {
            IntentType::MoveToSprint
        } else {
            IntentType::UpdateStatus
        }
    } else {
        IntentType::Unknown
    };

    intent_type
}

fn main() {
    let test_cases = vec![
        "I'll take ownership and move forward",
        "I'll take this task",
        "move story to ready",
        "I'll work on this and move it forward",
        "take ownership and move to ready",
        "I'll take this and change the status",
        "taking ownership and moving forward",
        "taking this task",
    ];

    for test_case in test_cases {
        let result = fallback_heuristic_parse(test_case);
        println!("'{}' -> {:?}", test_case, result);
        
        // Debug the specific conditions
        let utterance_lower = test_case.to_lowercase();
        println!("  - contains 'taking this': {}", utterance_lower.contains("taking this"));
        println!("  - contains 'take' and 'ownership': {}", utterance_lower.contains("take") && utterance_lower.contains("ownership"));
        println!();
    }
}