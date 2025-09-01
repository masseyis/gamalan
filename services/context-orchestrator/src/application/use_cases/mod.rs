pub mod interpret_use_case;
pub mod act_use_case;

pub use interpret_use_case::{InterpretUseCase, InterpretResult};
pub use act_use_case::{ActUseCase, ActResult, ActionResult};