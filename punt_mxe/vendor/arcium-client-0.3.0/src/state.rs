use crate::{
    idl::arcium::{
        accounts::{
            ArxNode,
            Cluster,
            LargeExecPool,
            MediumExecPool,
            SmallExecPool,
            SmallMempool,
            TinyExecPool,
            TinyMempool,
        },
        types::ComputationReference,
    },
    pda::{arx_acc, cluster_acc},
};
use anchor_client::{
    anchor_lang::{AccountDeserialize, Discriminator},
    solana_client::{
        client_error::ClientError as SolanaClientError,
        nonblocking::rpc_client::RpcClient as AsyncRpcClient,
    },
    ClientError,
};
use anchor_lang::prelude::Pubkey;
use std::{collections::HashSet, hash::Hash};

pub async fn arx_acc_active(
    rpc_client: &AsyncRpcClient,
    node_offset: u32,
) -> Result<bool, Box<dyn std::error::Error>> {
    let arx_acc = arx_acc(node_offset);
    let bytes = rpc_client
        .get_account(&arx_acc)
        .await
        .map_err(|e| format!("Failed to get account data: {}", e))?
        .data;
    let arx_data = ArxNode::try_deserialize(&mut bytes.as_slice())
        .map_err(|e| format!("Failed to deserialize account data: {}", e))?;
    Ok(arx_data.is_active)
}

pub async fn active_proposals(
    rpc_client: &AsyncRpcClient,
    cluster_offset: u32,
) -> Result<Vec<u64>, Box<dyn std::error::Error>> {
    let cluster_acc = cluster_acc(cluster_offset);
    let bytes = rpc_client
        .get_account(&cluster_acc)
        .await
        .map_err(|e| format!("Failed to get account data: {}", e))?
        .data;
    let cluster_data = Cluster::try_deserialize(&mut bytes.as_slice())
        .map_err(|e| format!("Failed to deserialize account data: {}", e))?;
    // Proposals are all set to the current price by default, so we filter out duplicates
    Ok(dedupe(cluster_data.cu_price_proposals.to_vec()))
}

fn dedupe<T: PartialEq + Eq + Hash + Copy>(arr: Vec<T>) -> Vec<T> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for &item in arr.iter() {
        if seen.insert(item) {
            result.push(item);
        }
    }

    result
}

pub async fn get_mempool_acc_data(
    rpc: &AsyncRpcClient,
    mempool_acc: &Pubkey,
) -> Result<MempoolWrapper, ComputationPoolError> {
    let mempool_data = rpc
        .get_account_data(mempool_acc)
        .await
        .map_err(ComputationPoolError::new_solana_error)?;
    MempoolWrapper::from_raw(&mempool_data)
}

// This is a zero-copy account with different size variants, so we leave the deserialization to the
// caller.
pub async fn get_mempool_acc_data_raw(
    rpc: &AsyncRpcClient,
    mempool_acc: &Pubkey,
) -> Result<Vec<u8>, ClientError> {
    let mempool_data = rpc.get_account_data(mempool_acc).await?;
    Ok(mempool_data)
}

pub async fn get_execpool_acc_data(
    rpc: &AsyncRpcClient,
    execpool_acc: &Pubkey,
) -> Result<ExecpoolWrapper, ComputationPoolError> {
    let execpool_data = rpc
        .get_account_data(execpool_acc)
        .await
        .map_err(ComputationPoolError::new_solana_error)?;
    ExecpoolWrapper::from_raw(&execpool_data)
}

// This is a zero-copy account with different size variants, so we leave the deserialization to the
// caller.
pub async fn get_execpool_acc_data_raw(
    rpc: &AsyncRpcClient,
    execpool_acc: &Pubkey,
) -> Result<Vec<u8>, ClientError> {
    let execpool_data = rpc.get_account_data(execpool_acc).await?;
    Ok(execpool_data)
}

#[derive(Debug, Hash, PartialEq, Eq, Copy, Clone)]
pub struct MempoolInfo {
    pub cluster: Pubkey,
    pub mxe: Pubkey,
    pub mempool: Pubkey,
}

#[allow(clippy::large_enum_variant)]
pub enum MempoolWrapper {
    Tiny(TinyMempool),
    Small(SmallMempool),
    // TODO: Add support for medium and large mempools (current problem is they're too big and
    // cause a stack overflow) We should do an optimization where we only fetch/receive the
    // heap at current_slot (since that's the only thing that changes), and not the entire mempool
    // Medium(MediumMempool),
    // Large(LargeMempool),
}

#[derive(Debug)]
pub enum ComputationPoolError {
    InvalidDiscriminator,
    InvalidSize,
    ClientError(Box<SolanaClientError>),
}

impl ComputationPoolError {
    pub fn new_solana_error(err: SolanaClientError) -> Self {
        ComputationPoolError::ClientError(Box::new(err))
    }
}

macro_rules! extract_computations {
    ($inner:expr) => {{
        let start_index = $inner.computations.start_index as usize;
        let buffer_size = $inner.computations.elems.len();

        $inner
            .computations
            .elems
            .into_iter()
            .enumerate()
            .filter(|(i, _)| {
                // This is a circular buffer, so we need to normalize the index
                let normalized_i = if *i >= start_index {
                    *i - start_index
                } else {
                    buffer_size - start_index + *i
                };
                Self::is_valid(&$inner.computations.valid_bits, normalized_i)
                    && normalized_i < $inner.computations.length as usize
            })
            .flat_map(|(_, h)| h.entries.into_iter())
            .filter(|computation| !is_empty_computation_ref(computation))
            .collect()
    }};
}

macro_rules! extract_computations_highest_prio {
    ($inner:expr) => {{
        let start_index = $inner.computations.start_index as usize;
        let buffer_size = $inner.computations.elems.len();

        $inner
            .computations
            .elems
            .into_iter()
            .enumerate()
            .filter_map(|(i, h)| {
                // Normalize circular buffer index
                let normalized_i = if i >= start_index {
                    i - start_index
                } else {
                    buffer_size - start_index + i
                };

                // Check validity and bounds
                if Self::is_valid(&$inner.computations.valid_bits, normalized_i)
                    && normalized_i < $inner.computations.length as usize
                {
                    // Pick only the first entry if non-empty
                    let mut entries = h.entries.into_iter();
                    let first = entries.next()?;
                    if !is_empty_computation_ref(&first) {
                        return Some(first);
                    }
                }
                None
            })
            .collect()
    }};
}
macro_rules! deserialize_mempool {
    ($raw:expr, $mempool:ty, $variant:ident) => {{
        let offset = <$mempool as Discriminator>::DISCRIMINATOR.len();
        if offset + std::mem::size_of::<$mempool>() > $raw.len() {
            return Err(ComputationPoolError::InvalidSize);
        }
        let data = bytemuck::pod_read_unaligned::<$mempool>(
            &$raw[offset..offset + std::mem::size_of::<$mempool>()],
        );
        Ok(MempoolWrapper::$variant(data))
    }};
}

impl MempoolWrapper {
    pub fn computations_raw(self) -> Vec<(bool, Vec<ComputationReference>, usize, usize)> {
        match self {
            MempoolWrapper::Tiny(tm) => {
                let start_index = tm.inner.computations.start_index as usize;
                let mut res = Vec::with_capacity(180);
                tm.inner
                    .computations
                    .elems
                    .into_iter()
                    .enumerate()
                    .for_each(|(i, h)| {
                        let normalized_i = if i >= start_index {
                            i - start_index
                        } else {
                            tm.inner.computations.elems.len() - start_index + i
                        };
                        res[normalized_i] = (
                            Self::is_valid(&tm.inner.computations.valid_bits, normalized_i),
                            h.entries
                                .into_iter()
                                .filter(|c| !is_empty_computation_ref(c))
                                .collect(),
                            normalized_i,
                            i,
                        );
                    });
                res
            }
            MempoolWrapper::Small(tm) => {
                let start_index = tm.inner.computations.start_index as usize;
                let mut res = Vec::with_capacity(180);
                tm.inner
                    .computations
                    .elems
                    .into_iter()
                    .enumerate()
                    .for_each(|(i, h)| {
                        let normalized_i = if i >= start_index {
                            i - start_index
                        } else {
                            tm.inner.computations.elems.len() - start_index + i
                        };
                        res[normalized_i] = (
                            Self::is_valid(&tm.inner.computations.valid_bits, normalized_i),
                            h.entries
                                .into_iter()
                                .filter(|c| !is_empty_computation_ref(c))
                                .collect(),
                            normalized_i,
                            i,
                        );
                    });
                res
            }
        }
    }

    pub fn computations(self) -> Vec<ComputationReference> {
        match self {
            MempoolWrapper::Tiny(tm) => extract_computations!(tm.inner),
            MempoolWrapper::Small(sm) => extract_computations!(sm.inner), /* MempoolWrapper::Medium(mm) => extract_computations!(mm.inner),
                                                                           * MempoolWrapper::Large(lm) => extract_computations!(lm.inner)
                                                                           */
        }
    }

    pub fn computations_highest_prio(self) -> Vec<ComputationReference> {
        match self {
            MempoolWrapper::Tiny(tm) => extract_computations_highest_prio!(tm.inner),
            MempoolWrapper::Small(sm) => extract_computations_highest_prio!(sm.inner), /* MempoolWrapper::Medium(mm) => extract_computations_highest_prio!(mm.inner),
                                                                                        * MempoolWrapper::Large(lm) => extract_computations_highest_prio!(lm.inner)
                                                                                        */
        }
    }
    // Returns None if the mempool wasn't properly initialized (i.e. has the incorrect length)
    pub fn from_raw(raw_mempool: &[u8]) -> Result<Self, ComputationPoolError> {
        match &raw_mempool[0..8] {
            TinyMempool::DISCRIMINATOR => deserialize_mempool!(raw_mempool, TinyMempool, Tiny),
            SmallMempool::DISCRIMINATOR => deserialize_mempool!(raw_mempool, SmallMempool, Small),
            // MediumMempool::DISCRIMINATOR => deserialize_mempool!(raw_mempool, MediumMempool,
            // Medium), LargeMempool::DISCRIMINATOR => deserialize_mempool!(raw_mempool,
            // LargeMempool, Large),
            _ => Err(ComputationPoolError::InvalidDiscriminator),
        }
    }

    // Returns true if the heap at index idx is valid (i.e. not stale)
    fn is_valid(valid_bits: &[u8], idx: usize) -> bool {
        let byte = idx / 8;
        let bit = idx - (byte * 8);

        if byte >= valid_bits.len() {
            return false;
        }

        (valid_bits[byte] & (1 << bit)) != 0
    }
}

pub fn is_empty_computation_ref(c: &ComputationReference) -> bool {
    // ComputationReference does impl PartialEq, else we'd compare to
    // ComputationReference::zeroed(). This is effectively the same thing.
    c.computation_offset == 0 && c.priority_fee == 0 && c.computation_definition_offset == 0
}

impl std::fmt::Display for ComputationReference {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Computation offset: {}, priority fee: {}, comp def offset: {}",
            self.computation_offset, self.priority_fee, self.computation_definition_offset
        )
    }
}

impl std::fmt::Display for ComputationReferenceWStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Computation reference: {}, executed: {}",
            self.reference, self.executed
        )
    }
}

#[derive(Debug, Hash, PartialEq, Eq, Copy, Clone)]
pub struct ExecpoolInfo {
    pub cluster: Pubkey,
    pub mxe: Pubkey,
    pub execpool: Pubkey,
}

#[allow(clippy::large_enum_variant)]
pub enum ExecpoolWrapper {
    Tiny(TinyExecPool),
    Small(SmallExecPool),
    Medium(MediumExecPool),
    Large(LargeExecPool),
}

impl ExecpoolWrapper {
    pub fn computations_unfiltered(self) -> Vec<ComputationReferenceWStatus> {
        match self {
            ExecpoolWrapper::Tiny(tm) => tm
                .inner
                .currently_executing
                .into_iter()
                .enumerate()
                .map(|(i, reference)| ComputationReferenceWStatus {
                    reference,
                    index: tm.inner.execpool_index[i],
                    executed: Self::get_executed_status(tm.inner.comp_status, i),
                })
                .collect(),
            ExecpoolWrapper::Small(sm) => sm
                .inner
                .currently_executing
                .into_iter()
                .enumerate()
                .map(|(i, reference)| ComputationReferenceWStatus {
                    reference,
                    index: sm.inner.execpool_index[i],
                    executed: Self::get_executed_status(sm.inner.comp_status, i),
                })
                .collect(),
            ExecpoolWrapper::Medium(mm) => mm
                .inner
                .currently_executing
                .into_iter()
                .enumerate()
                .map(|(i, reference)| ComputationReferenceWStatus {
                    reference,
                    index: mm.inner.execpool_index[i],
                    executed: Self::get_executed_status(mm.inner.comp_status, i),
                })
                .collect(),
            ExecpoolWrapper::Large(lm) => lm
                .inner
                .currently_executing
                .into_iter()
                .enumerate()
                .map(|(i, reference)| ComputationReferenceWStatus {
                    reference,
                    index: lm.inner.execpool_index[i],
                    executed: Self::get_executed_status(lm.inner.comp_status, i),
                })
                .collect(),
        }
    }

    pub fn computations(self) -> Vec<ComputationReferenceWStatus> {
        self.computations_unfiltered()
            .into_iter()
            .filter(|computation| !is_empty_computation_ref(&computation.reference))
            .collect()
    }

    pub fn from_raw(raw_mempool: &[u8]) -> Result<Self, ComputationPoolError> {
        match &raw_mempool[0..8] {
            TinyExecPool::DISCRIMINATOR => {
                let offset = TinyExecPool::DISCRIMINATOR.len();
                if offset + std::mem::size_of::<TinyExecPool>() > raw_mempool.len() {
                    return Err(ComputationPoolError::InvalidSize);
                }
                let tm = bytemuck::pod_read_unaligned::<TinyExecPool>(
                    &raw_mempool[offset..offset + std::mem::size_of::<TinyExecPool>()],
                );
                Ok(ExecpoolWrapper::Tiny(tm))
            }
            SmallExecPool::DISCRIMINATOR => {
                let offset = SmallExecPool::DISCRIMINATOR.len();
                if offset + std::mem::size_of::<SmallExecPool>() > raw_mempool.len() {
                    return Err(ComputationPoolError::InvalidSize);
                }
                let sm = bytemuck::pod_read_unaligned::<SmallExecPool>(
                    &raw_mempool[offset..offset + std::mem::size_of::<SmallExecPool>()],
                );
                Ok(ExecpoolWrapper::Small(sm))
            }
            MediumExecPool::DISCRIMINATOR => {
                let offset = MediumExecPool::DISCRIMINATOR.len();
                if offset + std::mem::size_of::<MediumExecPool>() > raw_mempool.len() {
                    return Err(ComputationPoolError::InvalidSize);
                }
                let mm = bytemuck::pod_read_unaligned::<MediumExecPool>(
                    &raw_mempool[offset..offset + std::mem::size_of::<MediumExecPool>()],
                );
                Ok(ExecpoolWrapper::Medium(mm))
            }
            LargeExecPool::DISCRIMINATOR => {
                let offset = LargeExecPool::DISCRIMINATOR.len();
                if offset + std::mem::size_of::<LargeExecPool>() > raw_mempool.len() {
                    return Err(ComputationPoolError::InvalidSize);
                }
                let lm = bytemuck::pod_read_unaligned::<LargeExecPool>(
                    &raw_mempool[offset..offset + std::mem::size_of::<LargeExecPool>()],
                );
                Ok(ExecpoolWrapper::Large(lm))
            }
            _ => Err(ComputationPoolError::InvalidDiscriminator),
        }
    }

    // Gets the n-th bit of the comp_status_bits array
    fn get_executed_status(comp_status_bits: [u8; 13], index: usize) -> bool {
        let bit_index = index / 8;
        comp_status_bits[bit_index] & (1 << (index & 7)) != 0
    }
}

#[derive(PartialEq, Eq, Debug, Clone)]
pub struct ComputationReferenceWStatus {
    pub reference: ComputationReference,
    pub index: u64,
    pub executed: bool,
}
