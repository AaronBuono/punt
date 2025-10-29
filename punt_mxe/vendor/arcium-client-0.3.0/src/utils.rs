use anchor_client::{anchor_lang::prelude::*, solana_sdk::hash::hashv};

// Maximum realloc size per ix
pub const MAX_REALLOC_SIZE_PER_IX: usize = 10240; // 10KB = 10 * 1024

// Maximum size of a Solana account in bytes.
pub const MAX_SOL_ACCOUNT_SIZE_BYTES: usize = 10485760; // 10MB = 10 * 1024 * 1024

// Size of the metadata in the raw circuit account. 1 byte for the bump, 8 for the discriminator.
pub const METADATA_SIZE_RAW_CIRCUIT_ACC: usize = 9;

// Maximum number of circuit bytes per raw circuit account.
pub const MAX_RAW_CIRCUIT_BYTES_PER_ACC: usize =
    MAX_SOL_ACCOUNT_SIZE_BYTES - METADATA_SIZE_RAW_CIRCUIT_ACC;

pub(crate) fn sha256(vals: &[&[u8]]) -> [u8; 32] {
    hashv(vals).to_bytes()
}

/// Derive a unique identifier for a computation based on the mxe and offset.
/// Used as an identifier within the arx.
pub fn derive_unique_computation_id(mxe_prog_id: &Pubkey, computation_offset: u64) -> u128 {
    let hash = sha256(&[&mxe_prog_id.to_bytes(), &computation_offset.to_le_bytes()]);

    // truncating the hash to 16 bytes should be acceptable for our use case
    // since sha256 ouputs 32 bytes, we can just take the first 16 bytes.
    // Unwrap here is fine since we know sha256 outputs 32 bytes
    u128::from_le_bytes(hash[0..16].try_into().unwrap())
}
