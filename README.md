# Xdegen

A Solana-based decentralized token trading platform built with Anchor framework. Xdegen enables users to buy, sell, mint, and trade multiple unique tokens using the native XDEGEN token as the primary currency.

## Overview

Xdegen is a sophisticated DeFi protocol that allows users to:
- **Buy custom tokens** using XDEGEN tokens with unique mint addresses
- **Sell tokens** and receive XDEGEN tokens in return
- **Mint new token types** with custom metadata and unique addresses
- **Multi-Token Support**: Traders can purchase unlimited different tokens
- **Deposit and withdraw** XDEGEN tokens
- **Claim rewards** from trading activities

## Features

### Core Functionality
- **Token Trading**: Seamless buy/sell operations with XDEGEN as base currency
- **Dynamic Token Creation**: Mint new SPL tokens with custom metadata via Metaplex
- **Multi-Token Minting**: Support for unlimited unique token types per trader
- **Vault Management**: Secure token storage and admin-controlled operations
- **Trading Statistics**: Comprehensive tracking of trades, buys, sells, and claims

### Security & Compliance
- **Access Control**: Admin-only operations for critical functions
- **Amount Validation**: Predefined allowed trading amounts (500M - 5B tokens)
- **Overflow Protection**: Mathematical operation safeguards
- **Unique Token Addresses**: Each token gets a unique mint address for maximum flexibility

## Architecture

### Program Structure
```
programs/xdegen-demo/src/
├── lib.rs              # Main program entry point
├── instructions/       # Transaction handlers
│   ├── buy.rs         # Token purchase logic (supports multiple unique tokens)
│   ├── sell.rs        # Token selling with burn mechanism
│   ├── mint.rs        # Additional token minting (supports multiple tokens)
│   ├── deposit.rs     # XDEGEN deposits
│   ├── withdraw.rs    # XDEGEN withdrawals
│   ├── claim.rs       # Reward claiming
│   └── initialize.rs  # Program setup
├── state/             # Data structures
│   ├── config.rs     # Program configuration
│   └── mod.rs
├── constants.rs      # Program constants
└── error.rs         # Custom error types
```

### Key Components

#### Configuration (`Config`)
```rust
pub struct Config {
    pub admin: Pubkey,           // Program administrator
    pub vault: Pubkey,           // Token vault account
    pub vault_bump: u8,          // Vault PDA bump seed
    pub xdegen_mint: Pubkey,     // XDEGEN token mint
    pub total_trades: u64,       // Total transaction count
    pub total_buys: u64,         // Total buy operations
    pub total_sells: u64,        // Total sell operations
    pub total_claimed: u64,      // Total claimed rewards
    pub bump: u8                 // Config PDA bump seed
}
```

#### Token Parameters (`TokenParams`)
```rust
pub struct TokenParams {
    pub name: String,      // Token name
    pub symbol: String,    // Token symbol
    pub decimals: u8,      // Token decimals (max 9)
    pub uri: String,       // Metadata URI
    pub supply: u64        // Total supply to mint
}
```

#### Allowed Amounts
Predefined trading amounts in XDEGEN tokens:
- 500,000,000 (500M)
- 1,000,000,000 (1B)
- 1,500,000,000 (1.5B)
- 2,000,000,000 (2B)
- 2,500,000,000 (2.5B)
- 3,000,000,000 (3B)
- 3,500,000,000 (3.5B)
- 4,000,000,000 (4B)
- 4,500,000,000 (4.5B)
- 5,000,000,000 (5B)

## Installation

### Prerequisites
- Rust (latest stable)
- Solana CLI
- Anchor CLI
- Node.js & Yarn

### Setup
1. Clone the repository:
```bash
git clone <repository-url>
cd xdegen-demo
```

2. Install dependencies:
```bash
yarn install
```

3. Build the program:
```bash
anchor build
```

4. Deploy to localnet:
```bash
anchor deploy
```

## Usage

### Development

1. Start local validator:
```bash
solana-test-validator
```

2. Deploy program:
```bash
anchor deploy
```

3. Run tests:
```bash
anchor test
```

### Client Integration

The project includes TypeScript client bindings and tests:

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { XdegenDemo } from '../target/types/xdegen_demo';

// Initialize client
const provider = AnchorProvider.env();
const program = new Program<XdegenDemo>(IDL, programId, provider);

// Example: Buy tokens
await program.methods
  .buy(tokenParams, amount)
  .accounts({
    trader: wallet.publicKey,
    // ... other accounts
  })
  .rpc();
```

## Instructions

### Initialize
Set up the program with initial configuration.

**Accounts:**
- `admin`: Program administrator
- `config`: Program configuration account
- `vault`: Token vault for XDEGEN storage
- `xdegen_mint`: XDEGEN token mint address

### Deposit
Deposit XDEGEN tokens into the program vault.

**Parameters:**
- `amount`: Amount of XDEGEN tokens to deposit

### Withdraw
Withdraw XDEGEN tokens from the program vault (admin only).

**Parameters:**
- `amount`: Amount of XDEGEN tokens to withdraw

### Buy
Purchase custom tokens using XDEGEN tokens.

**Parameters:**
- `data`: Token metadata (name, symbol, decimals, URI, supply)
- `amount`: Amount of XDEGEN tokens to spend

**Process:**
1. Validates token parameters
2. Transfers XDEGEN from buyer to vault
3. Creates token metadata via Metaplex
4. Mints tokens to buyer's associated token account
5. Updates trading statistics

### Sell
Sell tokens back to the program and receive XDEGEN tokens.

**Parameters:**
- `sell_amount`: Amount of XDEGEN tokens to receive
- `burn_amount`: Amount of custom tokens to burn

**Process:**
1. Validates amounts and allowances
2. Transfers XDEGEN from vault to seller
3. Burns specified amount of custom tokens
4. Updates trading statistics

### Claim
Claim accumulated rewards (implementation details in claim.rs).

**Parameters:**
- `amount`: Amount of rewards to claim

### Mint Token
Mint additional tokens for existing token types (admin only).

**Parameters:**
- `buy_amount`: Amount of XDEGEN tokens required
- `mint_amount`: Amount of tokens to mint

## Error Handling

The program includes comprehensive error handling:

- `Unauthorized`: Access control violations
- `InvalidMint`: Invalid token mint addresses
- `InsufficientFunds`: Insufficient token balance
- `InvalidAmount`: Amount not in allowed list or zero
- `MathOverflow`: Arithmetic operation overflow
- `NameLengthZero`: Empty token name
- `SymbolLengthZero`: Empty token symbol
- `InvalidSupply`: Zero or invalid token supply
- `InvalidDecimals`: Decimals exceed maximum (9)

## Development

### Building
```bash
anchor build
```

### Testing
```bash
anchor test
```

### TypeScript Client Generation
```bash
anchor build
# Generates target/types/xdegen_demo.ts and target/idl/xdegen_demo.json
```

### Code Formatting
```bash
yarn lint:fix  # Fix formatting issues
yarn lint      # Check formatting
```

## Security Considerations

- All critical operations require proper authorization
- Amount validation prevents invalid transactions
- PDA usage ensures deterministic address generation
- Overflow protection for all mathematical operations
- Input validation for all token parameters

## License

ISC License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Support

For support and questions, please open an issue in the repository or contact the development team.

---

**Note**: This project is built with Anchor v0.31.1 and targets Solana blockchain. Ensure compatibility when using different versions.