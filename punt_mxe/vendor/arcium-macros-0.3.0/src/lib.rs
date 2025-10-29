use arcium_program_macro::arcium_program_macro;
use callback_macros::{callback_accs_derive, callback_ix_derive, CallbackAccArgs};
use check_args_macro::check_args_fn;
use init_comp_def_macros::{init_comp_def_derive, InitCompDefArgs};
use proc_macro::TokenStream;
use queue_comp_macros::{queue_comp_derive, QueueCompArgs};
use syn::{parse_macro_input, DeriveInput, Item, ItemFn};
use utils::ArciumCallbackArgs;

mod arcium_program_macro;
mod callback_macros;
mod check_args_macro;
mod gen_callback_types;
mod init_comp_def_macros;
mod queue_comp_macros;
mod utils;
mod validation;

/// Automatically generates the callback instruction for a computations. Note: The name of the
/// instruction MUST be <encrypted_ix>_callback and exactly one ComputationOutputs argument (outside
/// of the `Context` arg) is allowed.
///
/// ```ignore
/// #[callback_accounts("my_circuit", payer)]
/// #[derive(Accounts)]
/// pub struct Callback<'info> {
///     #[account(mut)]
///     pub payer: Signer<'info>,
///     pub arcium_program: Program<'info, Arcium>,
///     #[account(
///         address = derive_comp_def_pda!(COMP_DEF_OFFSET)
///     )]
///     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
///     #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
///     /// CHECK: instructions_sysvar, checked by the account constraint
///     pub instructions_sysvar: AccountInfo<'info>,
/// }
///
/// #[arcium_program]
/// pub mod sample_program {
///     // Will be called when the computation with circuit "my_circuit" resolves
///     #[arcium_callback(encrypted_ix = "my_circuit")]
///     pub fn my_circuit_callback(ctx: Context<Callback>, output: ComputationOutputs) -> Result<()> {
///         msg!("Arcium callback invoked with output {:?}", output);
///         Ok(())
///     }
/// }
/// ```
#[proc_macro_attribute]
pub fn arcium_callback(args: TokenStream, item: TokenStream) -> TokenStream {
    let args = parse_macro_input!(args as ArciumCallbackArgs);
    let input_fn = parse_macro_input!(item as ItemFn);
    callback_ix_derive(input_fn, args)
}

/// Validates the structure for queuing computations by checking the encrypted instruction exists,
/// validating required account fields, and implementing the `QueueCompAccs` trait to make using it
/// with queuing computations easy:
///
/// ```ignore
/// #[queue_computation_accounts("add_together", payer)]
/// #[derive(Accounts)]
/// pub struct InitComputation<'info> {
///     #[account(mut)]
///     pub payer: Signer<'info>,
///     #[account(
///         address = derive_mxe_pda!()
///     )]
///     pub mxe_account: Account<'info, MXEAccount>,
///     #[account(
///         mut,
///         address = derive_mempool_pda!()
///     )]
///     pub mempool_account: Account<'info, Mempool>,
///     #[account(
///         mut,
///         address = derive_execpool_pda!()
///     )]
///     pub executing_pool: Account<'info, ExecutingPool>,
///     #[account(
///         address = derive_comp_def_pda!(COMP_DEF_OFFSET)
///     )]
///     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
///     #[account(
///         mut,
///         address = derive_cluster_pda!(mxe_account)
///     )]
///     pub cluster_account: Account<'info, Cluster>,
///     #[account(
///         mut,
///         address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
///     )]
///     pub pool_account: Account<'info, FeePool>,
///     #[account(
///         address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
///     )]
///     pub clock_account: Account<'info, ClockAccount>,
///     pub system_program: Program<'info, System>,
///     pub arcium_program: Program<'info, Arcium>,
/// }
///
/// #[arcium_program]
/// pub mod sample_program {
///     pub fn init_computation(ctx: Context<InitComputation>, x: [u8; 32], y: [u8; 32]) -> Result<()> {
///         // This will queue a computation that will execute
///         // "my_circuit" when it resolves
///         let args = vec![
///             Argument::EncryptedU8(x),
///             Argument::EncryptedU8(y),
///         ];
///         queue_computation(ctx.accounts, args, vec![], None)?;
///         Ok(())
///     }
/// }
/// ```
#[proc_macro_attribute]
pub fn queue_computation_accounts(
    args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    // Parse the input tokens into a syntax tree
    let mut input = parse_macro_input!(item as DeriveInput);
    let args = parse_macro_input!(args as QueueCompArgs);
    queue_comp_derive(&mut input, args)
}

/// Validates the structure for computation callbacks by checking the encrypted instruction exists,
/// validating required account fields, and ensuring the structure has the correct fields for
/// callbacks:
///
/// ```ignore
/// #[callback_accounts("my_circuit", payer)]
/// #[derive(Accounts)]
/// pub struct Callback<'info> {
///     #[account(mut)]
///     pub payer: Signer<'info>,
///     pub arcium_program: Program<'info, Arcium>,
///     #[account(
///         address = derive_comp_def_pda!(COMP_DEF_OFFSET)
///     )]
///     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
///     #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
///     /// CHECK: instructions_sysvar, checked by the account constraint
///     pub instructions_sysvar: AccountInfo<'info>,
/// }
///
/// #[arcium_program]
/// pub mod sample_program {
///     // Will be called when the computation with circuit "my_circuit" resolves
///     #[arcium_callback(encrypted_ix = "my_circuit")]
///     pub fn my_circuit_callback(ctx: Context<Callback>, output: ComputationOutputs) -> Result<()> {
///         msg!("Arcium callback invoked with output {:?}", output);
///         Ok(())
///     }
/// }
/// ```
#[proc_macro_attribute]
pub fn callback_accounts(
    args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    // Parse the input tokens into a syntax tree
    let input = parse_macro_input!(item as DeriveInput);
    let args = parse_macro_input!(args as CallbackAccArgs);
    callback_accs_derive(&input, args)
}

/// The #[arcium_program] attribute defines the module
/// containing all instruction handlers defining all entries into a Solana program.
/// Under the hood, it gets expanded to Anchor's #[program] and some additional definitions needed
/// for Arcium.
#[proc_macro_attribute]
pub fn arcium_program(
    _args: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    // Parse the input tokens into a syntax tree
    let mut input = parse_macro_input!(item as Item);
    arcium_program_macro(&mut input)
}

/// Validates the structure for initializing computation definitions by checking the encrypted
/// instruction exists, validating required account fields, and implementing the `InitCompDefAccs`
/// trait to make using it with computation definitions easy:
///
/// ```ignore
/// #[init_computation_definition_accounts("my_circuit", payer)]
/// #[derive(Accounts)]
/// pub struct InitMyCircuitCompDef<'info> {
///     #[account(mut)]
///     pub payer: Signer<'info>,
///     #[account(
///         mut,
///         address = derive_mxe_pda!()
///     )]
///     pub mxe_account: Box<Account<'info, MXEAccount>>,
///     #[account(mut)]
///     /// CHECK: comp_def_account, checked by arcium program.
///     /// Can't check it here as it's not initialized yet.
///     pub comp_def_account: UncheckedAccount<'info>,
///     pub arcium_program: Program<'info, Arcium>,
///     pub system_program: Program<'info, System>,
/// }
/// ```
#[proc_macro_attribute]
pub fn init_computation_definition_accounts(args: TokenStream, item: TokenStream) -> TokenStream {
    // Parse the macro arguments
    let args = parse_macro_input!(args as InitCompDefArgs);

    // Parse the input tokens into a syntax tree
    let mut input = parse_macro_input!(item as DeriveInput);

    // Call the inner function with the parsed arguments
    init_comp_def_derive(&mut input, args)
}

/// Compile-time validation of computation arguments against an interface definition.
///
/// Usage:
/// Attach `#[check_args]` to your function.
/// Attach `#[args("your_encrypted_instruction")]` to your computation arguments
/// (either an array literal or a vec! macro).
///
/// Checks performed:
/// - Correct number, type, and order of arguments based on the interface file
///   (`build/your_circuit_name.idarc`).
/// - Validates that the provided arguments match the expected types and count.
#[proc_macro_attribute]
pub fn check_args(_args: TokenStream, item: TokenStream) -> TokenStream {
    // Parse as a Stmt
    let input = parse_macro_input!(item as ItemFn);
    check_args_fn(input).into()
}
