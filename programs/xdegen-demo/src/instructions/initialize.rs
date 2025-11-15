use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{Config, error::ErrorCode};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub xdegen_mint: InterfaceAccount<'info, Mint>,  
    #[account(
        init,
        payer = admin,
        token::mint = xdegen_mint,
        token::authority = vault,
        seeds = [b"vault", xdegen_mint.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
    let claim_amount = 50u64
        .checked_mul(10u64.pow(ctx.accounts.xdegen_mint.decimals as u32))
        .ok_or(ErrorCode::MathOverflow)?;

    ctx.accounts.config.set_inner(Config {
        admin: ctx.accounts.admin.key(),
        vault: ctx.accounts.vault.key(),
        vault_bump: ctx.bumps.vault,
        xdegen_mint: ctx.accounts.xdegen_mint.key(),
        claim_amount,
        total_trades: 0,
        total_buys: 0,
        total_sells: 0,
        total_claimed: 0,
        bump: ctx.bumps.config,
    });
    Ok(())
}
