use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ 
        Mint, 
        TokenAccount, 
        TokenInterface, 
        TransferChecked,
        transfer_checked,
    }
};

use session_keys::{Session, SessionToken};
use crate::{ Config, error::ErrorCode };

#[derive(Accounts, Session)]
pub struct Claim<'info> {
    #[session(
       signer = claimer,
       authority = claimer.key() 
    )]
    pub session_token: Option<Account<'info, SessionToken>>,

    #[account(mut)]
    pub claimer: Signer<'info>,
    // delegated account
    #[account(
        mut,
        has_one = xdegen_mint @ ErrorCode::InvalidMint,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub xdegen_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = claimer,
        associated_token::mint = xdegen_mint,
        associated_token::authority = claimer
    )]
    pub claimer_xdegen_ata: InterfaceAccount<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn claim_handler(ctx: Context<Claim>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(ctx.accounts.vault.amount >= config.claim_amount, ErrorCode::InsufficientFunds);

    let mint = ctx.accounts.xdegen_mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault".as_ref(),
        mint.as_ref(),
        &[config.vault_bump],
    ]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.claimer_xdegen_ata.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.xdegen_mint.to_account_info(),
            },
            signer_seeds
        ),
        config.claim_amount,
        ctx.accounts.xdegen_mint.decimals
    )?;

    config.total_claimed = config.total_claimed
        .checked_add(config.claim_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}