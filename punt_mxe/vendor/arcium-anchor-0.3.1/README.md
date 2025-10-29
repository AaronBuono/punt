# arcium-anchor

[![Crates.io](https://img.shields.io/crates/v/arcium-anchor.svg)](https://crates.io/crates/arcium-anchor)

A helper crate for integrating Arcium into Solana programs. Provides utilities, traits, and account types that simplify the development of Anchor-based Solana programs that interact with the Arcium network for encrypted computations.

## Usage

```rust
use arcium_anchor::{
    queue_computation, finalize_computation, init_comp_def,
    ComputationOutputs, SharedEncryptedStruct, MXEEncryptedStruct,
    traits::{QueueCompAccs, FinalizeCompAccs, InitCompDefAccs},
    prelude::*,
};

// Initialize a computation definition
init_comp_def(&ctx.accounts, circuit_id, inputs_spec)?;

// Queue a computation for execution
queue_computation(&ctx.accounts, inputs)?;

// Handle computation results
match computation_output {
    ComputationOutputs::Success(data) => {
        // Process successful computation
    },
    ComputationOutputs::Failure => {
        // Handle computation failure
    },
}
```

## Main Exports

### Core Functions

- `queue_computation()` - Queue an encrypted computation for execution
- `init_comp_def()` - Initialize a computation definition on-chain
- `comp_def_offset()` - Calculate computation definition account offset

### Types

- `ComputationOutputs<O>` - Enum for computation results (Success/Failure)
- `SharedEncryptedStruct<const LEN: usize>` - Container for shared encrypted data
- `MXEEncryptedStruct<const LEN: usize>` - Container for MXE encrypted data

### Traits

- `QueueCompAccs` - Trait for accounts that can queue computations
- `FinalizeCompAccs` - Trait for accounts that can finalize computations
- `InitCompDefAccs` - Trait for accounts that can initialize computation definitions

### PDA Utilities

Various helper macros for deriving Program Derived Addresses (PDAs) used by Arcium accounts.
