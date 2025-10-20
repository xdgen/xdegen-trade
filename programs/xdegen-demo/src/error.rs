use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid supply")]
    InvalidSupply,
    #[msg("Invalid decimals")]
    InvalidDecimals,
    #[msg("Name Length Zero")]
    NameLengthZero,
    #[msg("Symbol Length Zero")]
    SymbolLengthZero,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math Overflow")]
    MathOverflow
}
