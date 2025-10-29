//! This module contains a set of traits that are used
//! to make the functions in the main module need to take less params
//! (e.g. not needing the mxe_offset as a separate param and instead directly calling
//! .mxe_offset() on the provided param assuming it implements the trait).
//! We do it like this because the objects that usually end up implementing this are
//! the anchor account structs, which we can't directly modify to add the fields
//! that we need to pass to the functions in the main module. Therefore these
//! get mostly implemented by macros in arcium-macros.
use anchor_lang::{prelude::Pubkey, solana_program::account_info::AccountInfo};
use arcium_client::idl::arcium::{
    cpi::accounts::QueueComputation,
    types::{CallbackAccount, CallbackInstruction, Output, Parameter},
};

pub trait QueueCompAccs<'info> {
    fn comp_def_offset(&self) -> u32;
    fn queue_comp_accs(&self) -> QueueComputation<'info>;
    fn arcium_program(&self) -> AccountInfo<'info>;
    fn mxe_program(&self) -> Pubkey;
    fn signer_pda_bump(&self) -> u8;
}

pub trait CallbackCompAccs {
    fn callback_ix(extra_accs: &[CallbackAccount]) -> CallbackInstruction;
}

pub trait InitCompDefAccs<'info> {
    fn arcium_program(&self) -> AccountInfo<'info>;
    fn mxe_program(&self) -> Pubkey;
    fn signer(&self) -> AccountInfo<'info>;
    fn mxe_acc(&self) -> AccountInfo<'info>;
    fn comp_def_acc(&self) -> AccountInfo<'info>;
    fn system_program(&self) -> AccountInfo<'info>;
    fn params(&self) -> Vec<Parameter>;
    fn outputs(&self) -> Vec<Output>;
    fn comp_def_offset(&self) -> u32;
    fn compiled_circuit_len(&self) -> u32;
}
