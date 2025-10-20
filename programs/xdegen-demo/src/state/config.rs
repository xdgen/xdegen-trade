use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub vault: Pubkey,
    pub vault_bump: u8,
    pub xdegen_mint: Pubkey,
    pub total_trades: u64,
    pub claim_amount: u64,
    pub total_buys: u64,
    pub total_sells: u64,
    pub total_claimed: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenParams {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub uri: String,
    pub supply: u64
}

pub const ALLOWED_AMOUNTS: [u64; 10] = [
    500_000_000, 
    1_000_000_000, 
    1_500_000_000, 
    2_000_000_000, 
    2_500_000_000, 
    3_000_000_000, 
    3_500_000_000, 
    4_000_000_000, 
    4_500_000_000, 
    5_000_000_000
]; 