use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint,
    TokenAccount,
    MintToChecked,
    TokenInterface,
    TransferChecked,
    transfer_checked,
    mint_to_checked
};

use session_keys::{Session, SessionToken};
use crate::{ ALLOWED_AMOUNTS, Config, TokenRecord, error::ErrorCode };

#[derive(Accounts, Session)]
pub struct MintToken<'info> {
    #[session(
       signer = trader,
       authority = token_record.owner.key() 
    )]
    pub session_token: Option<Account<'info, SessionToken>>,

    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        mut,
        has_one = xdegen_mint @ ErrorCode::InvalidMint,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub xdegen_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub trader_xdegen_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub trader_mint_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"token_record", trader.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub token_record: Account<'info, TokenRecord>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn mint_token_handler(ctx: Context<MintToken>, buy_amount: u64, mint_amount: u64) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let token_record = &mut ctx.accounts.token_record;

    require!(mint_amount > 0, ErrorCode::InvalidAmount);
    require!(
        buy_amount > 0 && ALLOWED_AMOUNTS.contains(&buy_amount), 
        ErrorCode::InvalidAmount
    );
    require!(ctx.accounts.trader_xdegen_ata.amount > 0, ErrorCode::InsufficientFunds);

    msg!("
        Transfer funds {} from trader to vault {} for minting token {}", 
        buy_amount,
        ctx.accounts.vault.key(),
        ctx.accounts.xdegen_mint.key()
    );
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.trader_xdegen_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.xdegen_mint.to_account_info(),
                authority: ctx.accounts.trader.to_account_info(),
            }
        ),
        buy_amount,
        ctx.accounts.xdegen_mint.decimals
    )?;

    msg!(
        "Minting token {} to trader {}",
        ctx.accounts.mint.key(),
        ctx.accounts.trader.key()
    );
    msg!(
        "Mint token {} to trader {}", 
        ctx.accounts.mint.key(), 
        ctx.accounts.trader.key()
    );
    mint_to_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintToChecked {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.trader_mint_ata.to_account_info(),
                authority: ctx.accounts.trader.to_account_info()
            }
        ), 
        mint_amount, 
        ctx.accounts.mint.decimals
    )?;

    token_record.balance = token_record.balance
        .checked_add(mint_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    config.total_trades = config.total_trades
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    config.total_buys = config.total_buys
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}
