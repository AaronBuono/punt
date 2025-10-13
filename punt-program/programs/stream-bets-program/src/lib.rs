use anchor_lang::prelude::*;
use anchor_lang::system_program;
use std::str::FromStr;

declare_id!("Cf83CfNFqArAjvQVqpegyuJBjp546jaMKhQA7NGb1zWY");

// -------------------------------------------------------------------------------------------------
// Program
// -------------------------------------------------------------------------------------------------
#[program]
pub mod stream_bets_program {
    use super::*;

    /// Initialize authority meta (one-time per authority) holding cycle counter.
    pub fn init_authority_meta(ctx: Context<InitAuthorityMeta>) -> Result<()> {
        let meta = &mut ctx.accounts.authority_meta;
        meta.authority = ctx.accounts.authority.key();
        meta.next_cycle = 0;
        meta.bump = ctx.bumps.authority_meta;
        Ok(())
    }

    /// Initialize a single market for the authority (1 market per authority in this simple PoC)
    /// Added naming fields: title, label_yes, label_no for richer streamer UX.
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        title: String,
        label_yes: String,
        label_no: String,
        fee_bps: Option<u16>
    ) -> Result<()> {
        let meta = &mut ctx.accounts.authority_meta;
        // Use current cycle; then increment for next time.
        let cycle = meta.next_cycle;
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.cycle = cycle;
        market.pool_yes = 0;
        market.pool_no = 0;
        market.resolved = false;
        market.frozen = false;
    market.fee_bps = fee_bps.unwrap_or(AUTHORITY_FEE_BPS_DEFAULT);
    market.host_fee_bps = HOST_FEE_BPS_DEFAULT;
    require!(market.fee_bps <= 10_000, BetError::InvalidFee);
    require!(market.host_fee_bps <= 10_000, BetError::InvalidFee);
    require!(market.fee_bps as u32 + market.host_fee_bps as u32 <= 10_000, BetError::InvalidFee);
        market.bump = ctx.bumps.market;
        market.winning_side = 255; // sentinel for not set
        market.fees_accrued = 0;
        // Write labels (truncate if needed; enforce length limit)
        require!(title.as_bytes().len() <= TITLE_MAX_LEN, BetError::LabelTooLong);
        require!(label_yes.as_bytes().len() <= LABEL_MAX_LEN, BetError::LabelTooLong);
        require!(label_no.as_bytes().len() <= LABEL_MAX_LEN, BetError::LabelTooLong);
        write_fixed(&mut market.title, title.as_bytes());
        write_fixed(&mut market.label_yes, label_yes.as_bytes());
        write_fixed(&mut market.label_no, label_no.as_bytes());
        // Increment meta so next initialization gets a new cycle (unique market PDA)
        meta.next_cycle = meta.next_cycle.checked_add(1).ok_or(BetError::MathOverflow)?;
        Ok(())
    }

    /// Create a ticket (locks in side). One ticket per (user, market).
    pub fn create_ticket(ctx: Context<CreateTicket>, side: u8) -> Result<()> {
        require!(side <= 1, BetError::InvalidSide);
        let market = &ctx.accounts.market;
        require!(!market.resolved, BetError::MarketAlreadyResolved);
        require!(ctx.accounts.user.key() != market.authority, BetError::AuthorityCannotBet);
        let ticket = &mut ctx.accounts.ticket;
        ticket.user = ctx.accounts.user.key();
        ticket.market = market.key();
        ticket.side = side;
        ticket.amount = 0;
        ticket.claimed = false;
        ticket.bump = ctx.bumps.ticket;
        Ok(())
    }

    /// Place a bet increasing ticket amount and updating pools. (No resolve/claim yet in phase 1)
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        require!(amount > 0, BetError::ZeroAmount);
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, BetError::MarketAlreadyResolved);
        require!(!market.frozen, BetError::MarketFrozen);
        let ticket = &mut ctx.accounts.ticket;
        require!(!ticket.claimed, BetError::AlreadyClaimed);
        require!(ctx.accounts.user.key() != market.authority, BetError::AuthorityCannotBet);

        // Transfer lamports into market escrow
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: market.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        ticket.amount = ticket.amount.checked_add(amount).ok_or(BetError::MathOverflow)?;
        match ticket.side {
            0 => market.pool_yes = market.pool_yes.checked_add(amount).ok_or(BetError::MathOverflow)?,
            1 => market.pool_no = market.pool_no.checked_add(amount).ok_or(BetError::MathOverflow)?,
            _ => return err!(BetError::InvalidSide),
        }
        Ok(())
    }


    /// Resolve the market selecting a winning side (0=yes,1=no). Only authority.
    pub fn resolve_market(ctx: Context<ResolveMarket>, winning_side: u8) -> Result<()> {
        require!(winning_side <= 1, BetError::InvalidWinningSide);
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, BetError::MarketAlreadyResolved);
        require!(market.frozen, BetError::MarketNotFrozen);
        market.resolved = true;
        market.winning_side = winning_side;
        // If selected winning side has zero bets, convert entire opposing pool to fees immediately.
        let (winning_pool, losing_pool) = match winning_side { 0 => (market.pool_yes, market.pool_no), 1 => (market.pool_no, market.pool_yes), _ => (0,0) };
        if winning_pool == 0 && losing_pool > 0 {
            // All losing_pool lamports become fees (since no winners). Accrue as total fees to be split on withdraw.
            // They are currently still inside the market escrow account: just add to fees_accrued.
            market.fees_accrued = market.fees_accrued.checked_add(losing_pool).ok_or(BetError::MathOverflow)?;
            // Zero out the losing pool to reflect accounting invariant: pool sums = remaining claimable + already-fees.
            if winning_side == 0 { market.pool_no = 0; } else { market.pool_yes = 0; }
        }
        let no_winner = winning_pool == 0;
        emit!(MarketResolvedEvent {
            market: market.key(),
            authority: market.authority,
            winning_side,
            pool_yes: market.pool_yes,
            pool_no: market.pool_no,
            no_winner,
            fees_accrued: market.fees_accrued,
        });
        Ok(())
    }

    /// Claim winnings for a resolved market. Losers get nothing; winners proportionally.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.resolved, BetError::MarketNotResolved);
        let ticket = &mut ctx.accounts.ticket;
        require!(!ticket.claimed, BetError::AlreadyClaimed);
        require!(ticket.side == market.winning_side, BetError::TicketSideMismatch);

        let total_pool = market.pool_yes.checked_add(market.pool_no).ok_or(BetError::MathOverflow)?;
        // Winner share = (ticket.amount / winning_pool) * total_pool
        let winning_pool = match market.winning_side { 0 => market.pool_yes, 1 => market.pool_no, _ => 0 };
        require!(winning_pool > 0, BetError::MathOverflow);
        // Compute gross payout (pro rata)
        let numerator = (ticket.amount as u128) * (total_pool as u128);
        let gross = (numerator / (winning_pool as u128)) as u64; // safe since pools are u64

    // Fees on winnings above principal only (profit portion) split authority + host
    let profit = gross.checked_sub(ticket.amount).ok_or(BetError::MathOverflow)?;
    let total_fee_bps = market.fee_bps as u64 + market.host_fee_bps as u64;
    let total_fee = if total_fee_bps > 0 { (profit as u128 * total_fee_bps as u128 / 10_000u128) as u64 } else { 0 };
    let payout = gross.checked_sub(total_fee).ok_or(BetError::MathOverflow)?;

        // Transfer lamports from market escrow to user
        **market.to_account_info().try_borrow_mut_lamports()? = market
            .to_account_info()
            .lamports()
            .checked_sub(payout)
            .ok_or(BetError::InsufficientEscrow)?;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .user
            .to_account_info()
            .lamports()
            .checked_add(payout)
            .ok_or(BetError::MathOverflow)?;

        ticket.claimed = true;
        if total_fee > 0 {
            market.fees_accrued = market
                .fees_accrued
                .checked_add(total_fee)
                .ok_or(BetError::MathOverflow)?;
        }
        Ok(())
    }

    /// Close a resolved (claimed or losing) ticket returning rent to user.
    pub fn close_ticket(ctx: Context<CloseTicket>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.resolved, BetError::MarketNotResolved);
        let ticket = &ctx.accounts.ticket;
        // Prevent prematurely closing an unclaimed winning ticket
        if ticket.side == market.winning_side && !ticket.claimed {
            return err!(BetError::CannotCloseActiveTicket);
        }
        // Anchor handles lamport return via close attribute.
        Ok(())
    }

    /// Withdraw accumulated fees to authority.
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let host_expected = Pubkey::from_str(HOST_PUBKEY).map_err(|_| BetError::Unauthorized)?;
        require!(ctx.accounts.host.key() == host_expected, BetError::Unauthorized);
        let amount = market.fees_accrued;
        require!(amount > 0, BetError::ZeroAmount);
        let total_bps = market.fee_bps as u64 + market.host_fee_bps as u64;
        let authority_share = if total_bps > 0 { (amount as u128 * market.fee_bps as u128 / total_bps as u128) as u64 } else { amount };
        let host_share = amount.checked_sub(authority_share).ok_or(BetError::MathOverflow)?;
        **market.to_account_info().try_borrow_mut_lamports()? = market
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(BetError::InsufficientEscrow)?;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .authority
            .to_account_info()
            .lamports()
            .checked_add(authority_share)
            .ok_or(BetError::MathOverflow)?;
        **ctx.accounts.host.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .host
            .to_account_info()
            .lamports()
            .checked_add(host_share)
            .ok_or(BetError::MathOverflow)?;
        market.fees_accrued = 0;
        Ok(())
    }

    /// Close a resolved market returning rent to authority. All winnings must be claimed and fees withdrawn.
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let host_expected = Pubkey::from_str(HOST_PUBKEY).map_err(|_| BetError::Unauthorized)?;
        require!(ctx.accounts.host.key() == host_expected, BetError::Unauthorized);
        require!(market.resolved, BetError::MarketNotResolved);
        let rent_min = Rent::get()?.minimum_balance(8 + BetMarket::SIZE);
        let current = market.to_account_info().lamports();
    // Salvage path (legacy / redundancy guard):
    // Originally needed when empty-side resolution was disallowed or fees not accrued at resolve time.
    // With current logic, resolve_market already accrues the entire losing pool into fees_accrued when the
    // winning side had zero bets, so this branch should rarely (ideally never) trigger except for historical
    // markets resolved before the upgrade. Keeping it as a safety net; can be removed after a migration window.
    // If triggered, it directly disburses remaining lamports above rent to authority+host according to fee split.
        let winning_pool = match market.winning_side { 0 => market.pool_yes, 1 => market.pool_no, _ => 0 };
        if winning_pool == 0 && current > rent_min {
            let distributable = current.checked_sub(rent_min).ok_or(BetError::MathOverflow)?;
            let total_bps = market.fee_bps as u64 + market.host_fee_bps as u64;
            let authority_share = if total_bps > 0 { (distributable as u128 * market.fee_bps as u128 / total_bps as u128) as u64 } else { distributable };
            let host_share = distributable.checked_sub(authority_share).unwrap_or(0);
            // deduct
            **market.to_account_info().try_borrow_mut_lamports()? = current - distributable;
            **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.authority.to_account_info().lamports().checked_add(authority_share).ok_or(BetError::MathOverflow)?;
            **ctx.accounts.host.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.host.to_account_info().lamports().checked_add(host_share).ok_or(BetError::MathOverflow)?;
        }
        // After salvage, ensure no pending fee accruals.
        require!(market.fees_accrued == 0, BetError::FeesRemaining);
        // Allow a small "dust" remainder (e.g. from integer division truncation in earlier versions) to be swept now.
        const DUST_MAX: u64 = 10; // up to 10 lamports tolerance
        let after = market.to_account_info().lamports();
        if after > rent_min {
            let extra = after.checked_sub(rent_min).ok_or(BetError::MathOverflow)?;
            if extra <= DUST_MAX {
                // Split dust proportionally using same fee weights (fall back to authority if total_bps == 0)
                let total_bps = market.fee_bps as u64 + market.host_fee_bps as u64;
                let authority_share = if total_bps > 0 { (extra as u128 * market.fee_bps as u128 / total_bps as u128) as u64 } else { extra };
                let host_share = extra.checked_sub(authority_share).unwrap_or(0);
                **market.to_account_info().try_borrow_mut_lamports()? = after.checked_sub(extra).ok_or(BetError::MathOverflow)?;
                **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.authority.to_account_info().lamports().checked_add(authority_share).ok_or(BetError::MathOverflow)?;
                **ctx.accounts.host.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.host.to_account_info().lamports().checked_add(host_share).ok_or(BetError::MathOverflow)?;
            }
        }
        require!(market.to_account_info().lamports() == rent_min, BetError::OutstandingLamports);
        Ok(())
    }

    /// Freeze the market to stop further betting prior to resolution.
    pub fn freeze_market(ctx: Context<FreezeMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, BetError::MarketAlreadyResolved);
        require!(!market.frozen, BetError::MarketAlreadyFrozen);
        market.frozen = true;
        Ok(())
    }
}

// -------------------------------------------------------------------------------------------------
// Events
// -------------------------------------------------------------------------------------------------
#[event]
pub struct MarketResolvedEvent {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub winning_side: u8,
    pub pool_yes: u64,
    pub pool_no: u64,
    pub no_winner: bool,
    pub fees_accrued: u64,
}

// -------------------------------------------------------------------------------------------------
// State
// -------------------------------------------------------------------------------------------------
pub const AUTHORITY_FEE_BPS_DEFAULT: u16 = 20; // 0.2%
pub const HOST_FEE_BPS_DEFAULT: u16 = 670; // 6.7%
pub const HOST_PUBKEY: &str = "9KQjnCXwNcnaojsfvuD894UjnCKvgwEDe4Kt1nfpDNHB"; // platform host wallet
pub const TITLE_MAX_LEN: usize = 64;
pub const LABEL_MAX_LEN: usize = 32;

#[account]
pub struct AuthorityMeta {
    pub authority: Pubkey,
    pub next_cycle: u16, // next cycle index to use when initializing a new market
    pub bump: u8,
}
impl AuthorityMeta { pub const SIZE: usize = 32 + 2 + 1; }

#[account]
pub struct BetMarket {
    pub authority: Pubkey,
    pub cycle: u16, // cycle index (unique per authority)
    pub pool_yes: u64,
    pub pool_no: u64,
    pub resolved: bool,
    pub frozen: bool,
    pub fee_bps: u16,       // authority bps
    pub host_fee_bps: u16,  // host bps
    pub bump: u8,
    pub winning_side: u8,
    pub fees_accrued: u64,  // total (authority+host) accrued
    pub title: [u8; TITLE_MAX_LEN],     // UTF-8 (not guaranteed validated) null-padded
    pub label_yes: [u8; LABEL_MAX_LEN], // label for side 0
    pub label_no: [u8; LABEL_MAX_LEN],  // label for side 1
}
// SIZE (without discriminator): previous 193 + 1 (frozen) = 194
impl BetMarket { pub const SIZE: usize = 32 + 2 + 8 + 8 + 1 + 1 + 2 + 2 + 1 + 1 + 8 + 64 + 32 + 32; }

#[account]
pub struct BetTicket {
    pub user: Pubkey,
    pub market: Pubkey,
    pub side: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}
impl BetTicket { pub const SIZE: usize = 32 + 32 + 1 + 8 + 1 + 1; }

// -------------------------------------------------------------------------------------------------
// Accounts
// -------------------------------------------------------------------------------------------------
#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"authority_meta", authority.key().as_ref()],
        bump = authority_meta.bump,
        has_one = authority
    )]
    pub authority_meta: Account<'info, AuthorityMeta>,
    #[account(
        init,
        payer = authority,
        space = 8 + BetMarket::SIZE,
        seeds = [b"market", authority.key().as_ref(), &authority_meta.next_cycle.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, BetMarket>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market", market.authority.as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
    #[account(
        mut,
        has_one = user,
        has_one = market,
        seeds = [b"ticket", market.key().as_ref(), user.key().as_ref()],
        bump = ticket.bump
    )]
    pub ticket: Account<'info, BetTicket>,
    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct CreateTicket<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market", market.authority.as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
    #[account(
        init,
        payer = user,
        space = 8 + BetTicket::SIZE,
        seeds = [b"ticket", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, BetTicket>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"market", authority.key().as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market", market.authority.as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
    #[account(
        mut,
        close = user,
        has_one = user,
        has_one = market,
        seeds = [b"ticket", market.key().as_ref(), user.key().as_ref()],
        bump = ticket.bump
    )]
    pub ticket: Account<'info, BetTicket>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [b"market", authority.key().as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
    /// CHECK: Unchecked; validated by comparing pubkey to HOST_PUBKEY constant inside handler.
    #[account(mut)]
    pub host: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        close = authority,
        seeds = [b"market", authority.key().as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
    /// CHECK: Unchecked; validated by comparing pubkey to HOST_PUBKEY constant inside handler.
    #[account(mut)]
    pub host: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CloseTicket<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market", market.authority.as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, BetMarket>,
    #[account(
        mut,
        close = user,
        has_one = user,
        has_one = market,
        seeds = [b"ticket", market.key().as_ref(), user.key().as_ref()],
        bump = ticket.bump
    )]
    pub ticket: Account<'info, BetTicket>,
}

#[derive(Accounts)]
pub struct FreezeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"market", authority.key().as_ref(), &market.cycle.to_le_bytes()],
        bump = market.bump,
        has_one = authority,
    )]
    pub market: Account<'info, BetMarket>,
}

// Phase 1 excludes resolve/claim/withdraw; will be added in next phase.

// -------------------------------------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------------------------------------
#[error_code]
pub enum BetError {
    #[msg("Invalid side")] InvalidSide,
    #[msg("Zero amount not allowed")] ZeroAmount,
    #[msg("Market already resolved")] MarketAlreadyResolved,
    #[msg("Ticket already claimed")] AlreadyClaimed,
    #[msg("Ticket side mismatch")] TicketSideMismatch,
    #[msg("Math overflow")] MathOverflow,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Ticket market mismatch")] TicketMarketMismatch,
    #[msg("Invalid fee bps")] InvalidFee,
    #[msg("Market not resolved")] MarketNotResolved,
    #[msg("Insufficient escrow")] InsufficientEscrow,
    #[msg("Invalid winning side")] InvalidWinningSide,
    #[msg("Fees still accrued")] FeesRemaining,
    #[msg("Outstanding lamports remain")] OutstandingLamports,
    #[msg("Cannot close active ticket")] CannotCloseActiveTicket,
    #[msg("Authority cannot bet on own market")] AuthorityCannotBet,
    #[msg("Label or title too long")] LabelTooLong,
    #[msg("Market is frozen")] MarketFrozen,
    #[msg("Market not frozen")] MarketNotFrozen,
    #[msg("Market already frozen")] MarketAlreadyFrozen,
}

#[derive(Accounts)]
pub struct InitAuthorityMeta<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + AuthorityMeta::SIZE,
        seeds = [b"authority_meta", authority.key().as_ref()],
        bump
    )]
    pub authority_meta: Account<'info, AuthorityMeta>,
    pub system_program: Program<'info, System>,
}

// Utility to write into fixed-size arrays (null padding)
fn write_fixed<const N: usize>(dst: &mut [u8; N], src: &[u8]) {
    for i in 0..N { dst[i] = 0; }
    if !src.is_empty() {
        let len = core::cmp::min(N, src.len());
        dst[..len].copy_from_slice(&src[..len]);
    }
}

// (Removed experimental unified bet instruction using init_if_needed; handled client-side instead.)
