import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { XdegenDemo } from "../target/types/xdegen_demo";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAssociatedTokenAccount, mintTo, getAssociatedTokenAddress, getAccount, getOrCreateAssociatedTokenAccount, ASSOCIATED_TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
import { expect } from "chai";
import * as fs from "fs"
import * as path from "path"
import { min } from "bn.js";

const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

describe("xdegen-demo", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.xdegenDemo as Program<XdegenDemo>;
  const connection = provider.connection;
  const wallet = provider.wallet;

  console.log("Program ID:", program.programId.toBase58());

  let xdegenMint: anchor.web3.PublicKey;
  let traderXdegenAta: anchor.web3.PublicKey;
  let walletXdegenATA: anchor.web3.PublicKey;

  let admin: Keypair;
  let trader1: Keypair;
  let trader2: Keypair;

  let adminXdegenATA: anchor.web3.PublicKey;
  let trader1XdegenAta: anchor.web3.PublicKey;
  let trader2XdegenAta: anchor.web3.PublicKey;

  const KEYPAIRS_DIR = path.join(__dirname, "../keypairs");

  const newMint = anchor.web3.Keypair.generate();

  async function airdrop(wallet: PublicKey) {
    const balance = await provider.connection.getBalance(wallet);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;

    if (balanceInSOL < 1) {
      console.log('balance is low, requesting airdrop...');
      try {
        const airdropSignature = await provider.connection.requestAirdrop(
          wallet,
          10 * anchor.web3.LAMPORTS_PER_SOL
        );

        const latestBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          signature: airdropSignature,
          ...latestBlockhash
        });

        const newBalance = await provider.connection.getBalance(wallet);
        console.log(`new balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
      } catch (error) {
        console.error('Airdrop error:', error);
      }
    } else {
      console.log('balance is sufficient, no airdrop needed.');
    }
  }

  function loadOrCreateKeypair(filename: string): Keypair {
    const keypairPath = path.join(KEYPAIRS_DIR, filename);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(KEYPAIRS_DIR)) {
      fs.mkdirSync(KEYPAIRS_DIR, { recursive: true });
    }

    // Load existing keypair
    if (fs.existsSync(keypairPath)) {
      const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
      console.log(`✓ Loaded ${filename}`);
      return Keypair.fromSecretKey(Uint8Array.from(secretKey));
    }
    
    // Create new keypair
    const keypair = Keypair.generate();
    fs.writeFileSync(
      keypairPath,
      JSON.stringify(Array.from(keypair.secretKey))
    );
    console.log(`✓ Created ${filename}`);
    return keypair;
  }

  // Load or create xDegen mint keypair
  function loadOrCreateXdegenMint(): Keypair {
    const filename = "xdegen-mint.json";
    return loadOrCreateKeypair(filename);
  }

  // Save xDegen mint public key for reference
  function saveXdegenMintAddress(mintAddress: PublicKey) {
    const configPath = path.join(KEYPAIRS_DIR, "xdegen-mint-address.txt");
    fs.writeFileSync(configPath, mintAddress.toString());
    console.log(`✓ Saved xDegen mint address: ${mintAddress.toString()}`);
  }

  function getConfigPDA() {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    )[0];
  }

  function getVaultPDA() {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        xdegenMint.toBuffer()
      ],
      program.programId
    )[0]
  }

  function getTokenRecordPDA(mint, trader) {
    const [tokenRecordPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_record"),
        trader.toBuffer(),
        mint.toBuffer()
      ],
      program.programId
    )
    return tokenRecordPDA
  }

  before(async () => {
    console.log("\n========================================");
    console.log("         SETUP & INITIALIZATION         ");
    console.log("========================================\n");

    // Load or create keypairs
    console.log("--- Loading Keypairs ---");
    admin = loadOrCreateKeypair('admin.json');
    trader1 = loadOrCreateKeypair('trader1.json');
    trader2 = loadOrCreateKeypair('trader2.json');
    
    console.log("Admin:", admin.publicKey.toString());
    console.log("Trader 1:", trader1.publicKey.toString());
    console.log("Trader 2:", trader2.publicKey.toString());
    console.log();

    // Airdrop SOL to admin and traders
    console.log("--- Airdropping SOL ---");
    await airdrop(admin.publicKey);
    await airdrop(trader1.publicKey);
    await airdrop(trader2.publicKey);

    // Load or create xDegen mint
    console.log("--- Setting up xDegen Mint ---");
    const xdegenMintKeypair = loadOrCreateXdegenMint();
    
    // Check if mint already exists
    try {
      const mintInfo = await connection.getAccountInfo(xdegenMintKeypair.publicKey);
      if (mintInfo) {
        console.log("✓ xDegen mint already exists");
        xdegenMint = xdegenMintKeypair.publicKey;
      } else {
        throw new Error("Mint not found, creating new one");
      }
    } catch (error) {
      console.log("Creating new xDegen mint...");
      xdegenMint = await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        null,
        9,
        xdegenMintKeypair
      );
      saveXdegenMintAddress(xdegenMint);
      console.log("✓ Created xDegen mint");
    }
    
    console.log("xDegen Mint:", xdegenMint.toString());
    console.log();

    // Create or get associated token accounts
    console.log("--- Setting up Token Accounts ---");
    
    try {
      walletXdegenATA = await getAssociatedTokenAddress(
        xdegenMint,
        wallet.publicKey
      );
      
      const walletAtaInfo = await connection.getAccountInfo(walletXdegenATA);
      if (!walletAtaInfo) {
        console.log("Creating wallet xDegen ATA...");
        walletXdegenATA = await createAssociatedTokenAccount(
          connection,
          wallet.payer,
          xdegenMint,
          wallet.publicKey
        );
      }
      console.log("✓ Wallet xDegen ATA:", walletXdegenATA.toString());
    } catch (error) {
      console.error("Error setting up wallet ATA:", error);
    }

    try {
      adminXdegenATA = await getAssociatedTokenAddress(
        xdegenMint,
        admin.publicKey
      );
      
      const adminAtaInfo = await connection.getAccountInfo(adminXdegenATA);
      if (!adminAtaInfo) {
        console.log("Creating admin xDegen ATA...");
        adminXdegenATA = await createAssociatedTokenAccount(
          connection,
          admin,
          xdegenMint,
          admin.publicKey
        );
      }
      console.log("✓ Admin xDegen ATA:", adminXdegenATA.toString());
    } catch (error) {
      console.error("Error setting up admin ATA:", error);
    }

    try {
      trader1XdegenAta = await getAssociatedTokenAddress(
        xdegenMint,
        trader1.publicKey
      );
      
      const trader1AtaInfo = await connection.getAccountInfo(trader1XdegenAta);
      if (!trader1AtaInfo) {
        console.log("Creating trader1 xDegen ATA...");
        trader1XdegenAta = await createAssociatedTokenAccount(
          connection,
          trader1,
          xdegenMint,
          trader1.publicKey
        );
      }
      console.log("✓ Trader 1 xDegen ATA:", trader1XdegenAta.toString());
    } catch (error) {
      console.error("Error setting up trader1 ATA:", error);
    }

    try {
      trader2XdegenAta = await getAssociatedTokenAddress(
        xdegenMint,
        trader2.publicKey
      );
      
      const trader2AtaInfo = await connection.getAccountInfo(trader2XdegenAta);
      if (!trader2AtaInfo) {
        console.log("Creating trader2 xDegen ATA...");
        trader2XdegenAta = await createAssociatedTokenAccount(
          connection,
          trader2,
          xdegenMint,
          trader2.publicKey
        );
      }
      console.log("✓ Trader 2 xDegen ATA:", trader2XdegenAta.toString());
    } catch (error) {
      console.error("Error setting up trader2 ATA:", error);
    }
    console.log();

    // Mint xDegen tokens to accounts if needed
    console.log("--- Minting xDegen Tokens ---");
    
    try {
      const walletBalance = await getAccount(connection, walletXdegenATA);
      if (walletBalance.amount < BigInt(100_000_000_000)) {
        console.log("Minting xDegen to wallet...");
        await mintTo(
          connection,
          wallet.payer,
          xdegenMint,
          walletXdegenATA,
          wallet.payer,
          500_000_000_000
        );
      }
      const walletBalanceAfter = await getAccount(connection, walletXdegenATA);
      console.log(`✓ Wallet xDegen balance: ${walletBalanceAfter.amount}`);
    } catch (error) {
      console.error("Error minting to wallet:", error);
    }

    try {
      const adminBalance = await getAccount(connection, adminXdegenATA);
      if (adminBalance.amount < BigInt(10_000_000_000)) {
        console.log("Minting xDegen to admin...");
        await mintTo(
          connection,
          admin,
          xdegenMint,
          adminXdegenATA,
          wallet.payer,
          5000_000_000_000
        );
      }
      const adminBalanceAfter = await getAccount(connection, adminXdegenATA);
      console.log(`✓ Admin xDegen balance: ${adminBalanceAfter.amount}`);
    } catch (error) {
      console.error("Error minting to admin:", error);
    }

    try {
      const trader1Balance = await getAccount(connection, trader1XdegenAta);
      if (trader1Balance.amount < BigInt(10_000_000_000)) {
        console.log("Minting xDegen to trader1...");
        await mintTo(
          connection,
          trader1,
          xdegenMint,
          trader1XdegenAta,
          wallet.payer,
          50_000_000_000
        );
      }
      const trader1BalanceAfter = await getAccount(connection, trader1XdegenAta);
      console.log(`✓ Trader 1 xDegen balance: ${trader1BalanceAfter.amount}`);
    } catch (error) {
      console.error("Error minting to trader1:", error);
    }

    try {
      const trader2Balance = await getAccount(connection, trader2XdegenAta);
      if (trader2Balance.amount < BigInt(10_000_000_000)) {
        console.log("Minting xDegen to trader2...");
        await mintTo(
          connection,
          trader2,
          xdegenMint,
          trader2XdegenAta,
          wallet.payer,
          50_000_000_000
        );
      }
      const trader2BalanceAfter = await getAccount(connection, trader2XdegenAta);
      console.log(`✓ Trader 2 xDegen balance: ${trader2BalanceAfter.amount}`);
    } catch (error) {
      console.error("Error minting to trader2:", error);
    }

    console.log();
    console.log("========================================");
    console.log("       SETUP COMPLETE - READY!          ");
    console.log("========================================\n");
  })

  describe("Initialize", () => {
    it("should initialize successfully", async () => {
      await program.methods.initialize().accountsPartial({
        admin: admin.publicKey,
        config: getConfigPDA(),
        xdegenMint,
        vault: getVaultPDA(),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([admin]).rpc();

      const configAccount = await program.account.config.fetch(getConfigPDA());
      expect(configAccount.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(configAccount.xdegenMint.toBase58()).to.equal(xdegenMint.toBase58());
      expect(configAccount.totalTrades.toNumber()).to.equal(0);
      expect(configAccount.totalBuys.toNumber()).to.equal(0);
      expect(configAccount.totalSells.toNumber()).to.equal(0);
      expect(configAccount.totalClaimed.toNumber()).to.equal(0);
    });
  });

  describe("Deposit", () => {
    it("should deposit successfully", async () => {
      const amount = 100_000_000_000;
      const vaultBefore = await getAccount(connection, getVaultPDA());
      const adminBefore = await getAccount(connection, adminXdegenATA);

      await program.methods.deposit(new anchor.BN(amount)).accountsPartial({
        admin: admin.publicKey,
        config: getConfigPDA(),
        adminTokenAccount: adminXdegenATA,
        mint: xdegenMint,
        vault: getVaultPDA(),
        tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([admin]).rpc();

      const vaultAfter = await getAccount(connection, getVaultPDA());
      const adminAfter = await getAccount(connection, adminXdegenATA);

      expect(vaultAfter.amount - vaultBefore.amount).to.equal(BigInt(amount));
      expect(adminBefore.amount - adminAfter.amount).to.equal(BigInt(amount));
    });

    it("should fail with invalid amount", async () => {
      try {
        await program.methods.deposit(new anchor.BN(0)).accountsPartial({
          admin: admin.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: walletXdegenATA,
          mint: xdegenMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([admin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Invalid amount");
      }
    });

    it("should fail with insufficient funds", async () => {
      const amount = 700_000_000_000; // more than available
      try {
        await program.methods.deposit(new anchor.BN(amount)).accountsPartial({
          admin: admin.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: adminXdegenATA,
          mint: xdegenMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([admin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Insufficient funds");
      }
    });

    it("should fail with wrong mint", async () => {
      const wrongMint = await createMint(
        connection,
        wallet.payer,
        wallet.publicKey,
        null,
        9
      );
      try {
        await program.methods.deposit(new anchor.BN(1_000_000_000)).accountsPartial({
          admin: admin.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: adminXdegenATA,
          mint: wrongMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([admin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message)
      }
    });

    it("should fail with unauthorized", async () => {
      const wrongAdmin = Keypair.generate();
      try {
        await program.methods.deposit(new anchor.BN(1_000_000_000)).accountsPartial({
          admin: wrongAdmin.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: adminXdegenATA,
          mint: xdegenMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([wrongAdmin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Withdraw", () => {
    it("should withdraw successfully", async () => {
      const amount = 1_000_000_000;
      const vaultBefore = await getAccount(anchor.getProvider().connection, getVaultPDA());
      const adminBefore = await getAccount(anchor.getProvider().connection, adminXdegenATA);

      await program.methods.withdraw(new anchor.BN(amount)).accountsPartial({
        admin: admin.publicKey,
        config: getConfigPDA(),
        xdegenMint,
        vault: getVaultPDA(),
        adminXdegenAta: adminXdegenATA,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([admin]).rpc();

      const vaultAfter = await getAccount(anchor.getProvider().connection, getVaultPDA());
      const adminAfter = await getAccount(anchor.getProvider().connection, adminXdegenATA);

      expect(vaultBefore.amount - vaultAfter.amount).to.equal(BigInt(amount));
      expect(adminAfter.amount - adminBefore.amount).to.equal(BigInt(amount));
    });

    it("should fail with invalid amount", async () => {
      try {
        await program.methods.withdraw(new anchor.BN(0)).accountsPartial({
          admin: admin.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          adminXdegenAta: adminXdegenATA,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([admin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Invalid amount");
      }
    });

    it("should fail with insufficient funds in vault", async () => {
      const amount = 100_000_000_000;
      try {
        await program.methods.withdraw(new anchor.BN(amount)).accountsPartial({
          admin: admin.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          adminXdegenAta: adminXdegenATA,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([admin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Insufficient funds");
      }
    });

    it("should fail with unauthorized", async () => {
      const wrongAdmin = Keypair.generate();
      try {
        await program.methods.withdraw(new anchor.BN(1_000_000_000)).accountsPartial({
          admin: wrongAdmin.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          adminXdegenAta: adminXdegenATA,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([wrongAdmin]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Buy", () => {
    it("should buy successfully", async () => {
      const tokenParams = {
        name: "Test Token",
        symbol: "TT",
        decimals: 9,
        uri: "https://example.com",
        supply: new anchor.BN(1_000_000_000),
      };
      const amount = 500_000_000;
      const traderMintAta = await getAssociatedTokenAddress(
        newMint.publicKey,
        trader1.publicKey
      );

      const metadata = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      )[0];

      const configPDA = getConfigPDA();
      let tx = await program.methods.buy(tokenParams, new anchor.BN(amount)).accountsPartial({
        sessionToken: null,
        trader: trader1.publicKey,
        config: configPDA,
        mint: newMint.publicKey,
        traderMintAta: traderMintAta,
        metadata: metadata,
        xdegenMint: xdegenMint,
        vault: getVaultPDA(),
        traderXdegenAta: trader1XdegenAta,
        tokenRecord: getTokenRecordPDA(newMint.publicKey, trader1.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenMetadataProgram: METADATA_PROGRAM_ID,
      }).signers([trader1, newMint]).rpc();

      console.log('signature', tx);

      const config = await program.account.config.fetch(getConfigPDA());
      expect(config.totalTrades.toNumber()).to.equal(1);
      expect(config.totalBuys.toNumber()).to.equal(1);

      const traderMintAccount = await getAccount(anchor.getProvider().connection, traderMintAta);
      expect(traderMintAccount.amount).to.equal(BigInt(tokenParams.supply.toString()));
    });

    it("should fail with empty name", async () => {
      const tokenParams = {
        name: "",
        symbol: "TT",
        decimals: 9,
        uri: "https://example.com",
        supply: new anchor.BN(1_000_000_000),
      };
      const amount = 500_000_000;
      const newMint = Keypair.generate();
      try {
        const metadata = PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint.publicKey.toBuffer()],
            METADATA_PROGRAM_ID
          )[0]
        await program.methods.buy(tokenParams, new anchor.BN(amount)).accountsPartial({
          trader: trader1.publicKey,
          config: getConfigPDA(),
          mint: newMint.publicKey,
          traderMintAta: await getAssociatedTokenAddress(newMint.publicKey, trader1.publicKey),
          metadata: metadata,
          xdegenMint,
          vault: getVaultPDA(),
          traderXdegenAta: trader1XdegenAta,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1, newMint]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message);
      }
    });

    it("should allow trader to buy multiple different tokens", async () => {
      // First token purchase
      const tokenParams1 = {
        name: "First Token",
        symbol: "FT",
        decimals: 9,
        uri: "https://example.com/first",
        supply: new anchor.BN(1_000_000_000),
      };
      const amount1 = 500_000_000;
      const newMint1 = anchor.web3.Keypair.generate();
      const traderMintAta1 = await getAssociatedTokenAddress(
        newMint1.publicKey,
        trader1.publicKey
      );

      const metadata1 = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint1.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      )[0];

      await program.methods.buy(tokenParams1, new anchor.BN(amount1)).accountsPartial({
        sessionToken: null,
        trader: trader1.publicKey,
        config: getConfigPDA(),
        mint: newMint1.publicKey,
        traderMintAta: traderMintAta1,
        metadata: metadata1,
        xdegenMint,
        tokenRecord: getTokenRecordPDA(newMint1.publicKey, trader1.publicKey),
        vault: getVaultPDA(),
        traderXdegenAta: trader1XdegenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader1, newMint1]).rpc();

      // Second token purchase
      const tokenParams2 = {
        name: "Second Token",
        symbol: "ST",
        decimals: 9,
        uri: "https://example.com/second",
        supply: new anchor.BN(2_000_000_000),
      };

      const amount = 1_000_000_000;
      const newMint2 = anchor.web3.Keypair.generate();
      const traderMintAta2 = await getAssociatedTokenAddress(
        newMint2.publicKey,
        trader1.publicKey
      );

      const metadata2 = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint2.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      )[0];

      await program.methods.buy(tokenParams2, new anchor.BN(amount)).accountsPartial({
        sessionToken: null,
        trader: trader1.publicKey,
        config: getConfigPDA(),
        mint: newMint2.publicKey,
        traderMintAta: traderMintAta2,
        tokenRecord: getTokenRecordPDA(newMint2.publicKey, trader1.publicKey),
        metadata: metadata2,
        xdegenMint,
        vault: getVaultPDA(),
        traderXdegenAta: trader1XdegenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader1, newMint2]).rpc();

      // Verify both tokens have different mint addresses
      expect(newMint1.publicKey.toBase58()).to.not.equal(newMint2.publicKey.toBase58());

      // Verify trader received both tokens
      const traderMintAccount1 = await getAccount(anchor.getProvider().connection, traderMintAta1);
      const traderMintAccount2 = await getAccount(anchor.getProvider().connection, traderMintAta2);

      expect(traderMintAccount1.amount).to.equal(BigInt(tokenParams1.supply.toString()));
      expect(traderMintAccount2.amount).to.equal(BigInt(tokenParams2.supply.toString()));

      // Verify config was updated correctly
      const configAfter = await program.account.config.fetch(getConfigPDA());
      expect(configAfter.totalTrades.toNumber()).to.equal(3);
      expect(configAfter.totalBuys.toNumber()).to.equal(3);
    });
  });

  describe("Claim", () => {
    it("should claim successfully", async () => {
      const configBefore = await program.account.config.fetch(getConfigPDA());

      await program.methods.claim().accountsPartial({
        sessionToken: null,
        claimer: trader1.publicKey,
        config: getConfigPDA(),
        xdegenMint,
        vault: getVaultPDA(),
        claimerXdegenAta: trader1XdegenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader1]).rpc();

      const configAfter = await program.account.config.fetch(getConfigPDA());

      expect(configAfter.totalClaimed.toNumber()).to.eq(configBefore.claimAmount.toNumber());
    });

    it("should fail with insufficient funds in vault", async () => {
      const amount = 1000_000_000_000; // more than available in vault
      try {
        await program.methods.claim().accountsPartial({
          sessionToken: null,
          claimer: trader1.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          claimerXdegenAta: trader1XdegenAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message);
      }
    });
  });

  describe("MintToken", () => {
    it("should mint token successfully", async () => {
      const buyAmount = 1_000_000_000; // allowed amount
      const mintAmount = 500_000_000;
      const configBefore = await program.account.config.fetch(getConfigPDA());
      const vaultBefore = await getAccount(anchor.getProvider().connection, getVaultPDA());
      const traderMintAta = await getAssociatedTokenAddress(
        newMint.publicKey,
        trader1.publicKey
      );

      if (!connection.getAccountInfo(traderMintAta)) {
        console.log('Token Account not found');
        return
      }

      const buyerMintBefore = await getAccount(anchor.getProvider().connection, traderMintAta);

      await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
        sessionToken: null,
        trader: trader1.publicKey,
        config: getConfigPDA(),
        mint: newMint.publicKey,
        xdegenMint,
        vault: getVaultPDA(),
        traderXdegenAta: trader1XdegenAta,
        traderMintAta: traderMintAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader1]).rpc();

      const configAfter = await program.account.config.fetch(getConfigPDA());
      const vaultAfter = await getAccount(anchor.getProvider().connection, getVaultPDA());
      const buyerMintAfter = await getAccount(anchor.getProvider().connection, traderMintAta);

      expect(configAfter.totalTrades.toNumber()).to.equal(configBefore.totalTrades.toNumber() + 1);
      expect(configAfter.totalBuys.toNumber()).to.equal(configBefore.totalBuys.toNumber() + 1);
      expect(vaultAfter.amount - vaultBefore.amount).to.equal(BigInt(buyAmount));
      expect(buyerMintAfter.amount - buyerMintBefore.amount).to.equal(BigInt(mintAmount));
    });

    it("should fail with invalid buy amount", async () => {
      const buyAmount = 123_456_789; // not in allowed amounts
      const mintAmount = 500_000_000;
      try {
        const traderMintAta = await getAssociatedTokenAddress(
          newMint.publicKey,
          trader1.publicKey
        );

        if (!connection.getAccountInfo(traderMintAta)) {
          console.log('Token Account not found');
          return
        }

        await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
          sessionToken: null,
          trader: trader1.publicKey,
          config: getConfigPDA(),
          mint: newMint.publicKey,
          xdegenMint,
          vault: getVaultPDA(),
          traderXdegenAta: trader1XdegenAta,
          traderMintAta: traderMintAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        console.log(error)
      }
    });

    it("should fail with invalid mint amount", async () => {
      const buyAmount = 1_000_000_000; // allowed amount
      const mintAmount = 0;
      try {
        const traderMintAta = await getAssociatedTokenAddress(
          newMint.publicKey,
          trader1.publicKey
        );

        if (!connection.getAccountInfo(traderMintAta)) {
          console.log('Token Account not found');
          return
        }

        await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
          sessionToken: null,
          trader: trader1.publicKey,
          config: getConfigPDA(),
          mint: newMint.publicKey,
          xdegenMint,
          vault: getVaultPDA(),
          traderXdegenAta: trader1XdegenAta,
          traderMintAta: traderMintAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        console.log(error.message);
      }
    });

    it("should fail with insufficient xdegen funds", async () => {
      // Use up buyer's XDEGEN tokens first
      const buyAmount = 5_000_000_000;
      const mintAmount = 500_000_000;

      // This should fail because buyer doesn't have enough XDEGEN tokens
      try {
        const traderMintAta = await getAssociatedTokenAddress(
          newMint.publicKey,
          trader1.publicKey
        );

        if (!connection.getAccountInfo(traderMintAta)) {
          console.log('Token Account not found');
          return
        }

        await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
          sessionToken: null,
          trader: trader1.publicKey,
          config: getConfigPDA(),
          mint: newMint.publicKey,
          xdegenMint,
          vault: getVaultPDA(),
          traderXdegenAta: traderXdegenAta,
          traderMintAta: traderMintAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message);
      }
    });
  });

  describe("Sell", () => {
    it("should sell successfully", async () => {
      const sellAmount = 500_000_000;
      const burnAmount = 500_000_000;
      const configBefore = await program.account.config.fetch(getConfigPDA());

      const traderMintAta = await getAssociatedTokenAddress(
        newMint.publicKey,
        trader1.publicKey
      );

      if (!connection.getAccountInfo(traderMintAta)) {
        console.log('Token Account not found');
        return
      }
      const traderTokenBefore = await getAccount(anchor.getProvider().connection, traderMintAta);

      await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
        sessionToken: null,
        trader: trader1.publicKey,
        config: getConfigPDA(),
        vault: getVaultPDA(),
        mint: newMint.publicKey,
        traderMint: traderMintAta,
        xdegenMint,
        traderXdegenAta,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader1]).rpc();

      const configAfter = await program.account.config.fetch(getConfigPDA());
      expect(configAfter.totalTrades.toNumber()).to.equal(configBefore.totalTrades.toNumber() + 1);
      expect(configAfter.totalSells.toNumber()).to.equal(configBefore.totalSells.toNumber() + 1);

      const traderTokenAfter = await getAccount(anchor.getProvider().connection, traderMintAta);
      expect(traderTokenBefore.amount - traderTokenAfter.amount).to.equal(BigInt(burnAmount));
    });

    it("should fail with invalid sell amount", async () => {
      const sellAmount = 123_456_789; // not allowed
      const burnAmount = 500_000_000;
      try {
        const traderMintAta = await getAssociatedTokenAddress(
          newMint.publicKey,
          trader1.publicKey
        );

        if (!connection.getAccountInfo(traderMintAta)) {
          console.log('Token Account not found');
          return
        }
        await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
          sessionToken: null,
          trader: trader1.publicKey,
          config: getConfigPDA(),
          vault: getVaultPDA(),
          mint: newMint.publicKey,
          traderMint: traderMintAta,
          xdegenMint,
          traderXdegenAta: trader1XdegenAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();

        expect.fail("Should have failed");
      } catch (error) {
        console.log(error.message);
      }
    });

    it("should fail with invalid burn amount", async () => {
      const sellAmount = 500_000_000;
      const burnAmount = 0;
      try {
        const traderMintAta = await getAssociatedTokenAddress(
          newMint.publicKey,
          trader1.publicKey
        );

        if (!connection.getAccountInfo(traderMintAta)) {
          console.log('Token Account not found');
          return
        }
        await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
          sessionToken: null,
          trader: trader1.publicKey,
          config: getConfigPDA(),
          vault: getVaultPDA(),
          mint: newMint.publicKey,
          traderMint: traderMintAta,
          xdegenMint,
          traderXdegenAta: trader1XdegenAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        console.log(error.message);
      }
    });

    it("should fail with insufficient xdegen funds", async () => {
      const sellAmount = 50_000_000_000; // more than trader has
      const burnAmount = 500_000_000;
      try {
        const traderMintAta = await getAssociatedTokenAddress(
          newMint.publicKey,
          trader1.publicKey
        );

        if (!connection.getAccountInfo(traderMintAta)) {
          console.log('Token Account not found');
          return
        }
        await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
          sessionToken: null,
          trader: trader1.publicKey,
          config: getConfigPDA(),
          vault: getVaultPDA(),
          mint: newMint.publicKey,
          traderMint: traderMintAta,
          xdegenMint,
          traderXdegenAta: trader1XdegenAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader1]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        console.log(error.message);
      }
    });
  });
})
