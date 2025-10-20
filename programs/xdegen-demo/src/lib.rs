pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("6hB6CiM1kT9vk58LJbgrBDVQdh47QSH3tq8HxaksguUq");

#[program]
pub mod xdegen_demo {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize_handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
      deposit_handler(ctx, amount) 
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
      withdraw_handler(ctx, amount)
    }

    pub fn buy(
      ctx: Context<Buy>, 
      data: TokenParams, 
      amount: u64,
    ) -> Result<()> {
      buy_handler(ctx, data, amount)
    }

    pub fn sell(ctx: Context<Sell>, sell_amount: u64, burn_amount: u64) -> Result<()> {
      sell_handler(ctx, sell_amount, burn_amount)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
      claim_handler(ctx)
    }

    pub fn mint_token(ctx: Context<MintToken>, buy_amount: u64, mint_amount: u64) -> Result<()> {
      mint_token_handler(ctx, buy_amount, mint_amount)
    }
}
