use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken, 
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata,
    }, 
    token_interface::{ 
        mint_to_checked, 
        Mint, 
        MintToChecked, 
        TokenAccount, 
        TokenInterface,
        transfer_checked,
        TransferChecked
    }
};
use session_keys::{Session, SessionToken};
use crate::{ALLOWED_AMOUNTS, Config, TokenMetadata, TokenParams, TokenRecord, error::ErrorCode};

#[derive(Accounts, Session)]
#[instruction(data: TokenParams)]
pub struct Buy<'info> {
    #[session(
       signer = trader,
       authority = token_record.owner.key() 
    )]
    pub session_token: Option<Account<'info, SessionToken>>,

    #[account(mut)]
    pub trader: Signer<'info>,
    // delegated account
    #[account(
        mut,
        has_one = vault,
        has_one = xdegen_mint,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = trader,
        mint::decimals = data.decimals,
        mint::authority = trader
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = trader,
        associated_token::mint = mint,
        associated_token::authority = trader,
        associated_token::token_program = token_program
    )]
    pub trader_mint_ata: InterfaceAccount<'info, TokenAccount>,
    pub xdegen_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub trader_xdegen_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        space = TokenRecord::INIT_SPACE,
        payer = trader,
        seeds = [b"token_record", trader.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub token_record: Account<'info, TokenRecord>,

    /// CHECK: Metaplex mint metdata
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>, 
}

pub fn buy_handler(
    ctx: Context<Buy>, 
    data: TokenParams,
    amount: u64
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    require!(data.name.as_bytes().len() > 0, ErrorCode::NameLengthZero);
    require!(data.symbol.as_bytes().len() > 0, ErrorCode::SymbolLengthZero);
    require!(data.supply > 0, ErrorCode::InvalidSupply);
    require!(data.decimals <= 9, ErrorCode::InvalidDecimals);

    require!(
        amount > 0 && ALLOWED_AMOUNTS.contains(&amount), 
        ErrorCode::InvalidAmount
    );
    require!(
        ctx.accounts.trader_xdegen_ata.amount > amount, 
        ErrorCode::InsufficientFunds
    );

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
        amount,
        ctx.accounts.xdegen_mint.decimals
    )?;

    msg!("Adding token metadata");
    create_metadata_accounts_v3(
        CpiContext::new(
        ctx.accounts.token_metadata_program.to_account_info(),
         CreateMetadataAccountsV3 {
            payer: ctx.accounts.trader.to_account_info(),
            update_authority: ctx.accounts.trader.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.trader.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info()
        }),
        DataV2 {
            name: data.name.clone(),
            symbol: data.symbol.clone(),
            uri: data.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false,
        true,
        None
    )?;

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
        data.supply, 
        ctx.accounts.mint.decimals
    )?;

    config.total_trades = config.total_trades
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    config.total_buys = config.total_buys
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    ctx.accounts.token_record.set_inner(TokenRecord {
        mint: ctx.accounts.mint.key(),
        owner: ctx.accounts.trader.key(),
        balance: data.supply,
        metadata: TokenMetadata {
            name: data.name,
            symbol: data.symbol,
            uri: data.uri,
            decimals: data.decimals,
        },
        created_at: Clock::get()?.unix_timestamp,
        bump: ctx.bumps.token_record
    });

    Ok(())
}