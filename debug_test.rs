fn main() {
    let test = "taking ownership and moving forward";
    let test_lower = test.to_lowercase();
    
    println!("Test: '{}'", test);
    println!("Contains 'take': {}", test_lower.contains("take"));
    println!("Contains 'ownership': {}", test_lower.contains("ownership"));
    println!("Both conditions: {}", test_lower.contains("take") && test_lower.contains("ownership"));
}