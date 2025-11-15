use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TokenRecord {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub balance: u64,
    pub metadata: TokenMetadata,
    pub created_at: i64,
    pub bump: u8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct TokenMetadata {
    #[max_len(60)]
    pub name: String,
    #[max_len(32)]
    pub symbol: String,
    #[max_len(250)]
    pub uri: String,
    pub decimals: u8,
}