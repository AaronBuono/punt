# arcium-macros

[![Crates.io](https://img.shields.io/crates/v/arcium-macros.svg)](https://crates.io/crates/arcium-macros)

Helper macros for developing Solana programs that integrate with the Arcium network. Reduces boilerplate and enforces correct account structures for encrypted computations.

## Available Macros

### `#[arcium_program]`

This attribute is the primary macro for an Arcium-integrated program. It should be used on the module containing your instruction handlers. It wraps Anchor's `#[program]` attribute and injects additional definitions required by Arcium.

```rust
#[arcium_program]
pub mod my_arcium_program {
    // Instruction handlers go here
}
```

### `#[queue_computation_accounts]`

Use this attribute on an `Accounts` struct for instructions that queue an MPC computation. It validates the struct and implements the `QueueCompAccs` trait from `arcium_anchor`.

```rust
#[queue_computation_accounts("my_circuit", payer)]
#[derive(Accounts)]
pub struct QueueMyCircuit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    // ... other required Arcium accounts
}
```

### `#[arcium_callback]`

This attribute marks a function as the callback handler for a MPC computation. It validates the function name and signature. The function must be named `<encrypted_ix>_callback` and take exactly one `ComputationOutputs` argument (outside of the `Context` arg).

```rust
#[arcium_callback(encrypted_ix = "my_circuit")]
pub fn my_circuit_callback(ctx: Context<Callback>, output: ComputationOutputs) -> Result<()> {
    msg!("Computation finished with output: {:?}", output);
    Ok(())
}
```

### `#[callback_accounts]`

Apply this attribute to an `Accounts` struct used by a callback instruction. It validates that the struct has the necessary accounts for processing a computation's results.

```rust
#[callback_accounts("my_circuit", payer)]
#[derive(Accounts)]
pub struct Callback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    // ... other required Arcium accounts
}
```

### `#[init_computation_definition_accounts]`

This attribute validates an `Accounts` struct used to initialize a new `ComputationDefinitionAccount` on-chain. It also implements the `InitCompDefAccs` trait from `arcium_anchor`.

```rust
#[init_computation_definition_accounts("my_circuit", payer)]
#[derive(Accounts)]
pub struct InitMyCircuitCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    // ... other required Arcium accounts
}
```
