# arcium-client

[![Crates.io](https://img.shields.io/crates/v/arcium-client.svg)](https://crates.io/crates/arcium-client)

A client-side library for interacting with the Arcium Solana program. Provides the program IDL, account types, and transaction building utilities for applications that integrate with the Arcium network.

## Usage

```rust
use arcium_client::{ARCIUM_PROGRAM_ID, idl};

// Access the Arcium program ID
let program_id = ARCIUM_PROGRAM_ID;
```

Enable the `transactions` feature for additional transaction building and PDA utilities.

## Main Exports

### Constants

- `ARCIUM_PROGRAM_ID` - The on-chain program ID for the Arcium Solana program

### Modules

- `idl` - Interface Definition Language types and structures
- `instruction` - Instruction builders (with "transactions" feature)
- `pda` - Program Derived Address utilities (with "transactions" feature)
- `state` - Account state definitions (with "transactions" feature)
- `transactions` - Transaction building helpers (with "transactions" feature)
