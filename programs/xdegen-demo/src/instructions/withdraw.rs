use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken, 
    token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked}
};

use crate::{error::ErrorCode, Config};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        has_one = vault,
        has_one = admin @ ErrorCode::Unauthorized,
        constraint = config.xdegen_mint == xdegen_mint.key() @ ErrorCode::InvalidMint
    )]
    pub config: Account<'info, Config>,
    #[account(mut, address=config.xdegen_mint)]
    pub xdegen_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = xdegen_mint,
        associated_token::authority = admin,
        associated_token::token_program = token_program,
    )]
    pub admin_xdegen_ata: InterfaceAccount<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>
}

pub fn withdraw_handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(amount > 0, ErrorCode::InvalidAmount);
    require!(ctx.accounts.vault.amount >= amount, ErrorCode::InsufficientFunds);

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
                to: ctx.accounts.admin_xdegen_ata.to_account_info(),
                mint: ctx.accounts.xdegen_mint.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds
        ),
        amount,
        ctx.accounts.xdegen_mint.decimals
    )?;
    Ok(())
}