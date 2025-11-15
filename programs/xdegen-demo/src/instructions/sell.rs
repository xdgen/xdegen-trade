use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken, 
    token_interface::{
        Mint, 
        TokenAccount, 
        TokenInterface, 
        transfer_checked, 
        TransferChecked,
        burn,
        Burn
    }
};

use session_keys::{Session, SessionToken};
use crate::{ALLOWED_AMOUNTS, Config, TokenRecord, error::ErrorCode};

#[derive(Accounts, Session)]
pub struct Sell<'info> {
    #[session(
       signer = trader,
       authority = token_record.owner.key() 
    )]
    pub session_token: Option<Account<'info, SessionToken>>,

    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        mut,
        has_one = vault,
        has_one = xdegen_mint @ ErrorCode::InvalidMint,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = trader,
    )]
    pub trader_mint: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub xdegen_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = xdegen_mint,
        associated_token::authority = trader,
    )]
    pub trader_xdegen_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"token_record", trader.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub token_record: Account<'info, TokenRecord>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>, 
}

pub fn sell_handler(
    ctx: Context<Sell>, 
    sell_amount: u64, 
    burn_amount: u64
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let token_record = &mut ctx.accounts.token_record;

    require!(
        sell_amount > 0 && ALLOWED_AMOUNTS.contains(&sell_amount), 
        ErrorCode::InvalidAmount
    );
    require!(ctx.accounts.trader_xdegen_ata.amount > sell_amount, ErrorCode::InsufficientFunds);
    require!(burn_amount > 0, ErrorCode::InvalidAmount);

    msg!("Transfer buy token to vault");
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.trader_xdegen_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.xdegen_mint.to_account_info(),
                authority: ctx.accounts.trader.to_account_info()
            },
        ),
        sell_amount,
        ctx.accounts.xdegen_mint.decimals
    )?;

    msg!(
        "Burn token supply {} from mint {}",
        burn_amount,
        ctx.accounts.mint.key()
    );
    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.trader.to_account_info(),
                from: ctx.accounts.trader_mint.to_account_info()
            }
        ),
        burn_amount
    )?;

    token_record.balance = token_record.balance
        .checked_sub(burn_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    config.total_trades = config.total_trades
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    config.total_sells = config.total_sells
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}