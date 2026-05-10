use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("4pPWvEnHLd2MRCW67nS7uZViBiyxo3M51S65NoFc7fiB");

#[program]
pub mod shadowpilot {
    use super::*;

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_seed: u64,
        payout_lamports: u64,
        bundle_hash: [u8; 32],
        title: String,
        environment: String,
        bundle_uri: String,
    ) -> Result<()> {
        validate_max_len(
            &title,
            TaskRequest::MAX_TITLE_BYTES,
            ShadowPilotError::TitleTooLong,
        )?;
        validate_max_len(
            &environment,
            TaskRequest::MAX_ENVIRONMENT_BYTES,
            ShadowPilotError::EnvironmentTooLong,
        )?;
        validate_max_len(
            &bundle_uri,
            TaskRequest::MAX_BUNDLE_URI_BYTES,
            ShadowPilotError::BundleUriTooLong,
        )?;
        require!(payout_lamports > 0, ShadowPilotError::InvalidPayoutAmount);

        let task_request = &mut ctx.accounts.task_request;
        task_request.buyer = ctx.accounts.buyer.key();
        task_request.assigned_pilot = Pubkey::default();
        task_request.task_seed = task_seed;
        task_request.payout_lamports = payout_lamports;
        task_request.funded_lamports = 0;
        task_request.bundle_hash = bundle_hash;
        task_request.status = TaskStatus::Open;
        task_request.bump = ctx.bumps.task_request;
        task_request.created_at = Clock::get()?.unix_timestamp;
        task_request.title = title;
        task_request.environment = environment;
        task_request.bundle_uri = bundle_uri;

        Ok(())
    }

    pub fn fund_task(ctx: Context<FundTask>, amount: u64) -> Result<()> {
        require!(amount > 0, ShadowPilotError::InvalidFundingAmount);
        require!(
            matches!(
                ctx.accounts.task_request.status,
                TaskStatus::Open | TaskStatus::Claimed
            ),
            ShadowPilotError::TaskNotFundable
        );

        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.task_request.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.key(), cpi_accounts);
        transfer(cpi_ctx, amount)?;

        ctx.accounts.task_request.funded_lamports = ctx
            .accounts
            .task_request
            .funded_lamports
            .checked_add(amount)
            .ok_or(ShadowPilotError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn configure_task_access(
        ctx: Context<ConfigureTaskAccess>,
        world_id_required: bool,
    ) -> Result<()> {
        let task_access_policy = &mut ctx.accounts.task_access_policy;
        task_access_policy.task_request = ctx.accounts.task_request.key();
        task_access_policy.buyer = ctx.accounts.buyer.key();
        task_access_policy.world_id_required = world_id_required;
        task_access_policy.updated_at = Clock::get()?.unix_timestamp;
        task_access_policy.bump = ctx.bumps.task_access_policy;

        Ok(())
    }

    pub fn link_world_verification(
        ctx: Context<LinkWorldVerification>,
        nullifier_hash: [u8; 32],
        reputation_commitment: [u8; 32],
        skill_band: u8,
    ) -> Result<()> {
        require!(
            nullifier_hash != [0; 32],
            ShadowPilotError::InvalidWorldNullifier
        );

        let now = Clock::get()?.unix_timestamp;
        let pilot_profile = &mut ctx.accounts.pilot_profile;
        if pilot_profile.wallet == Pubkey::default() {
            pilot_profile.wallet = ctx.accounts.pilot.key();
            pilot_profile.interventions_completed = 0;
            pilot_profile.bump = ctx.bumps.pilot_profile;
        } else {
            require!(
                pilot_profile.wallet == ctx.accounts.pilot.key(),
                ShadowPilotError::Unauthorized
            );
        }
        pilot_profile.skill_band = skill_band;
        pilot_profile.reputation_commitment = reputation_commitment;
        pilot_profile.world_verified = true;
        pilot_profile.last_active_at = now;

        let world_verification = &mut ctx.accounts.world_verification;
        if world_verification.wallet != Pubkey::default() {
            require!(
                world_verification.wallet == ctx.accounts.pilot.key(),
                ShadowPilotError::WorldVerificationWalletMismatch
            );
        }
        world_verification.wallet = ctx.accounts.pilot.key();
        world_verification.nullifier_hash = nullifier_hash;
        world_verification.verified_at = now;
        world_verification.bump = ctx.bumps.world_verification;

        Ok(())
    }

    pub fn claim_task(
        ctx: Context<ClaimTask>,
        reputation_commitment: [u8; 32],
        skill_band: u8,
    ) -> Result<()> {
        let task_request = &mut ctx.accounts.task_request;
        require!(
            matches!(task_request.status, TaskStatus::Open),
            ShadowPilotError::TaskNotOpen
        );
        require!(
            task_request.funded_lamports >= task_request.payout_lamports,
            ShadowPilotError::EscrowNotFunded
        );

        let pilot_profile = &mut ctx.accounts.pilot_profile;
        if pilot_profile.wallet == Pubkey::default() {
            pilot_profile.wallet = ctx.accounts.pilot.key();
            pilot_profile.skill_band = skill_band;
            pilot_profile.interventions_completed = 0;
            pilot_profile.reputation_commitment = reputation_commitment;
            pilot_profile.world_verified = false;
            pilot_profile.last_active_at = Clock::get()?.unix_timestamp;
            pilot_profile.bump = ctx.bumps.pilot_profile;
        } else {
            require!(
                pilot_profile.wallet == ctx.accounts.pilot.key(),
                ShadowPilotError::Unauthorized
            );
            pilot_profile.skill_band = skill_band;
            pilot_profile.reputation_commitment = reputation_commitment;
            pilot_profile.last_active_at = Clock::get()?.unix_timestamp;
        }

        if !ctx.accounts.task_access_policy.data_is_empty() {
            let task_access_policy_data = ctx.accounts.task_access_policy.data.borrow();
            let mut task_access_policy_bytes: &[u8] = &task_access_policy_data;
            let task_access_policy =
                TaskAccessPolicy::try_deserialize(&mut task_access_policy_bytes)?;
            require!(
                task_access_policy.task_request == task_request.key(),
                ShadowPilotError::TaskAccessPolicyMismatch
            );

            if task_access_policy.world_id_required {
                require!(
                    pilot_profile.world_verified,
                    ShadowPilotError::HumanVerificationRequired
                );
                require!(
                    !ctx.accounts.world_verification.data_is_empty(),
                    ShadowPilotError::MissingWorldVerification
                );

                let world_verification_data = ctx.accounts.world_verification.data.borrow();
                let mut world_verification_bytes: &[u8] = &world_verification_data;
                let world_verification =
                    WorldVerification::try_deserialize(&mut world_verification_bytes)?;
                require!(
                    world_verification.wallet == ctx.accounts.pilot.key(),
                    ShadowPilotError::WorldVerificationWalletMismatch
                );
            }
        }

        task_request.assigned_pilot = ctx.accounts.pilot.key();
        task_request.status = TaskStatus::Claimed;

        let task_claim = &mut ctx.accounts.task_claim;
        task_claim.task_request = task_request.key();
        task_claim.pilot = ctx.accounts.pilot.key();
        task_claim.trace_hash = [0; 32];
        task_claim.trace_uri = String::new();
        task_claim.success = false;
        task_claim.collision_count = 0;
        task_claim.intervention_millis = 0;
        task_claim.path_efficiency_bps = 0;
        task_claim.score_bps = 0;
        task_claim.payout_lamports = 0;
        task_claim.submitted_at = 0;
        task_claim.status = ClaimStatus::Claimed;
        task_claim.bump = ctx.bumps.task_claim;

        Ok(())
    }

    pub fn submit_session(
        ctx: Context<SubmitSession>,
        trace_hash: [u8; 32],
        trace_uri: String,
        success: bool,
        collision_count: u16,
        intervention_millis: u64,
        path_efficiency_bps: u16,
    ) -> Result<()> {
        validate_max_len(
            &trace_uri,
            TaskClaim::MAX_TRACE_URI_BYTES,
            ShadowPilotError::TraceUriTooLong,
        )?;

        let task_claim = &mut ctx.accounts.task_claim;
        require!(
            matches!(task_claim.status, ClaimStatus::Claimed),
            ShadowPilotError::TaskNotClaimed
        );

        task_claim.trace_hash = trace_hash;
        task_claim.trace_uri = trace_uri;
        task_claim.success = success;
        task_claim.collision_count = collision_count;
        task_claim.intervention_millis = intervention_millis;
        task_claim.path_efficiency_bps = path_efficiency_bps;
        task_claim.submitted_at = Clock::get()?.unix_timestamp;
        task_claim.status = ClaimStatus::Submitted;

        ctx.accounts.task_request.status = TaskStatus::Submitted;
        ctx.accounts.pilot_profile.interventions_completed = ctx
            .accounts
            .pilot_profile
            .interventions_completed
            .checked_add(1)
            .ok_or(ShadowPilotError::ArithmeticOverflow)?;
        ctx.accounts.pilot_profile.last_active_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn finalize_session(
        ctx: Context<FinalizeSession>,
        score_bps: u16,
        payout_lamports: u64,
        accepted_score_band: u8,
        payout_tier: u8,
        usage_rights: UsageRights,
        review_commitment: [u8; 32],
        next_reputation_commitment: [u8; 32],
    ) -> Result<()> {
        require!(
            matches!(ctx.accounts.task_claim.status, ClaimStatus::Submitted),
            ShadowPilotError::SessionNotSubmitted
        );
        require!(
            payout_lamports <= ctx.accounts.task_request.funded_lamports,
            ShadowPilotError::PayoutExceedsEscrow
        );
        require!(
            review_commitment != [0; 32] && next_reputation_commitment != [0; 32],
            ShadowPilotError::InvalidConfidentialCommitment
        );

        let task_claim = &mut ctx.accounts.task_claim;
        task_claim.score_bps = score_bps;
        task_claim.payout_lamports = payout_lamports;
        task_claim.status = ClaimStatus::Finalized;

        let session_receipt = &mut ctx.accounts.session_receipt;
        session_receipt.task_request = ctx.accounts.task_request.key();
        session_receipt.task_claim = task_claim.key();
        session_receipt.buyer = ctx.accounts.buyer.key();
        session_receipt.pilot = task_claim.pilot;
        session_receipt.trace_hash = task_claim.trace_hash;
        session_receipt.accepted_score_band = accepted_score_band;
        session_receipt.payout_tier = payout_tier;
        session_receipt.review_commitment = review_commitment;
        session_receipt.receipt_mint = Pubkey::default();
        session_receipt.usage_rights = usage_rights;
        session_receipt.minted_at = 0;
        session_receipt.bump = ctx.bumps.session_receipt;

        ctx.accounts.pilot_profile.reputation_commitment = next_reputation_commitment;
        ctx.accounts.pilot_profile.last_active_at = Clock::get()?.unix_timestamp;
        ctx.accounts.task_request.status = TaskStatus::Scored;

        Ok(())
    }

    pub fn release_payout(ctx: Context<ReleasePayout>) -> Result<()> {
        require!(
            matches!(ctx.accounts.task_claim.status, ClaimStatus::Finalized),
            ShadowPilotError::SessionNotFinalized
        );
        require!(
            ctx.accounts.pilot_wallet.key() == ctx.accounts.task_claim.pilot,
            ShadowPilotError::InvalidPilotWallet
        );

        let payout_lamports = ctx.accounts.task_claim.payout_lamports;
        require!(payout_lamports > 0, ShadowPilotError::InvalidPayoutAmount);

        ctx.accounts.task_request.sub_lamports(payout_lamports)?;
        ctx.accounts.pilot_wallet.add_lamports(payout_lamports)?;
        ctx.accounts.task_request.funded_lamports = ctx
            .accounts
            .task_request
            .funded_lamports
            .checked_sub(payout_lamports)
            .ok_or(ShadowPilotError::ArithmeticOverflow)?;
        ctx.accounts.task_claim.status = ClaimStatus::Paid;
        ctx.accounts.task_request.status = TaskStatus::Paid;

        Ok(())
    }

    pub fn mint_receipt(ctx: Context<MintReceipt>, receipt_mint: Pubkey) -> Result<()> {
        require!(
            matches!(ctx.accounts.task_claim.status, ClaimStatus::Paid),
            ShadowPilotError::PayoutNotReleased
        );
        require!(
            ctx.accounts.session_receipt.receipt_mint == Pubkey::default(),
            ShadowPilotError::ReceiptAlreadyMinted
        );

        ctx.accounts.session_receipt.receipt_mint = receipt_mint;
        ctx.accounts.session_receipt.minted_at = Clock::get()?.unix_timestamp;
        ctx.accounts.task_request.status = TaskStatus::Closed;

        Ok(())
    }
}

fn validate_max_len(value: &str, max_len: usize, error: ShadowPilotError) -> Result<()> {
    if value.as_bytes().len() > max_len {
        return Err(error.into());
    }
    Ok(())
}

#[derive(Accounts)]
#[instruction(task_seed: u64)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        init,
        payer = buyer,
        space = TaskRequest::LEN,
        seeds = [b"task", buyer.key().as_ref(), &task_seed.to_le_bytes()],
        bump
    )]
    pub task_request: Account<'info, TaskRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundTask<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = buyer)]
    pub task_request: Account<'info, TaskRequest>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureTaskAccess<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = buyer)]
    pub task_request: Account<'info, TaskRequest>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = TaskAccessPolicy::LEN,
        seeds = [b"policy", task_request.key().as_ref()],
        bump
    )]
    pub task_access_policy: Account<'info, TaskAccessPolicy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LinkWorldVerification<'info> {
    #[account(mut)]
    pub pilot: Signer<'info>,
    #[account(
        init_if_needed,
        payer = pilot,
        space = PilotProfile::LEN,
        seeds = [b"pilot", pilot.key().as_ref()],
        bump
    )]
    pub pilot_profile: Account<'info, PilotProfile>,
    #[account(
        init_if_needed,
        payer = pilot,
        space = WorldVerification::LEN,
        seeds = [b"world", pilot.key().as_ref()],
        bump
    )]
    pub world_verification: Account<'info, WorldVerification>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimTask<'info> {
    #[account(mut)]
    pub pilot: Signer<'info>,
    #[account(mut)]
    pub task_request: Account<'info, TaskRequest>,
    #[account(
        init_if_needed,
        payer = pilot,
        space = PilotProfile::LEN,
        seeds = [b"pilot", pilot.key().as_ref()],
        bump
    )]
    pub pilot_profile: Account<'info, PilotProfile>,
    #[account(
        init,
        payer = pilot,
        space = TaskClaim::LEN,
        seeds = [b"claim", task_request.key().as_ref(), pilot.key().as_ref()],
        bump
    )]
    pub task_claim: Account<'info, TaskClaim>,
    /// CHECK: This PDA is derived from the task and only deserialized if initialized.
    #[account(seeds = [b"policy", task_request.key().as_ref()], bump)]
    pub task_access_policy: UncheckedAccount<'info>,
    /// CHECK: This PDA is derived from the pilot and only deserialized if initialized.
    #[account(seeds = [b"world", pilot.key().as_ref()], bump)]
    pub world_verification: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitSession<'info> {
    #[account(mut)]
    pub pilot: Signer<'info>,
    #[account(mut)]
    pub task_request: Account<'info, TaskRequest>,
    #[account(mut, constraint = pilot_profile.wallet == pilot.key() @ ShadowPilotError::Unauthorized)]
    pub pilot_profile: Account<'info, PilotProfile>,
    #[account(mut, has_one = task_request, has_one = pilot)]
    pub task_claim: Account<'info, TaskClaim>,
}

#[derive(Accounts)]
pub struct FinalizeSession<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = buyer)]
    pub task_request: Account<'info, TaskRequest>,
    #[account(mut, has_one = task_request)]
    pub task_claim: Account<'info, TaskClaim>,
    #[account(
        mut,
        constraint = pilot_profile.wallet == task_claim.pilot @ ShadowPilotError::Unauthorized
    )]
    pub pilot_profile: Account<'info, PilotProfile>,
    #[account(
        init,
        payer = buyer,
        space = SessionReceipt::LEN,
        seeds = [b"receipt", task_claim.key().as_ref()],
        bump
    )]
    pub session_receipt: Account<'info, SessionReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleasePayout<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = buyer)]
    pub task_request: Account<'info, TaskRequest>,
    #[account(mut, has_one = task_request)]
    pub task_claim: Account<'info, TaskClaim>,
    #[account(mut)]
    pub pilot_wallet: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct MintReceipt<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = buyer)]
    pub task_request: Account<'info, TaskRequest>,
    #[account(mut, has_one = task_request)]
    pub task_claim: Account<'info, TaskClaim>,
    #[account(mut, has_one = buyer, has_one = task_claim)]
    pub session_receipt: Account<'info, SessionReceipt>,
}

#[account]
pub struct TaskRequest {
    pub buyer: Pubkey,
    pub assigned_pilot: Pubkey,
    pub task_seed: u64,
    pub payout_lamports: u64,
    pub funded_lamports: u64,
    pub bundle_hash: [u8; 32],
    pub status: TaskStatus,
    pub bump: u8,
    pub created_at: i64,
    pub title: String,
    pub environment: String,
    pub bundle_uri: String,
}

impl TaskRequest {
    pub const MAX_TITLE_BYTES: usize = 64;
    pub const MAX_ENVIRONMENT_BYTES: usize = 40;
    pub const MAX_BUNDLE_URI_BYTES: usize = 160;
    pub const LEN: usize = 8 + 406;
}

#[account]
pub struct PilotProfile {
    pub wallet: Pubkey,
    pub world_verified: bool,
    pub skill_band: u8,
    pub interventions_completed: u32,
    pub reputation_commitment: [u8; 32],
    pub last_active_at: i64,
    pub bump: u8,
}

impl PilotProfile {
    pub const LEN: usize = 8 + 79;
}

#[account]
pub struct TaskClaim {
    pub task_request: Pubkey,
    pub pilot: Pubkey,
    pub trace_hash: [u8; 32],
    pub trace_uri: String,
    pub success: bool,
    pub collision_count: u16,
    pub intervention_millis: u64,
    pub path_efficiency_bps: u16,
    pub score_bps: u16,
    pub payout_lamports: u64,
    pub submitted_at: i64,
    pub status: ClaimStatus,
    pub bump: u8,
}

impl TaskClaim {
    pub const MAX_TRACE_URI_BYTES: usize = 160;
    pub const LEN: usize = 8 + 293;
}

#[account]
pub struct TaskAccessPolicy {
    pub task_request: Pubkey,
    pub buyer: Pubkey,
    pub world_id_required: bool,
    pub updated_at: i64,
    pub bump: u8,
}

impl TaskAccessPolicy {
    pub const LEN: usize = 8 + 74;
}

#[account]
pub struct WorldVerification {
    pub wallet: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub verified_at: i64,
    pub bump: u8,
}

impl WorldVerification {
    pub const LEN: usize = 8 + 73;
}

#[account]
pub struct SessionReceipt {
    pub task_request: Pubkey,
    pub task_claim: Pubkey,
    pub buyer: Pubkey,
    pub pilot: Pubkey,
    pub trace_hash: [u8; 32],
    pub accepted_score_band: u8,
    pub payout_tier: u8,
    pub review_commitment: [u8; 32],
    pub receipt_mint: Pubkey,
    pub usage_rights: UsageRights,
    pub minted_at: i64,
    pub bump: u8,
}

impl SessionReceipt {
    pub const LEN: usize = 8 + 236;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    Claimed,
    Submitted,
    Scored,
    Paid,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ClaimStatus {
    Claimed,
    Submitted,
    Finalized,
    Paid,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum UsageRights {
    ReplayOnly,
    TrainingAndReplay,
    ExclusiveTraining,
}

#[error_code]
pub enum ShadowPilotError {
    #[msg("Only the authorized account can perform this action.")]
    Unauthorized,
    #[msg("Task title exceeds the supported length.")]
    TitleTooLong,
    #[msg("Task environment exceeds the supported length.")]
    EnvironmentTooLong,
    #[msg("Task bundle URI exceeds the supported length.")]
    BundleUriTooLong,
    #[msg("Trace URI exceeds the supported length.")]
    TraceUriTooLong,
    #[msg("Payout amount must be greater than zero.")]
    InvalidPayoutAmount,
    #[msg("Funding amount must be greater than zero.")]
    InvalidFundingAmount,
    #[msg("Arithmetic overflow detected.")]
    ArithmeticOverflow,
    #[msg("The task is not in an open state.")]
    TaskNotOpen,
    #[msg("The task cannot be funded in its current state.")]
    TaskNotFundable,
    #[msg("Escrow is not fully funded yet.")]
    EscrowNotFunded,
    #[msg("A verified human proof is required before claiming.")]
    HumanVerificationRequired,
    #[msg("The provided task access policy does not match this task.")]
    TaskAccessPolicyMismatch,
    #[msg("A World ID link is required before claiming this task.")]
    MissingWorldVerification,
    #[msg("The World ID nullifier commitment is invalid.")]
    InvalidWorldNullifier,
    #[msg("The confidential review or reputation commitment is invalid.")]
    InvalidConfidentialCommitment,
    #[msg("The linked World ID record belongs to a different wallet.")]
    WorldVerificationWalletMismatch,
    #[msg("The task has not been claimed yet.")]
    TaskNotClaimed,
    #[msg("The session has not been submitted yet.")]
    SessionNotSubmitted,
    #[msg("The payout exceeds the funded escrow balance.")]
    PayoutExceedsEscrow,
    #[msg("The session has not been finalized yet.")]
    SessionNotFinalized,
    #[msg("The provided pilot wallet does not match the claim.")]
    InvalidPilotWallet,
    #[msg("The payout has not been released yet.")]
    PayoutNotReleased,
    #[msg("The receipt has already been minted.")]
    ReceiptAlreadyMinted,
}
