use anchor_lang::prelude::*;
use arcium_client::idl::arcium::{
    cpi::{accounts::InitComputationDefinition, init_computation_definition},
    types::{
        Argument,
        CallbackInstruction,
        CircuitSource,
        ComputationDefinitionMeta,
        ComputationSignature,
        Parameter,
    },
};
use traits::{InitCompDefAccs, QueueCompAccs};

pub mod traits;

pub mod prelude {
    pub use super::*;
    pub use arcium_client::idl::arcium::{
        accounts::{ClockAccount, Cluster, ComputationDefinitionAccount, FeePool, MXEAccount},
        program::Arcium,
        types::Argument,
        ID_CONST as ARCIUM_PROG_ID,
    };
    pub use arcium_macros::{
        arcium_callback,
        arcium_program,
        callback_accounts,
        check_args,
        init_computation_definition_accounts,
        queue_computation_accounts,
    };
    pub use traits::CallbackCompAccs;
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SharedEncryptedStruct<const LEN: usize> {
    pub encryption_key: [u8; 32],
    pub nonce: u128,
    pub ciphertexts: [[u8; 32]; LEN],
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MXEEncryptedStruct<const LEN: usize> {
    pub nonce: u128,
    pub ciphertexts: [[u8; 32]; LEN],
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct EncDataStruct<const LEN: usize> {
    pub ciphertexts: [[u8; 32]; LEN],
}

// a struct matching this is present in arx/src/utils.rs
// when making changes here, make sure to update the arx version (e.g. if adding a new variant)
#[derive(Debug, AnchorSerialize, AnchorDeserialize)]
pub enum ComputationOutputs<O> {
    Success(O),
    Failure,
}

pub fn queue_computation<'info, T>(
    accs: &T,
    computation_offset: u64,
    args: Vec<Argument>,
    callback_url: Option<String>,
    callback_instructions: Vec<CallbackInstruction>,
) -> Result<()>
where
    T: QueueCompAccs<'info>,
{
    let signer_seeds: &[&[&[u8]]] = &[&[SIGN_PDA_SEED, &[accs.signer_pda_bump()]]];
    let cpi_context =
        CpiContext::new_with_signer(accs.arcium_program(), accs.queue_comp_accs(), signer_seeds);
    arcium_client::idl::arcium::cpi::queue_computation(
        cpi_context,
        computation_offset,
        accs.comp_def_offset(),
        None,
        args,
        accs.mxe_program(),
        callback_url,
        callback_instructions,
        0,
        0,
        0,
    )
}

pub fn init_comp_def<'info, T>(
    accs: &T,
    finalize_during_callback: bool,
    cu_amount: u64,
    circuit_source_override: Option<CircuitSource>,
    finalize_authority: Option<Pubkey>,
) -> Result<()>
where
    T: InitCompDefAccs<'info>,
{
    let cpi_context = CpiContext::new(
        accs.arcium_program(),
        InitComputationDefinition {
            signer: accs.signer(),
            system_program: accs.system_program(),
            mxe: accs.mxe_acc(),
            comp_def_acc: accs.comp_def_acc(),
        },
    );

    let signature = ComputationSignature {
        parameters: accs.params(),
        outputs: accs.outputs(),
    };
    let computation_definition = ComputationDefinitionMeta {
        circuit_len: accs.compiled_circuit_len(),
        signature,
    };
    init_computation_definition(
        cpi_context,
        accs.comp_def_offset(),
        accs.mxe_program(),
        computation_definition,
        circuit_source_override,
        cu_amount,
        finalize_authority,
        finalize_during_callback,
    )?;

    Ok(())
}

#[macro_export]
macro_rules! derive_seed {
    ($name:ident) => {
        stringify!($name).as_bytes()
    };
}

pub const fn comp_def_offset(conf_ix_name: &str) -> u32 {
    let hasher = ::sha2_const_stable::Sha256::new();
    let result = hasher.update(conf_ix_name.as_bytes()).finalize();
    u32::from_le_bytes([result[0], result[1], result[2], result[3]])
}

pub const MXE_PDA_SEED: &[u8] = derive_seed!(MXEAccount);
pub const MEMPOOL_PDA_SEED: &[u8] = b"Mempool";
pub const EXECPOOL_PDA_SEED: &[u8] = b"Execpool";
pub const COMP_PDA_SEED: &[u8] = derive_seed!(ComputationAccount);
pub const COMP_DEF_PDA_SEED: &[u8] = derive_seed!(ComputationDefinitionAccount);
pub const CLUSTER_PDA_SEED: &[u8] = derive_seed!(Cluster);
pub const POOL_PDA_SEED: &[u8] = derive_seed!(FeePool);
pub const CLOCK_PDA_SEED: &[u8] = derive_seed!(ClockAccount);
pub const SIGN_PDA_SEED: &[u8] = derive_seed!(SignerAccount);

pub const ARCIUM_CLOCK_ACCOUNT_ADDRESS: Pubkey = Pubkey::new_from_array([
    212, 85, 34, 0, 53, 147, 95, 180, 158, 156, 108, 40, 138, 177, 241, 37, 193, 113, 49, 48, 98,
    57, 195, 10, 201, 244, 92, 111, 3, 191, 25, 130,
]);

pub const ARCIUM_FEE_POOL_ACCOUNT_ADDRESS: Pubkey = Pubkey::new_from_array([
    94, 87, 49, 175, 232, 200, 92, 37, 140, 243, 194, 109, 249, 141, 31, 66, 59, 91, 113, 165, 232,
    167, 54, 30, 164, 219, 3, 225, 61, 227, 94, 8,
]);

#[macro_export]
macro_rules! derive_mxe_pda {
    () => {
        Pubkey::find_program_address(&[MXE_PDA_SEED, ID.to_bytes().as_ref()], &ARCIUM_PROG_ID).0
    };
}

#[macro_export]
macro_rules! derive_mempool_pda {
    () => {
        Pubkey::find_program_address(&[MEMPOOL_PDA_SEED, ID.to_bytes().as_ref()], &ARCIUM_PROG_ID).0
    };
}

#[macro_export]
macro_rules! derive_execpool_pda {
    () => {
        Pubkey::find_program_address(
            &[EXECPOOL_PDA_SEED, ID.to_bytes().as_ref()],
            &ARCIUM_PROG_ID,
        )
        .0
    };
}

#[macro_export]
macro_rules! derive_comp_pda {
    ($computation_offset:expr) => {
        Pubkey::find_program_address(
            &[
                COMP_PDA_SEED,
                ID.to_bytes().as_ref(),
                &$computation_offset.to_le_bytes(),
            ],
            &ARCIUM_PROG_ID,
        )
        .0
    };
}

#[macro_export]
macro_rules! derive_comp_def_pda {
    ($conf_ix_name:expr) => {
        Pubkey::find_program_address(
            &[
                COMP_DEF_PDA_SEED,
                &ID_CONST.to_bytes(),
                &$conf_ix_name.to_le_bytes(),
            ],
            &ARCIUM_PROG_ID,
        )
        .0
    };
}

#[macro_export]
macro_rules! derive_cluster_pda {
    ($mxe_account:expr) => {
        Pubkey::find_program_address(
            &[
                CLUSTER_PDA_SEED,
                &$mxe_account
                    .cluster
                    .ok_or(ErrorCode::ClusterNotSet)?
                    .to_le_bytes(),
            ],
            &ARCIUM_PROG_ID,
        )
        .0
    };
}

#[macro_export]
macro_rules! derive_sign_pda {
    () => {
        Pubkey::find_program_address(&[SIGN_PDA_SEED], &ID_CONST).0
    };
}

enum ComputationMatchingError {
    AccountLenNotMultipleOf32(usize),
    AccountLenTooBig(usize),
    ArgumentMismatch(usize, Parameter),
    NotEnoughParams(usize),
    NotEnoughArguments,
}

impl ComputationMatchingError {
    #[allow(dead_code)]
    fn emit_solana_msg(&self, arguments: &[Argument]) {
        match self {
            ComputationMatchingError::AccountLenNotMultipleOf32(arg_id) => {
                msg!(
                    "Invalid argument : account {:?} len is not a multiple of 32",
                    &arguments[*arg_id],
                );
            }
            ComputationMatchingError::AccountLenTooBig(arg_id) => {
                msg!(
                    "Invalid argument : account {:?} is bigger than the circuit size",
                    &arguments[*arg_id],
                );
            }
            ComputationMatchingError::ArgumentMismatch(arg_id, param) => {
                msg!("Invalid argument {:?} for parameter {:?}", &arguments[*arg_id], param);
            }
            ComputationMatchingError::NotEnoughParams(arg_id) => {
                msg!("Invalid argument : no parameter matching for {:?}", &arguments[*arg_id]);
            }
            ComputationMatchingError::NotEnoughArguments => {
                msg!("Invalid arguments : not enough arguments");
            }
        }
    }
    #[allow(dead_code)]
    const fn const_panic(&self) {
        match self {
            ComputationMatchingError::AccountLenNotMultipleOf32(_) => {
                panic!("Invalid argument : account len is not a multiple of 32");
            }
            ComputationMatchingError::AccountLenTooBig(_) => {
                panic!("Invalid argument : account is bigger than the circuit size");
            }
            ComputationMatchingError::ArgumentMismatch(_, _) => {
                panic!("Invalid argument, mismatch with parameter");
            }
            ComputationMatchingError::NotEnoughParams(_) => {
                panic!("Invalid argument : not enough params");
            }
            ComputationMatchingError::NotEnoughArguments => {
                panic!("Invalid arguments : not enough arguments");
            }
        }
    }
}
const fn arg_match_param(arg: &Argument, param: &Parameter) -> bool {
    match arg {
        Argument::ManticoreAlgo(_) => matches!(param, Parameter::ManticoreAlgo),
        Argument::InputDataset(_) => matches!(param, Parameter::InputDataset),
        Argument::PlaintextBool(_) => matches!(param, Parameter::PlaintextBool),
        Argument::PlaintextU8(_) => matches!(param, Parameter::PlaintextU8),
        Argument::PlaintextU16(_) => matches!(param, Parameter::PlaintextU16),
        Argument::PlaintextU32(_) => matches!(param, Parameter::PlaintextU32),
        Argument::PlaintextU64(_) => matches!(param, Parameter::PlaintextU64),
        Argument::PlaintextU128(_) => matches!(param, Parameter::PlaintextU128),
        Argument::PlaintextFloat(_) => matches!(param, Parameter::PlaintextFloat),
        Argument::EncryptedBool(_) => matches!(param, Parameter::Ciphertext),
        Argument::EncryptedU8(_) => matches!(param, Parameter::Ciphertext),
        Argument::EncryptedU16(_) => matches!(param, Parameter::Ciphertext),
        Argument::EncryptedU32(_) => matches!(param, Parameter::Ciphertext),
        Argument::EncryptedU64(_) => matches!(param, Parameter::Ciphertext),
        Argument::EncryptedU128(_) => matches!(param, Parameter::Ciphertext),
        Argument::EncryptedFloat(_) => matches!(param, Parameter::Ciphertext),
        Argument::ArcisPubkey(_) => matches!(param, Parameter::ArcisPubkey),
        Argument::ArcisSignature(_) => {
            panic!("ArcisSignature are not supposed to reach this function.")
        }
        Argument::Account(_, _, _) => {
            panic!("Accounts are not supposed to reach this function.")
        }
    }
}
const fn args_match_params(arguments: &[Argument], parameters: &[Parameter]) -> core::result::Result<(), ComputationMatchingError> {
    // Validate the arguments match the parameters
    let mut param_idx = 0;
    let mut arg_idx = 0;
    while arg_idx < arguments.len() {
        let arg = &arguments[arg_idx];
        if let Argument::Account(_, _, arg_len) = arg {
            if arg_len.rem_euclid(32) != 0 {
                return Err(ComputationMatchingError::AccountLenNotMultipleOf32(arg_idx));
            }
            param_idx += (*arg_len as usize) / 32;
            // >= is ok, the account finishes right at the end
            if param_idx > parameters.len() {
                return Err(ComputationMatchingError::AccountLenTooBig(arg_idx));
            }
        } else if let Argument::ArcisSignature(..) = arg {
            let mut sig_to_64 = 0u8;
            while sig_to_64 < 64 {
                sig_to_64 += 1;
                if param_idx >= parameters.len() {
                    return Err(ComputationMatchingError::NotEnoughParams(arg_idx));
                }
                let param = &parameters[param_idx];
                if !matches!(param, Parameter::PlaintextU8) {
                    return Err(ComputationMatchingError::ArgumentMismatch(arg_idx, *param));
                }
                param_idx += 1;
            }
        } else {
            if param_idx >= parameters.len() {
                return Err(ComputationMatchingError::NotEnoughParams(arg_idx));
            }
            let param = &parameters[param_idx];
            if !arg_match_param(arg, param) {
                return Err(ComputationMatchingError::ArgumentMismatch(arg_idx, *param));
            }
            param_idx += 1;
        }
        arg_idx += 1;
    }
    if param_idx < parameters.len() {
        return Err(ComputationMatchingError::NotEnoughArguments)
    }

    Ok(())
}

pub const fn const_match_computation(arguments: &[Argument], parameters: &[Parameter]) {
    if let Err(err) = args_match_params(arguments, parameters) {
        err.const_panic();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use arcium_client::idl::arcium::ID_CONST as ARCIUM_PROG_ID;

    fn derive_arcium_pda(seeds: &[&[u8]]) -> Pubkey {
        Pubkey::find_program_address(seeds, &ARCIUM_PROG_ID).0
    }

    #[test]
    fn test_comp_def_offset() {
        let conf_ix_name = "add_together";
        let offset = comp_def_offset(conf_ix_name);
        assert_eq!(offset, 4005749700);
    }

    #[test]
    fn test_clock_account_address() {
        let address = derive_arcium_pda(&[CLOCK_PDA_SEED]);
        assert_eq!(address, ARCIUM_CLOCK_ACCOUNT_ADDRESS);
    }

    #[test]
    fn test_fee_pool_account_address() {
        let address = derive_arcium_pda(&[POOL_PDA_SEED]);
        assert_eq!(address, ARCIUM_FEE_POOL_ACCOUNT_ADDRESS);
    }
}
