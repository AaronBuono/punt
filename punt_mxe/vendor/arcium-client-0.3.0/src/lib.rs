use anchor_lang::prelude::Pubkey;

pub mod idl;
pub const ARCIUM_PROGRAM_ID: Pubkey = idl::arcium::ID_CONST;
#[cfg(feature = "transactions")]
pub mod instruction;
#[cfg(feature = "transactions")]
pub mod pda;
#[cfg(feature = "transactions")]
pub mod state;
#[cfg(feature = "transactions")]
pub mod transactions;
#[cfg(feature = "transactions")]
pub mod utils;
