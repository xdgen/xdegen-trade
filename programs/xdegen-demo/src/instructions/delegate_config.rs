use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{delegate};
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::Config;

#[delegate]
#[derive(Accounts)]
pub struct DelegateConfigInput<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: pda to delegate
    #[account(
        mut, 
        del,
        seeds = [b"config"],
        bump
    )]
    pub config: AccountInfo<'info>
}

pub fn delegate_config_handler(ctx: Context<DelegateConfigInput>) -> Result<()> {
    ctx.accounts.delegate_config(
        &ctx.accounts.admin,
        &[b"config"],
        DelegateConfig::default()
    )?;
    Ok(())
}