use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::commit, 
    ephem::commit_and_undelegate_accounts
};

use crate::Config;

#[commit]
#[derive(Accounts)]
pub struct UndelegateConfigInput<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>
}

pub fn undelegate_config_handler(ctx: Context<UndelegateConfigInput>) -> Result<()> {
    commit_and_undelegate_accounts(
        &ctx.accounts.admin, 
        vec![&ctx.accounts.config.to_account_info()], 
        &ctx.accounts.magic_context, 
        &ctx.accounts.magic_program
    )?;
    Ok(())
}

// RUST_LOG=info ephemeral-validator \
//     --accounts-lifecycle ephemeral \
//     --remote-cluster development \
//     --remote-url http://127.0.0.1:8899 \
//     --remote-ws-url ws://127.0.0.1:8900 \
//     --rpc-port 7799