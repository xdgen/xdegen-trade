use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked};

use crate::{error::ErrorCode, Config};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        has_one = admin @ ErrorCode::Unauthorized,
        constraint = config.xdegen_mint == mint.key() @ ErrorCode::CustomError
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, address=config.xdegen_mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn deposit_handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.admin_token_account.mint == ctx.accounts.mint.key(), ErrorCode::InvalidMint);
    require!(ctx.accounts.admin_token_account.amount >= amount, ErrorCode::InsufficientFunds);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.admin_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            }
        ),
        amount, 
        ctx.accounts.mint.decimals
    )?;
    Ok(())
}