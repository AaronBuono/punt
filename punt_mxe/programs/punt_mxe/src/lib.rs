use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

declare_id!("3gaXj1oSXKqn9rTgcPahqU9z3L2fjYexKYpmU1xNhefL");

pub const MAX_CIPHERTEXT_WORDS: usize = 10;  // Reduced from 18 to fit in stack
pub const STORED_CIPHERTEXT_WORDS: usize = MAX_CIPHERTEXT_WORDS + 1; // includes length marker word
const STORED_CIPHERTEXT_CAPACITY: usize = STORED_CIPHERTEXT_WORDS * 32;
const COMP_DEF_OFFSET_STORE_BET: u32 = comp_def_offset("store_bet");
const BET_META_SEED: &[u8] = b"bet-meta";

#[arcium_program]
pub mod punt_mxe {
    use super::*;

    pub fn init_store_bet_comp_def(ctx: Context<InitStoreBetCompDef>) -> Result<()> {
        // Finalize during callback so we can emit storage events after MXE finishes.
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn store_bet(
        ctx: Context<StoreBet>,
        computation_offset: u64,
        bettor_wallet: Pubkey,
        poll_id: [u8; 32],
        arcis_public_key: [u8; 32],
        ciphertext: Vec<[u8; 32]>,
        nonce: u128,
    ) -> Result<()> {
        require!(
            ciphertext.len() > 0 && ciphertext.len() <= STORED_CIPHERTEXT_WORDS,
            ErrorCode::InvalidCiphertextLength
        );

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Manually serialize to bet_meta account to avoid stack overflow
        let mut data = ctx.accounts.bet_meta.try_borrow_mut_data()?;
        let mut offset = 0;
        
        // Write 8-byte discriminator (anchor account discriminator for BetComputationMeta)
        // Using SHA256("account:BetComputationMeta")
        let discriminator: [u8; 8] = [139, 76, 158, 95, 58, 45, 30, 127];
        data[offset..offset + 8].copy_from_slice(&discriminator);
        offset += 8;
        
        // Write bettor_wallet (32 bytes)
        data[offset..offset + 32].copy_from_slice(bettor_wallet.as_ref());
        offset += 32;
        
        // Write poll_id (32 bytes)
        data[offset..offset + 32].copy_from_slice(&poll_id);
        offset += 32;
        
        // Write computation_offset (8 bytes)
        data[offset..offset + 8].copy_from_slice(&computation_offset.to_le_bytes());
        offset += 8;
        
        // Write arcis_public_key (32 bytes)
        data[offset..offset + 32].copy_from_slice(&arcis_public_key);
        offset += 32;
        
        // Write nonce (16 bytes)
        data[offset..offset + 16].copy_from_slice(&nonce.to_le_bytes());
        offset += 16;
        
        // Write ciphertext_len (1 byte)
        data[offset] = ciphertext.len() as u8;
        offset += 1;
        
        // Write ciphertext blocks
        for block in ciphertext.iter() {
            data[offset..offset + 32].copy_from_slice(block);
            offset += 32;
        }
        
        // Write bump (1 byte) - at the end after all ciphertext space
        let bump_offset = 8 + 32 + 32 + 8 + 32 + 16 + 1 + (STORED_CIPHERTEXT_WORDS * 32);
        data[bump_offset] = ctx.bumps.bet_meta;

        // Use Box to allocate args on the heap
        let mut args = Box::new(Vec::with_capacity(ciphertext.len() + 2));
        args.push(Argument::ArcisPubkey(arcis_public_key));
        args.push(Argument::PlaintextU128(nonce));
        for block in ciphertext.iter() {
            args.push(Argument::EncryptedU128(*block));
        }

        // Build callback on heap
        let callbacks = Box::new(vec![StoreBetCallback::callback_ix(&[
            CallbackAccount {
                pubkey: ctx.accounts.bet_meta.key(),
                is_writable: true,
            },
            CallbackAccount {
                pubkey: ctx.accounts.payer.key(),
                is_writable: true,
            },
        ])]);

        queue_computation(
            ctx.accounts,
            computation_offset,
            *args,
            None,
            *callbacks,
        )?;

        emit!(BetQueuedEvent {
            bettor_wallet,
            poll_id,
            computation_offset,
        });

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "store_bet")]
    pub fn store_bet_callback(
    ctx: Context<StoreBetCallback>,
        output: ComputationOutputs<StoreBetOutput>,
    ) -> Result<()> {
        if !matches!(output, ComputationOutputs::Success(_)) {
            return Err(ErrorCode::AbortedComputation.into());
        }

        // Manually deserialize from bet_meta account
        let data = ctx.accounts.bet_meta.try_borrow_data()?;
        let mut offset = 8; // Skip discriminator
        
        // Read bettor_wallet (32 bytes)
        let mut bettor_wallet_bytes = [0u8; 32];
        bettor_wallet_bytes.copy_from_slice(&data[offset..offset + 32]);
        let bettor_wallet = Pubkey::new_from_array(bettor_wallet_bytes);
        offset += 32;
        
        // Read poll_id (32 bytes)
        let mut poll_id = [0u8; 32];
        poll_id.copy_from_slice(&data[offset..offset + 32]);
        offset += 32;
        
        // Read computation_offset (8 bytes)
        let mut comp_offset_bytes = [0u8; 8];
        comp_offset_bytes.copy_from_slice(&data[offset..offset + 8]);
        let computation_offset = u64::from_le_bytes(comp_offset_bytes);
        offset += 8;
        
        // Read arcis_public_key (32 bytes)
        let mut arcis_public_key = [0u8; 32];
        arcis_public_key.copy_from_slice(&data[offset..offset + 32]);
        offset += 32;
        
        // Read nonce (16 bytes)
        let mut nonce = [0u8; 16];
        nonce.copy_from_slice(&data[offset..offset + 16]);

        emit!(BetStoredEvent {
            bettor_wallet,
            poll_id,
            computation_offset,
            bet_meta: ctx.accounts.bet_meta.key(),
            arcis_public_key,
            nonce,
        });

        Ok(())
    }
}

#[queue_computation_accounts("store_bet", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, _bettor_wallet: Pubkey, _poll_id: [u8; 32])]
pub struct StoreBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: Verified by the Arcium program
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: Verified by the Arcium program
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: Verified by the Arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_STORE_BET))]
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Box<Account<'info, Cluster>>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Box<Account<'info, FeePool>>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Box<Account<'info, ClockAccount>>,
    #[account(
        init,
        payer = payer,
        space = 8 + BetComputationMeta::ACCOUNT_SIZE,
        seeds = [BET_META_SEED, &computation_offset.to_le_bytes()],
        bump
    )]
    /// CHECK: Manually serialized to avoid stack overflow
    pub bet_meta: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("store_bet")]
#[derive(Accounts)]
pub struct StoreBetCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_STORE_BET))]
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    #[account(mut)]
    /// CHECK: Manually deserialized
    pub bet_meta: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: SystemAccount<'info>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Provided by Arcium runtime
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("store_bet", payer)]
#[derive(Accounts)]
pub struct InitStoreBetCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Created by the Arcium program
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct BetComputationMeta {
    pub bettor_wallet: Pubkey,
    pub poll_id: [u8; 32],
    pub computation_offset: u64,
    pub arcis_public_key: [u8; 32],
    pub nonce: [u8; 16],
    pub ciphertext_len: u8,
    pub ciphertext: [[u8; 32]; STORED_CIPHERTEXT_WORDS],
    pub bump: u8,
}

impl BetComputationMeta {
    pub const MAX_CIPHERTEXT_BYTES: usize = STORED_CIPHERTEXT_CAPACITY;
    pub const ACCOUNT_SIZE: usize =
        32 + 32 + 8 + 32 + 16 + 1 + Self::MAX_CIPHERTEXT_BYTES + 1;
}

#[event]
pub struct BetQueuedEvent {
    pub bettor_wallet: Pubkey,
    pub poll_id: [u8; 32],
    pub computation_offset: u64,
}

#[event]
pub struct BetStoredEvent {
    pub bettor_wallet: Pubkey,
    pub poll_id: [u8; 32],
    pub computation_offset: u64,
    pub bet_meta: Pubkey,
    pub arcis_public_key: [u8; 32],
    pub nonce: [u8; 16],
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Ciphertext length does not match expected size")]
    InvalidCiphertextLength,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
