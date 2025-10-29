//! Instruction builders for the Arcium programs.
use crate::{
    idl::arcium::{
        accounts::MXEAccount,
        client::{
            accounts::{
                ActivateArx as ActivateArxAccs,
                ActivateCluster as ActivateClusterAccs,
                BumpEpochCluster as BumpEpochClusterAccs,
                CallbackComputation as CallbackComputationAccs,
                DeactivateArx as DeactivateArxAccs,
                DeactivateCluster as DeactivateClusterAccs,
                EmbiggenRawCircuitAcc as EmbiggenRawCircuitAccAccs,
                FinalizeComputation as FinalizeComputationAccs,
                FinalizeMxeKeys as FinalizeMxeKeysAccs,
                IncreaseMempoolSize as IncreaseMempoolSizeAccs,
                Init as InitNetworkProgramAccs,
                InitArxNode as InitArxNodeAccs,
                InitCluster as InitClusterAccs,
                InitComputationDefinition as InitComputationDefinitionAccs,
                InitMxe as InitMxeAccs,
                InitOperator as InitOperatorAccs,
                InitRawCircuitAcc as InitRawCircuitAccs,
                JoinCluster as JoinClusterAccs,
                LeaveMxe as LeaveMxeAccs,
                ProposeFee as ProposeFeeAccs,
                ProposeJoinCluster as ProposeJoinClusterAccs,
                QueueComputation as QueueComputationAccs,
                SetArxNodeConfig as SetArxNodeConfigAccs,
                SetArxNodeMetadata as SetArxNodeMetadataAccs,
                SetCluster as SetClusterAccs,
                SetClusterAuthority as SetClusterAuthorityAccs,
                SetMxeKeys as SetMxeKeysAccs,
                UpdateCurrentEpochIdempotent as UpdateCurrentEpochIdempotentAccs,
                UploadCircuit as UploadCircuitAccs,
                VoteFee as VoteFeeAccs,
            },
            args::{
                ActivateArx as ActivateArxArgs,
                ActivateCluster as ActivateClusterArgs,
                BumpEpochCluster as BumpEpochClusterArgs,
                CallbackComputation as CallbackComputationArgs,
                DeactivateArx as DeactivateArxArgs,
                DeactivateCluster as DeactivateClusterArgs,
                EmbiggenRawCircuitAcc as EmbiggenRawCircuitAccArgs,
                FinalizeComputation as FinalizeComputationArgs,
                FinalizeMxeKeys as FinalizeMxeKeysArgs,
                IncreaseMempoolSize as IncreaseMempoolSizeArgs,
                Init as InitNetworkProgramArgs,
                InitArxNode as InitArxNodeArgs,
                InitCluster as InitClusterArgs,
                InitComputationDefinition as InitComputationDefinitionArgs,
                InitMxe as InitMxeArgs,
                InitOperator as InitOperatorArgs,
                InitRawCircuitAcc as InitRawCircuitArgs,
                JoinCluster as JoinClusterArgs,
                LeaveMxe as LeaveMxeArgs,
                ProposeFee as ProposeFeeArgs,
                ProposeJoinCluster as ProposeJoinClusterArgs,
                QueueComputation as QueueComputationArgs,
                SetArxNodeConfig as SetArxNodeConfigArgs,
                SetArxNodeMetadata as SetArxNodeMetadataArgs,
                SetCluster as SetClusterArgs,
                SetClusterAuthority as SetClusterAuthorityArgs,
                SetMxeKeys as SetMxeKeysArgs,
                UpdateCurrentEpochIdempotent as UpdateCurrentEpochIdempotentArgs,
                UploadCircuit as UploadCircuitArgs,
                VoteFee as VoteFeeArgs,
            },
        },
        types::{
            Argument,
            ArxNodeConfig,
            CallbackAccount,
            CallbackInstruction,
            CircuitSource,
            ComputationDefinitionMeta,
            ComputationSignature,
            Epoch,
            ExecutionStatus,
            MempoolSize,
            NodeMetadata,
            OperatorMeta,
            Output,
            Parameter,
            Timestamp,
        },
        ID as ARCIUM_PROG_ID,
    },
    pda::{
        arx_acc,
        clock_acc,
        cluster_acc,
        computation_acc,
        computation_definition_acc,
        execpool_acc,
        fee_pool_acc,
        mempool_acc,
        mxe_acc,
        operator_acc,
        raw_circuit_acc,
        signer_acc,
    },
};
use anchor_client::solana_sdk::{
    instruction::Instruction,
    system_program::ID as SYSTEM_PROGRAM_ID,
    sysvar,
};
use anchor_lang::{
    prelude::*,
    solana_program::sysvar::instructions::ID as INSTRUCTIONS_SYSVAR_ID,
    InstructionData,
};
use std::vec;

pub const ARCIUM_TOKEN_DECIMALS: u8 = 9;

pub fn init_network_program_ix(current_timestamp: u64, signer: &Pubkey) -> Instruction {
    let pool_acc = fee_pool_acc();
    let accounts = InitNetworkProgramAccs {
        signer: signer.to_owned(),
        fee_pool: pool_acc,
        system_program: SYSTEM_PROGRAM_ID,
        clock: clock_acc(),
    }
    .to_account_metas(None);
    let data = InitNetworkProgramArgs {
        start_epoch_timestamp: Timestamp {
            timestamp: current_timestamp,
        },
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

// Location as [ISO 3166-1 alpha-2](https://www.iso.org/iso-3166-country-codes.html) country code
pub fn init_node_operator_acc_ix(signer: &Pubkey, url: String, location: u8) -> Instruction {
    let accounts = InitOperatorAccs {
        signer: signer.to_owned(),
        operator_acc: operator_acc(signer),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = InitOperatorArgs {
        meta: OperatorMeta { url, location },
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn init_arx_node_acc_ix(
    operator_signer: &Pubkey,
    node_signer: &Pubkey,
    node_offset: u32,
    callback_authority: &Pubkey,
    cu_claim: u64,
    max_clusters: u32,
    metadata: NodeMetadata,
) -> Instruction {
    let accounts = InitArxNodeAccs {
        operator_signer: operator_signer.to_owned(),
        operator_acc: operator_acc(operator_signer),
        arx_node_acc: arx_acc(node_offset),
        system_program: SYSTEM_PROGRAM_ID,
        clock: clock_acc(),
    }
    .to_account_metas(None);
    let config = ArxNodeConfig {
        max_cluster_memberships: max_clusters,
        authority: node_signer.to_owned(),
        callback_authority: callback_authority.to_owned(),
    };
    let data = InitArxNodeArgs {
        node_offset,
        cu_capacity_claim: cu_claim,
        config,
        metadata,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn init_cluster_ix(
    signer: &Pubkey,
    cluster_authority: Pubkey,
    cluster_offset: u32,
    max_size: u32,
    cu_price: u64,
) -> Instruction {
    let accounts = InitClusterAccs {
        signer: signer.to_owned(),
        cluster_acc: cluster_acc(cluster_offset),
        authority: cluster_authority,
        pool_account: fee_pool_acc(),
        system_program: SYSTEM_PROGRAM_ID,
        clock: clock_acc(),
    }
    .to_account_metas(None);
    let data = InitClusterArgs {
        max_size,
        cluster_id: cluster_offset,
        cu_price,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn set_cluster_authority_ix(
    signer: &Pubkey,
    cluster_offset: u32,
    new_authority: Option<Pubkey>,
) -> Instruction {
    let accounts = SetClusterAuthorityAccs {
        current_authority: signer.to_owned(),
        cluster_acc: cluster_acc(cluster_offset),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = SetClusterAuthorityArgs {
        cluster_id: cluster_offset,
        new_authority,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn init_mxe_ix(
    signer: &Pubkey,
    mxe_program: &Pubkey,
    mxe_authority: Option<Pubkey>,
    cluster_offset: u32,
    mempool_size: MempoolSize,
) -> Instruction {
    let accounts = InitMxeAccs {
        signer: signer.to_owned(),
        mxe: mxe_acc(mxe_program),
        mempool: mempool_acc(mxe_program),
        execpool: execpool_acc(mxe_program),
        cluster: cluster_acc(cluster_offset),
        mxe_keygen_computation: computation_acc(mxe_program, 1),
        mxe_keygen_computation_definition: computation_definition_acc(mxe_program, 1),
        mxe_authority,
        mxe_program: *mxe_program,
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = InitMxeArgs {
        cluster_offset,
        mempool_size,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn init_computation_definition_ix(
    signer: &Pubkey,
    comp_def_offset: u32,
    mxe_program: &Pubkey,
    circuit_len: u32,
    parameters: Vec<Parameter>,
    outputs: Vec<Output>,
    cu_amount: u64,
    finalize_during_callback: bool,
    finalization_authority: Option<Pubkey>,
    circuit_source_override: Option<CircuitSource>,
) -> Instruction {
    let comp_def_acc = computation_definition_acc(mxe_program, comp_def_offset);
    let accounts = InitComputationDefinitionAccs {
        signer: signer.to_owned(),
        mxe: mxe_acc(mxe_program),
        comp_def_acc,
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = InitComputationDefinitionArgs {
        mxe_program: *mxe_program,
        comp_offset: comp_def_offset,
        computation_definition: ComputationDefinitionMeta {
            signature: ComputationSignature {
                parameters,
                outputs,
            },
            circuit_len,
        },
        circuit_source_override,
        finalization_authority,
        finalize_during_callback,
        cu_amount,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn init_raw_circuit_acc_ix(
    signer: &Pubkey,
    comp_def_offset: u32,
    mxe_program_id: &Pubkey,
    circuit_chunk_index: u8,
) -> Instruction {
    let comp_def_acc = computation_definition_acc(mxe_program_id, comp_def_offset);
    let accounts = InitRawCircuitAccs {
        signer: signer.to_owned(),
        comp_def_acc,
        comp_def_raw: raw_circuit_acc(&comp_def_acc, circuit_chunk_index),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = InitRawCircuitArgs {
        comp_offset: comp_def_offset,
        mxe_program: mxe_program_id.to_owned(),
        raw_circuit_index: circuit_chunk_index,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn upload_circuit_ix(
    signer: &Pubkey,
    mxe_program_id: &Pubkey,
    comp_def_offset: u32,
    circuit_chunk_index: u8,
    upload_data: [u8; 814],
    offset: u32,
) -> Instruction {
    let comp_def_acc = computation_definition_acc(mxe_program_id, comp_def_offset);
    let accounts = UploadCircuitAccs {
        signer: signer.to_owned(),
        comp_def_raw: raw_circuit_acc(&comp_def_acc, circuit_chunk_index),
        comp_def_acc,
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);

    let data = UploadCircuitArgs {
        comp_offset: comp_def_offset,
        mxe_program: mxe_program_id.to_owned(),
        raw_circuit_index: circuit_chunk_index,
        upload_data,
        offset,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn embiggen_raw_circuit_acc_ix(
    signer: &Pubkey,
    comp_def_offset: u32,
    mxe_program_id: &Pubkey,
    circuit_chunk_index: u8,
) -> Instruction {
    let comp_def_acc = computation_definition_acc(mxe_program_id, comp_def_offset);

    let accounts = EmbiggenRawCircuitAccAccs {
        signer: signer.to_owned(),
        comp_def_raw: raw_circuit_acc(&comp_def_acc, circuit_chunk_index),
        comp_def_acc,
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);

    let data = EmbiggenRawCircuitAccArgs {
        comp_offset: comp_def_offset,
        mxe_program: mxe_program_id.to_owned(),
        raw_circuit_index: circuit_chunk_index,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn increase_mempool_size_ix(signer: &Pubkey, mxe_program: &Pubkey) -> Instruction {
    let accounts = IncreaseMempoolSizeAccs {
        signer: signer.to_owned(),
        mempool: mempool_acc(mxe_program),
        mxe_program: mxe_program.to_owned(),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = IncreaseMempoolSizeArgs {}.data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn propose_join_cluster_ix(
    cluster_auth_signer: &Pubkey,
    cluster_offset: u32,
    node_offset: u32,
) -> Instruction {
    let accounts = ProposeJoinClusterAccs {
        cluster_authority: cluster_auth_signer.to_owned(),
        cluster_acc: cluster_acc(cluster_offset),
        arx_node_acc: arx_acc(node_offset),
        clock: clock_acc(),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = ProposeJoinClusterArgs {
        cluster_id: cluster_offset,
        node_bump: node_offset,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn join_cluster_ix(
    node_auth_signer: &Pubkey,
    cluster_offset: u32,
    node_offset: u32,
    join: bool,
) -> Instruction {
    let accounts = JoinClusterAccs {
        node_authority: node_auth_signer.to_owned(),
        cluster_acc: cluster_acc(cluster_offset),
        arx_node_acc: arx_acc(node_offset),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = JoinClusterArgs {
        cluster_id: cluster_offset,
        node_bump: node_offset,
        join,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn queue_computation_ix(
    payer: &Pubkey,
    mxe_program: &Pubkey,
    computation_offset: u64,
    comp_def_offset: u32,
    fallback_cluster_index: Option<u16>,
    args: Vec<Argument>,
    input_delivery_fee: u64,
    output_delivery_fee: u64,
    cu_price_micro: u64,
    mxe_data: MXEAccount,
    callback_url: Option<String>,
    callback_instructions: Vec<CallbackInstruction>,
) -> Result<Instruction> {
    let cluster_offset = fallback_cluster_index
        .map(|i| mxe_data.fallback_clusters[i as usize])
        .unwrap_or(mxe_data.cluster.ok_or(ProgramError::InvalidAccountData)?);

    let accounts = QueueComputationAccs {
        signer: payer.to_owned(),
        sign_seed: signer_acc(mxe_program),
        cluster: cluster_acc(cluster_offset),
        mxe: mxe_acc(mxe_program),
        mempool: mempool_acc(mxe_program),
        executing_pool: execpool_acc(mxe_program),
        comp_def_acc: computation_definition_acc(mxe_program, comp_def_offset),
        pool_account: fee_pool_acc(),
        system_program: SYSTEM_PROGRAM_ID,
        clock: clock_acc(),
        comp: computation_acc(mxe_program, computation_offset),
    }
    .to_account_metas(None);
    let data = QueueComputationArgs {
        mxe_program: *mxe_program,
        comp_offset: computation_offset,
        computation_definition_offset: comp_def_offset,
        cluster_index: fallback_cluster_index,
        input_delivery_fee,
        output_delivery_fee,
        cu_price_micro,
        callback_url,
        args,
        custom_callback_instructions: callback_instructions,
    }
    .data();

    Ok(Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    })
}

pub fn propose_fee_ix(
    node_auth_signer: Pubkey,
    cluster_offset: u32,
    node_offset: u32,
    proposed_fee: u64,
) -> Instruction {
    let accounts = ProposeFeeAccs {
        node_authority: node_auth_signer,
        cluster_acc: cluster_acc(cluster_offset),
        arx_node_acc: arx_acc(node_offset),
    }
    .to_account_metas(None);
    let data = ProposeFeeArgs {
        cluster_offset,
        node_offset,
        proposed_fee,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn vote_fee_ix(
    node_auth_signer: Pubkey,
    cluster_offset: u32,
    node_offset: u32,
    fee_vote: u64,
) -> Instruction {
    let accounts = VoteFeeAccs {
        node_authority: node_auth_signer,
        cluster_acc: cluster_acc(cluster_offset),
        arx_node_acc: arx_acc(node_offset),
    }
    .to_account_metas(None);
    let data = VoteFeeArgs {
        cluster_offset,
        node_offset,
        fee_vote,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn bump_epoch_cluster_ix(signer: &Pubkey, cluster_offset: u32) -> Instruction {
    let accounts = BumpEpochClusterAccs {
        signer: signer.key(),
        cluster_acc: cluster_acc(cluster_offset),
        clock: clock_acc(),
    }
    .to_account_metas(None);
    let data = BumpEpochClusterArgs { cluster_offset }.data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn leave_mxe_ix(signer: &Pubkey, mxe_program: &Pubkey, cluster_offset: u32) -> Instruction {
    let accounts = LeaveMxeAccs {
        authority: signer.to_owned(),
        cluster_acc: cluster_acc(cluster_offset),
        mxe: mxe_acc(mxe_program),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = LeaveMxeArgs {
        cluster_offset,
        mxe_program: *mxe_program,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn activate_arx_ix(signer: &Pubkey, node_offset: u32) -> Instruction {
    let arx_node_acc = arx_acc(node_offset);
    let accounts = ActivateArxAccs {
        signer: signer.key(),
        arx_node_acc,
        clock: clock_acc(),
    }
    .to_account_metas(None);
    let data = ActivateArxArgs { node_offset }.data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn deactivate_arx_ix(
    signer: &Pubkey,
    node_offset: u32,
    cluster_offsets: Vec<u32>,
) -> Instruction {
    let mut cluster_accounts: [Option<Pubkey>; 10] = [None; 10];
    for (i, offset) in cluster_offsets.iter().enumerate() {
        cluster_accounts[i] = Some(cluster_acc(*offset));
    }

    let arx_node_acc = arx_acc(node_offset);
    let accounts = DeactivateArxAccs {
        signer: signer.key(),
        arx_node_acc,
        clock: clock_acc(),
        cluster_acc_0: cluster_accounts[0],
        cluster_acc_1: cluster_accounts[1],
        cluster_acc_2: cluster_accounts[2],
        cluster_acc_3: cluster_accounts[3],
        cluster_acc_4: cluster_accounts[4],
        cluster_acc_5: cluster_accounts[5],
        cluster_acc_6: cluster_accounts[6],
        cluster_acc_7: cluster_accounts[7],
        cluster_acc_8: cluster_accounts[8],
        cluster_acc_9: cluster_accounts[9],
    }
    .to_account_metas(None);
    let data = DeactivateArxArgs { node_offset }.data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn activate_cluster_ix(signer: &Pubkey, cluster_offset: u32) -> Instruction {
    let accounts = ActivateClusterAccs {
        authority: signer.key(),
        cluster_acc: cluster_acc(cluster_offset),
        clock: clock_acc(),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = ActivateClusterArgs {
        cluster_id: cluster_offset,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn deactivate_cluster_ix(
    signer: &Pubkey,
    cluster_offset: u32,
    deactivation_epoch: Epoch,
) -> Instruction {
    let accounts = DeactivateClusterAccs {
        authority: signer.key(),
        cluster_acc: cluster_acc(cluster_offset),
        clock: clock_acc(),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = DeactivateClusterArgs {
        cluster_id: cluster_offset,
        deactivation_epoch,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn set_mxe_keys_ix(
    signer: &Pubkey,
    mxe_program: &Pubkey,
    node_offset: u32,
    cluster_offset: u32,
    mxe_x25519_pubkey: [u8; 32],
) -> Instruction {
    let accounts = SetMxeKeysAccs {
        signer: signer.key(),
        node: arx_acc(node_offset),
        mxe: mxe_acc(mxe_program),
        cluster_acc: cluster_acc(cluster_offset),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = SetMxeKeysArgs {
        node_offset,
        _mxe_program: *mxe_program,
        mxe_x25519_pubkey,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn finalize_mxe_keys_ix(
    signer: &Pubkey,
    mxe_program: &Pubkey,
    cluster_offset: u32,
) -> Instruction {
    let accounts = FinalizeMxeKeysAccs {
        signer: signer.key(),
        mxe: mxe_acc(mxe_program),
        cluster: cluster_acc(cluster_offset),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = FinalizeMxeKeysArgs {
        _mxe_program: *mxe_program,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn set_cluster_ix(signer: &Pubkey, mxe_program: &Pubkey, cluster_offset: u32) -> Instruction {
    let accounts = SetClusterAccs {
        signer: signer.key(),
        mxe: mxe_acc(mxe_program),
        cluster: cluster_acc(cluster_offset),
        mxe_program: *mxe_program,
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = SetClusterArgs { cluster_offset }.data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn callback_computation_ix(
    signer: &Pubkey,
    mxe_program: &Pubkey,
    computation_offset: u64,
    comp_def_offset: u32,
    node_offset: u32,
    cluster_offset: u32,
    execution_status: ExecutionStatus,
) -> Instruction {
    let accounts = CallbackComputationAccs {
        signer: signer.key(),
        node: arx_acc(node_offset),
        comp: computation_acc(mxe_program, computation_offset),
        mxe: mxe_acc(mxe_program),
        cluster_acc: cluster_acc(cluster_offset),
        mempool: mempool_acc(mxe_program),
        executing_pool: execpool_acc(mxe_program),
        system_program: SYSTEM_PROGRAM_ID,
        comp_def_acc: computation_definition_acc(mxe_program, comp_def_offset),
        instructions_sysvar: INSTRUCTIONS_SYSVAR_ID,
    }
    .to_account_metas(None);
    let data = CallbackComputationArgs {
        node_offset,
        comp_def_offset,
        comp_offset: computation_offset,
        mxe_program: *mxe_program,
        execution_status,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

/// Finalize computation instruction on the arcium program directly.
/// Finalizing a Computation involves calling a tx with two ixs sequentially:
/// 1. FinalizeComputationIx on arcium which takes care of clearing the mempool, distributing
///    rewards, etc.
/// 2. FinalizeComputationIx on the user program related to the mxe which receives the result data
///    and handles it. This instruction builds the first part of the tx.
#[allow(clippy::too_many_arguments)]
pub fn finalize_computation_ix_arcium(
    signer: &Pubkey,
    mxe_program: &Pubkey,
    computation_offset: u64,
    comp_def_offset: u32,
    cluster_offset: u32,
) -> Instruction {
    let accounts = FinalizeComputationAccs {
        signer: signer.key(),
        comp: computation_acc(mxe_program, computation_offset),
        mxe: mxe_acc(mxe_program),
        cluster_acc: cluster_acc(cluster_offset),
        mempool: mempool_acc(mxe_program),
        executing_pool: execpool_acc(mxe_program),
        comp_def_acc: computation_definition_acc(mxe_program, comp_def_offset),
        clock: clock_acc(),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = FinalizeComputationArgs {
        comp_offset: computation_offset,
        comp_def_offset,
        mxe_program: *mxe_program,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

/// Finalize computation instruction on the user program.
/// Finalizing a Computation involves calling a tx with two ixs sequentially:
/// 1. Finalize on arcium which takes care of clearing the mempool, distributing rewards, etc.
/// 2. Finalize on the user program related to the mxe which receives the result data and handles
///    it. The result data has to be borsh-serialized. This instruction builds the second part of
///    the tx.
pub fn finalize_computation_ix_user(
    mxe_prog_id: &Pubkey,
    signer: &Pubkey,
    callback_accs: Vec<CallbackAccount>,
    comp_def_offset: u32,
    callback_discriminator: &[u8],
    output_bytes: Vec<u8>,
) -> Instruction {
    let mut bytes = Vec::with_capacity(callback_discriminator.len() + output_bytes.len());
    bytes.extend_from_slice(callback_discriminator);
    bytes.extend_from_slice(&output_bytes);

    let accounts = vec![
        // `signer`
        AccountMeta {
            pubkey: signer.to_owned(),
            is_signer: true,
            is_writable: true,
        },
        // `arcium_program`
        AccountMeta {
            pubkey: ARCIUM_PROG_ID,
            is_signer: false,
            is_writable: false,
        },
        // `computation_definition_account`
        AccountMeta {
            pubkey: computation_definition_acc(mxe_prog_id, comp_def_offset),
            is_signer: false,
            is_writable: false,
        },
        // `instructions_sysvar` Needed for acc introspection
        AccountMeta {
            pubkey: sysvar::instructions::id(),
            is_signer: false,
            is_writable: false,
        },
    ]
    .into_iter()
    .chain(callback_accs.iter().map(|c| AccountMeta {
        pubkey: c.pubkey,
        is_writable: c.is_writable,
        is_signer: false,
    }))
    .collect::<Vec<AccountMeta>>()
    .to_account_metas(None);

    Instruction {
        program_id: mxe_prog_id.to_owned(),
        accounts,
        data: bytes,
    }
}

pub fn update_current_epoch_idempotent_ix() -> Instruction {
    let accounts = UpdateCurrentEpochIdempotentAccs { clock: clock_acc() }.to_account_metas(None);
    let data = UpdateCurrentEpochIdempotentArgs {}.data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn set_arx_node_config_ix(
    signer: &Pubkey,
    node_offset: u32,
    config: ArxNodeConfig,
) -> Instruction {
    let accounts = SetArxNodeConfigAccs {
        signer: signer.key(),
        arx_node_acc: arx_acc(node_offset),
        system_program: SYSTEM_PROGRAM_ID,
    }
    .to_account_metas(None);
    let data = SetArxNodeConfigArgs {
        node_offset,
        config,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

pub fn set_arx_node_metadata_ix(
    signer: &Pubkey,
    node_offset: u32,
    metadata: NodeMetadata,
) -> Instruction {
    let accounts = SetArxNodeMetadataAccs {
        signer: signer.key(),
        arx_node_acc: arx_acc(node_offset),
    }
    .to_account_metas(None);
    let data = SetArxNodeMetadataArgs {
        node_offset,
        meta: metadata,
    }
    .data();

    Instruction {
        program_id: ARCIUM_PROG_ID,
        accounts,
        data,
    }
}

#[cfg(feature = "staking")]
pub mod staking {
    use super::*;
    use crate::{
        idl::arcium_staking::{
            client::{
                accounts::{
                    ActivatePrimaryStake as ActivatePrimaryStakeAccs,
                    CloseDelegatedStake as CloseDelegatedStakeAccs,
                    DeactivatePrimaryStake as DeactivatePrimaryStakeAccs,
                    DelegateStake as DelegateStakeAccs,
                    FinalizeEpochRewards as FinalizeEpochRewardsAccs,
                    InitDelegatedStakeAcc as InitDelegatedStakeAccs,
                    InitPrimaryStake as InitPrimaryStakeAccs,
                    InitStakeMasterAcc as InitDelegatedStakeMasterAccs,
                    MergeDelegatedStakeAccount as MergeDelegatedStakeAccountAccs,
                    SplitDelegatedStakeAccount as SplitDelegatedStakeAccountAccs,
                    UndelegateStake as UndelegateStakeAccs,
                },
                args::{
                    ActivatePrimaryStake as ActivatePrimaryStakeArgs,
                    CloseDelegatedStake as CloseDelegatedStakeArgs,
                    DeactivatePrimaryStake as DeactivatePrimaryStakeArgs,
                    DelegateStake as DelegateStakeArgs,
                    FinalizeEpochRewards as FinalizeEpochRewardsArgs,
                    InitDelegatedStakeAcc as InitDelegatedStakeArgs,
                    InitPrimaryStake as InitPrimaryStakeArgs,
                    InitStakeMasterAcc as InitDelegatedStakeMasterArgs,
                    MergeDelegatedStakeAccount as MergeDelegatedStakeAccountArgs,
                    SplitDelegatedStakeAccount as SplitDelegatedStakeAccountArgs,
                    UndelegateStake as UndelegateStakeArgs,
                },
            },
            types::{Epoch, RewardClaim},
            ID as ARCIUM_STAKING_PROG_ID,
        },
        pda::{
            staking::{
                delegated_stake_acc,
                primary_stake_acc,
                stake_master_acc,
                stake_queue_acc,
                staking_pool_acc,
            },
            ARCIUM_TOKEN_MINT,
        },
    };
    use anchor_client::solana_sdk::program_pack::Pack;
    use anchor_lang::solana_program::system_instruction::create_account;
    use anchor_spl::{
        associated_token::{
            get_associated_token_address,
            spl_associated_token_account::instruction::create_associated_token_account_idempotent,
        },
        token::{
            spl_token::{
                instruction::{initialize_mint, mint_to},
                state::Mint,
            },
            ID as TOKEN_PROGRAM_ID,
        },
    };

    pub fn init_arcium_token_mint_ixs(
        minimum_balance_for_rent_exemption: u64,
        signer: &Pubkey,
    ) -> [Instruction; 2] {
        let create_acc_ix = create_account(
            signer,
            &ARCIUM_TOKEN_MINT,
            minimum_balance_for_rent_exemption,
            Mint::LEN as u64,
            &TOKEN_PROGRAM_ID,
        );
        let init_mint_ix = initialize_mint(
            &TOKEN_PROGRAM_ID,
            &ARCIUM_TOKEN_MINT,
            signer,
            None,
            ARCIUM_TOKEN_DECIMALS,
        )
        .expect("Failed to create initialize mint instruction");

        [create_acc_ix, init_mint_ix]
    }

    pub fn airdrop_arcium_token_ixs(
        signer: &Pubkey,
        recipient: &Pubkey,
        amount: u64,
    ) -> [Instruction; 2] {
        let rec_ata = get_associated_token_address(recipient, &ARCIUM_TOKEN_MINT);
        let create_ata_ix = create_associated_token_account_idempotent(
            signer,
            recipient,
            &ARCIUM_TOKEN_MINT,
            &TOKEN_PROGRAM_ID,
        );
        let mint_to_ix = mint_to(
            &TOKEN_PROGRAM_ID,
            &ARCIUM_TOKEN_MINT,
            &rec_ata,
            signer,
            &[signer],
            amount,
        )
        .unwrap_or_else(|err| panic!("Failed to create mint ix: {}", err));

        [create_ata_ix, mint_to_ix]
    }

    pub fn init_primary_stake_acc_ix(
        signer: &Pubkey,
        amount: u64,
        fee_basis_points: u16,
    ) -> Instruction {
        let primary_stake_acc = primary_stake_acc(signer);
        let pool_acc = staking_pool_acc();
        let accounts = InitPrimaryStakeAccs {
            from: signer.to_owned(),
            from_ta: get_associated_token_address(signer, &ARCIUM_TOKEN_MINT),
            primary_stake_account: primary_stake_acc.key(),
            stake_queue: stake_queue_acc(&primary_stake_acc),
            mint: ARCIUM_TOKEN_MINT,
            pool_account: pool_acc,
            pool_ata: get_associated_token_address(&pool_acc, &ARCIUM_TOKEN_MINT),
            clock: clock_acc(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = InitPrimaryStakeArgs {
            amount,
            fee_basis_points,
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn activate_primary_stake_acc_ix(signer: &Pubkey, lockup_epochs: u64) -> Instruction {
        let accounts = ActivatePrimaryStakeAccs {
            signer: signer.to_owned(),
            primary_stake_account: primary_stake_acc(signer),
            clock: clock_acc(),
        }
        .to_account_metas(None);
        let data = ActivatePrimaryStakeArgs {
            lockup_epochs: Epoch(lockup_epochs),
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn deactivate_primary_stake_acc_ix(
        signer: &Pubkey,
        arx_node_offset: Option<u32>,
    ) -> Instruction {
        let accounts = DeactivatePrimaryStakeAccs {
            signer: signer.to_owned(),
            primary_stake_account: primary_stake_acc(signer),
            clock: clock_acc(),
        }
        .to_account_metas(None);
        let data = DeactivatePrimaryStakeArgs {
            node_offset: arx_node_offset,
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn finalize_epoch_rewards_ix(
        signer: &Pubkey,
        primary_stake_owner: &Pubkey,
        node_offset: u32,
        stake_reward: RewardClaim,
    ) -> Instruction {
        let pool_account = staking_pool_acc();
        let mint = ARCIUM_TOKEN_MINT;
        let primary_stake_acc = primary_stake_acc(primary_stake_owner);

        let accounts = FinalizeEpochRewardsAccs {
            signer: signer.key(),
            primary_stake_owner: primary_stake_owner.key(),
            primary_stake_owner_ata: get_associated_token_address(primary_stake_owner, &mint),
            stake_queue: stake_queue_acc(&primary_stake_acc),
            primary_stake_account: primary_stake_acc,
            pool_account,
            pool_ata: get_associated_token_address(&pool_account, &mint),
            clock: clock_acc(),
            token_program: TOKEN_PROGRAM_ID,
            system_program: SYSTEM_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = FinalizeEpochRewardsArgs {
            node_offset,
            stake_reward,
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn init_delegated_stake_master_acc_ix(signer: &Pubkey, owner: &Pubkey) -> Instruction {
        let accounts = InitDelegatedStakeMasterAccs {
            signer: signer.to_owned(),
            master_stake_account: stake_master_acc(owner),
            owner: owner.to_owned(),
            system_program: SYSTEM_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = InitDelegatedStakeMasterArgs {}.data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn init_delegated_stake_acc_ix(
        signer: &Pubkey,
        stake_offset: u128,
        amount: u64,
    ) -> Instruction {
        let accounts = InitDelegatedStakeAccs {
            from: signer.to_owned(),
            from_ata: get_associated_token_address(signer, &ARCIUM_TOKEN_MINT),
            master_stake_account: stake_master_acc(signer),
            user_stake_account: delegated_stake_acc(stake_offset),
            mint: ARCIUM_TOKEN_MINT,
            pool_account: staking_pool_acc(),
            pool_ata: get_associated_token_address(&staking_pool_acc(), &ARCIUM_TOKEN_MINT),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = InitDelegatedStakeArgs {
            stake_offset,
            amount,
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn delegate_stake_ix(
        signer: &Pubkey,
        stake_offset: u128,
        primary_stake_owner: &Pubkey,
        lockup_epochs: u64,
    ) -> Instruction {
        let accounts = DelegateStakeAccs {
            signer: signer.to_owned(),
            primary_acc_owner: primary_stake_owner.to_owned(),
            user_stake_account: delegated_stake_acc(stake_offset),
            primary: primary_stake_acc(primary_stake_owner),
            stake_queue: stake_queue_acc(&primary_stake_acc(primary_stake_owner)),
            clock: clock_acc(),
            system_program: SYSTEM_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = DelegateStakeArgs {
            stake_offset,
            lockup_epochs: Epoch(lockup_epochs),
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn undelegate_stake_ix(
        signer: &Pubkey,
        stake_offset: u128,
        primary_stake_owner: &Pubkey,
    ) -> Instruction {
        let accounts = UndelegateStakeAccs {
            signer: signer.to_owned(),
            user_stake_account: delegated_stake_acc(stake_offset),
            primary: primary_stake_acc(primary_stake_owner),
            clock: clock_acc(),
        }
        .to_account_metas(None);
        let data = UndelegateStakeArgs { stake_offset }.data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    /// Split a delegated stake account into two.
    /// * `primary_stake_owner_target` - The owner of the primary stake account we're delegating to.
    pub fn split_delegated_stake_account_ix(
        primary_stake_owner_target: &Pubkey,
        delegation_authority: &Pubkey,
        withdrawal_authority: &Pubkey,
        stake_offset: u128,
        stake_offset_new: u128,
        new_acc_balance: u64,
    ) -> Instruction {
        let primary_stake_acc = primary_stake_acc(primary_stake_owner_target);

        let accounts = SplitDelegatedStakeAccountAccs {
            delegation_authority: delegation_authority.to_owned(),
            withdrawal_authority: withdrawal_authority.to_owned(),
            delegation_master: stake_master_acc(delegation_authority),
            withdrawal_master: stake_master_acc(withdrawal_authority),
            old_stake_account: delegated_stake_acc(stake_offset),
            new_stake_account: delegated_stake_acc(stake_offset_new),
            stake_queue: stake_queue_acc(&primary_stake_acc),
            system_program: SYSTEM_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = SplitDelegatedStakeAccountArgs {
            new_acc_balance,
            _stake_offset: stake_offset,
            _stake_offset_new: stake_offset_new,
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    /// Split a delegated stake account into two.
    /// * `primary_stake_owner_target` - The owner of the primary stake account we're delegating to.
    pub fn merge_delegated_stake_account_ix(
        primary_stake_owner_target: &Pubkey,
        delegation_authority: &Pubkey,
        withdrawal_authority: &Pubkey,
        stake_offset_keep: u128,
        stake_offset_close: u128,
    ) -> Instruction {
        let primary_stake_acc = primary_stake_acc(primary_stake_owner_target);
        let accounts = MergeDelegatedStakeAccountAccs {
            delegation_authority: delegation_authority.to_owned(),
            withdrawal_authority: withdrawal_authority.to_owned(),
            delegation_master: stake_master_acc(delegation_authority),
            withdrawal_master: stake_master_acc(withdrawal_authority),
            stake_acc_to_keep: delegated_stake_acc(stake_offset_keep),
            stake_acc_to_close: delegated_stake_acc(stake_offset_close),
            stake_queue: stake_queue_acc(&primary_stake_acc),
            system_program: SYSTEM_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = MergeDelegatedStakeAccountArgs {
            _stake_offset_keep: stake_offset_keep,
            _stake_offset_close: stake_offset_close,
        }
        .data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }

    pub fn close_delegated_stake_ix(
        signer: &Pubkey,
        delegation_owner: &Pubkey,
        stake_offset: u128,
    ) -> Instruction {
        let accounts = CloseDelegatedStakeAccs {
            signer: signer.to_owned(),
            signer_ata: get_associated_token_address(signer, &ARCIUM_TOKEN_MINT),
            withdrawal_master: stake_master_acc(signer),
            delegation_master: stake_master_acc(delegation_owner),
            delegation_owner: delegation_owner.to_owned(),
            user_stake_account: delegated_stake_acc(stake_offset),
            mint: ARCIUM_TOKEN_MINT,
            pool_account: staking_pool_acc(),
            pool_ata: get_associated_token_address(&staking_pool_acc(), &ARCIUM_TOKEN_MINT),
            clock: clock_acc(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None);
        let data = CloseDelegatedStakeArgs { stake_offset }.data();

        Instruction {
            program_id: ARCIUM_STAKING_PROG_ID,
            accounts,
            data,
        }
    }
}
