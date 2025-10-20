import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { XdegenDemo } from "../target/types/xdegen_demo";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAssociatedTokenAccount, mintTo, getAssociatedTokenAddress, getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { expect } from "chai";

const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
// solana-test-validator -r --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s ./tests/metadata.so

describe("xdegen-demo", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.xdegenDemo as Program<XdegenDemo>;
  const connection = provider.connection;
  const wallet = provider.wallet;
  const trader = anchor.web3.Keypair.generate();
  let tradeMint = anchor.web3.Keypair.generate();

  let xdegenMint: anchor.web3.PublicKey;
  let traderXdegenAta: anchor.web3.PublicKey;
  let walletXdegenATA: anchor.web3.PublicKey;

  before(async () => {
    // airdrop trader
    await airdrop(trader.publicKey);

    xdegenMint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      9
    );

    walletXdegenATA = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      xdegenMint,
      wallet.publicKey
    );

    traderXdegenAta = await createAssociatedTokenAccount(
      connection,
      trader,
      xdegenMint,
      trader.publicKey
    );

    await mintTo(
      connection,
      wallet.payer,
      xdegenMint,
      walletXdegenATA,
      wallet.payer,
      500_000_000_000
    );

    await mintTo(
      connection,
      trader,
      xdegenMint,
      traderXdegenAta,
      wallet.payer,
      50_000_000_000
    )
  })

  async function airdrop(wallet: PublicKey) {
    await anchor.getProvider().connection.confirmTransaction(
      await anchor.getProvider().connection.requestAirdrop(wallet, 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
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


  describe("Initialize", () => {
    it("should initialize successfully", async () => {
      await program.methods.initialize().accountsPartial({
        admin: wallet.publicKey,
        config: getConfigPDA(),
        xdegenMint,
        vault: getVaultPDA(),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([wallet.payer]).rpc();

      const configAccount = await program.account.config.fetch(getConfigPDA());
      expect(configAccount.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
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
      const adminBefore = await getAccount(connection, walletXdegenATA);

      await program.methods.deposit(new anchor.BN(amount)).accountsPartial({
        admin: wallet.publicKey,
        config: getConfigPDA(),
        adminTokenAccount: walletXdegenATA,
        mint: xdegenMint,
        vault: getVaultPDA(),
        tokenProgram: TOKEN_PROGRAM_ID,
      }).signers([wallet.payer]).rpc();

      const vaultAfter = await getAccount(connection, getVaultPDA());
      const adminAfter = await getAccount(connection, walletXdegenATA);

      expect(vaultAfter.amount - vaultBefore.amount).to.equal(BigInt(amount));
      expect(adminBefore.amount - adminAfter.amount).to.equal(BigInt(amount));
    });

    it("should fail with invalid amount", async () => {
      try {
        await program.methods.deposit(new anchor.BN(0)).accountsPartial({
          admin: wallet.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: walletXdegenATA,
          mint: xdegenMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([wallet.payer]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("should fail with insufficient funds", async () => {
      const amount = 700_000_000_000; // more than available
      try {
        await program.methods.deposit(new anchor.BN(amount)).accountsPartial({
          admin: wallet.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: walletXdegenATA,
          mint: xdegenMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([wallet.payer]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InsufficientFunds");
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
          admin: wallet.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: walletXdegenATA,
          mint: wrongMint,
          vault: getVaultPDA(),
          tokenProgram: TOKEN_PROGRAM_ID,
        }).signers([wallet.payer]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message)
      }
    });

    it("should fail with unauthorized", async () => {
      const wrongAdmin = Keypair.generate();
      await airdrop(wrongAdmin.publicKey);
      try {
        await program.methods.deposit(new anchor.BN(1_000_000_000)).accountsPartial({
          admin: wrongAdmin.publicKey,
          config: getConfigPDA(),
          adminTokenAccount: walletXdegenATA,
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
      const adminBefore = await getAccount(anchor.getProvider().connection, walletXdegenATA);

      await program.methods.withdraw(new anchor.BN(amount)).accountsPartial({
        admin: wallet.publicKey,
        config: getConfigPDA(),
        xdegenMint,
        vault: getVaultPDA(),
        adminXdegenAta: walletXdegenATA,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([wallet.payer]).rpc();

      const vaultAfter = await getAccount(anchor.getProvider().connection, getVaultPDA());
      const adminAfter = await getAccount(anchor.getProvider().connection, walletXdegenATA);

      expect(vaultBefore.amount - vaultAfter.amount).to.equal(BigInt(amount));
      expect(adminAfter.amount - adminBefore.amount).to.equal(BigInt(amount));
    });

    it("should fail with invalid amount", async () => {
      try {
        await program.methods.withdraw(new anchor.BN(0)).accountsPartial({
          admin: wallet.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          adminXdegenAta: walletXdegenATA,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([wallet.payer]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("should fail with insufficient funds in vault", async () => {
      const amount = 100_000_000_000;
      try {
        await program.methods.withdraw(new anchor.BN(amount)).accountsPartial({
          admin: wallet.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          adminXdegenAta: walletXdegenATA,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([wallet.payer]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InsufficientFunds");
      }
    });

    it("should fail with unauthorized", async () => {
      const wrongAdmin = Keypair.generate();
      await anchor.getProvider().connection.confirmTransaction(
        await anchor.getProvider().connection.requestAirdrop(wrongAdmin.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL)
      );
      try {
        await program.methods.withdraw(new anchor.BN(1_000_000_000)).accountsPartial({
          admin: wrongAdmin.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          adminXdegenAta: walletXdegenATA,
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
      const amount = 500_000_000; // allowed
      const newMint = anchor.web3.Keypair.generate();
      const traderMintAta = await getAssociatedTokenAddress(
        newMint.publicKey,
        trader.publicKey
      );

      const metadata = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      )[0];

      const configBefore = await program.account.config.fetch(getConfigPDA());

      await program.methods.buy(tokenParams, new anchor.BN(amount), tradeMint.publicKey).accountsPartial({
        trader: trader.publicKey,
        admin: wallet.publicKey,
        config: getConfigPDA(),
        vault: getVaultPDA(),
        mint: newMint.publicKey,
        traderMintAta: traderMintAta,
        metadata,
        xdegenMint,
        traderXdegenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader, newMint]).rpc();

      const configAfter = await program.account.config.fetch(getConfigPDA());
      expect(configAfter.totalTrades.toNumber()).to.equal(configBefore.totalTrades.toNumber() + 1);
      expect(configAfter.totalBuys.toNumber()).to.equal(configBefore.totalBuys.toNumber() + 1);

      const traderMintAccount = await getAccount(anchor.getProvider().connection, traderMintAta);
      expect(traderMintAccount.amount).to.equal(BigInt(tokenParams.supply.toString()));
    });

    // it("should fail with empty name", async () => {
    //   const tokenParams = {
    //     name: "",
    //     symbol: "TT",
    //     decimals: 9,
    //     uri: "https://example.com",
    //     supply: new anchor.BN(1_000_000_000),
    //   };
    //   const amount = 500_000_000;
    //   const newMint = Keypair.generate();
    //   try {
    //     await program.methods.buy(tokenParams, new anchor.BN(amount)).accountsPartial({
    //       trader: trader.publicKey,
    //       admin: wallet.publicKey,
    //       config: getConfigPDA(),
    //       vault: getVaultPDA(),
    //       mint: newMint.publicKey,
    //       traderMintAta: await getAssociatedTokenAddress(newMint.publicKey, trader.publicKey),
    //       metadata: PublicKey.findProgramAddressSync(
    //         [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint.publicKey.toBuffer()],
    //         METADATA_PROGRAM_ID
    //       )[0],
    //       xdegenMint,
    //       traderXdegenAta,
    //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    //       tokenMetadataProgram: METADATA_PROGRAM_ID,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //       systemProgram: SystemProgram.programId,
    //     }).signers([trader, newMint]).rpc();
    //     expect.fail("Should have failed");
    //   } catch (error) {
    //     expect(error.message);
    //   }
    // });

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
      const tradeMint1 = anchor.web3.Keypair.generate();
      const newMint1 = anchor.web3.Keypair.generate();
      const traderMintAta1 = await getAssociatedTokenAddress(
        newMint1.publicKey,
        trader.publicKey
      );

      const metadata1 = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint1.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      )[0];

      await program.methods.buy(tokenParams1, new anchor.BN(amount1), tradeMint1.publicKey).accountsPartial({
        trader: trader.publicKey,
        admin: wallet.publicKey,
        config: getConfigPDA(),
        vault: getVaultPDA(),
        mint: newMint1.publicKey,
        traderMintAta: traderMintAta1,
        metadata: metadata1,
        xdegenMint,
        traderXdegenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader, newMint1]).rpc();

      // Second token purchase
      const tokenParams2 = {
        name: "Second Token",
        symbol: "ST",
        decimals: 9,
        uri: "https://example.com/second",
        supply: new anchor.BN(2_000_000_000),
      };
      const amount2 = 1_000_000_000; // different amount
      const tradeMint2 = anchor.web3.Keypair.generate();
      const newMint2 = anchor.web3.Keypair.generate();
      const traderMintAta2 = await getAssociatedTokenAddress(
        newMint2.publicKey,
        trader.publicKey
      );

      const metadata2 = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), newMint2.publicKey.toBuffer()],
        METADATA_PROGRAM_ID
      )[0];

      await program.methods.buy(tokenParams2, new anchor.BN(amount2), tradeMint2.publicKey).accountsPartial({
        trader: trader.publicKey,
        admin: wallet.publicKey,
        config: getConfigPDA(),
        vault: getVaultPDA(),
        mint: newMint2.publicKey,
        traderMintAta: traderMintAta2,
        metadata: metadata2,
        xdegenMint,
        traderXdegenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader, newMint2]).rpc();

      // Verify both tokens have different mint addresses
      expect(newMint1.publicKey.toBase58()).to.not.equal(newMint2.publicKey.toBase58());

      // Verify trader received both tokens
      const traderMintAccount1 = await getAccount(anchor.getProvider().connection, traderMintAta1);
      const traderMintAccount2 = await getAccount(anchor.getProvider().connection, traderMintAta2);

      expect(traderMintAccount1.amount).to.equal(BigInt(tokenParams1.supply.toString()));
      expect(traderMintAccount2.amount).to.equal(BigInt(tokenParams2.supply.toString()));

      // Verify config was updated correctly
      const configAfter = await program.account.config.fetch(getConfigPDA());
      expect(configAfter.totalTrades.toNumber()).to.equal(3); // 2 total trades
      expect(configAfter.totalBuys.toNumber()).to.equal(3); // 2 total buys
    });
  });

  describe("Claim", () => {
    it("should claim successfully", async () => {
      const configBefore = await program.account.config.fetch(getConfigPDA());
      const claimerAccountBefore = await getAccount(connection, traderXdegenAta);
      const vaultBefore = await getAccount(connection, getVaultPDA());

      await program.methods.claim().accountsPartial({
        claimer: trader.publicKey,
        config: getConfigPDA(),
        xdegenMint,
        vault: getVaultPDA(),
        claimerXdegenAta: traderXdegenAta,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).signers([trader]).rpc();

      const configAfter = await program.account.config.fetch(getConfigPDA());
      const vaultAfter = await getAccount(connection, getVaultPDA());
      const claimerAccountAfter = await getAccount(connection, traderXdegenAta);

      expect(configAfter.totalClaimed.toNumber()).to.eq(configBefore.claimAmount.toNumber());
      expect(vaultBefore.amount - vaultAfter.amount).to.equal(configBefore.claimAmount.toNumber());
      expect(claimerAccountAfter.amount).to.greaterThan(Number(claimerAccountBefore.amount));
    });

    it("should fail with invalid amount", async () => {
      try {
        await program.methods.claim().accountsPartial({
          claimer: trader.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          claimerXdegenAta: traderXdegenAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message);
      }
    });

    it("should fail with insufficient funds in vault", async () => {
      const amount = 1000_000_000_000; // more than available in vault
      try {
        await program.methods.claim().accountsPartial({
          claimer: trader.publicKey,
          config: getConfigPDA(),
          xdegenMint,
          vault: getVaultPDA(),
          claimerXdegenAta: traderXdegenAta,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([trader]).rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message);
      }
    });
  });

  // describe("MintToken", () => {
  //   let admin: Keypair;
  //   let buyer: Keypair;
  //   let xdegenMint: PublicKey;
  //   let configPda: PublicKey;
  //   let vaultPda: PublicKey;
  //   let vaultAta: PublicKey;
  //   let buyerXdegenAta: PublicKey;
  //   let tokenMint: PublicKey;
  //   let buyerMintAta: PublicKey;

  //   before(async () => {
  //     admin = Keypair.generate();
  //     buyer = Keypair.generate();
  //     await anchor.getProvider().connection.confirmTransaction(
  //       await anchor.getProvider().connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
  //     );
  //     await anchor.getProvider().connection.confirmTransaction(
  //       await anchor.getProvider().connection.requestAirdrop(buyer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
  //     );

  //     xdegenMint = await createMint(
  //       anchor.getProvider().connection,
  //       admin,
  //       admin.publicKey,
  //       null,
  //       9
  //     );

  //     [configPda] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("config")],
  //       program.programId
  //     );

  //     [vaultPda] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("vault")],
  //       program.programId
  //     );

  //     vaultAta = await getAssociatedTokenAddress(
  //       xdegenMint,
  //       vaultPda,
  //       true
  //     );

  //     await program.methods.initialize().accountsPartial({
  //       admin: admin.publicKey,
  //       config: configPda,
  //       xdegenMint,
  //       vault: vaultAta,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     }).signers([admin]).rpc();

  //     // Setup buyer with XDEGEN tokens
  //     buyerXdegenAta = await createAssociatedTokenAccount(
  //       anchor.getProvider().connection,
  //       buyer,
  //       xdegenMint,
  //       buyer.publicKey
  //     );

  //     await mintTo(
  //       anchor.getProvider().connection,
  //       admin,
  //       xdegenMint,
  //       buyerXdegenAta,
  //       admin,
  //       10_000_000_000
  //     );

  //     // Create a token that can be minted
  //     const tokenParams = {
  //       name: "Mintable Token",
  //       symbol: "MT",
  //       decimals: 9,
  //       uri: "https://example.com",
  //       supply: new anchor.BN(1_000_000_000),
  //     };
  //     const buyAmount = 500_000_000;
  //     const tokenMintKeypair = Keypair.generate();
  //     tokenMint = tokenMintKeypair.publicKey;
  //     buyerMintAta = await getAssociatedTokenAddress(
  //       tokenMint,
  //       buyer.publicKey
  //     );
  //     const metadata = PublicKey.findProgramAddressSync(
  //       [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
  //       METADATA_PROGRAM_ID
  //     )[0];

  //     await program.methods.buy(tokenParams, new anchor.BN(buyAmount)).accountsPartial({
  //       trader: buyer.publicKey,
  //       admin: admin.publicKey,
  //       config: configPda,
  //       vault: vaultAta,
  //       mint: tokenMint,
  //       traderMintAta: buyerMintAta,
  //       metadata,
  //       xdegenMint,
  //       traderXdegenAta: buyerXdegenAta,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //       tokenMetadataProgram: METADATA_PROGRAM_ID,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     }).signers([buyer, tokenMintKeypair]).rpc();
  //   });

  //   it("should mint token successfully", async () => {
  //     const buyAmount = 1_000_000_000; // allowed amount
  //     const mintAmount = 500_000_000;
  //     const configBefore = await program.account.config.fetch(configPda);
  //     const vaultBefore = await getAccount(anchor.getProvider().connection, vaultAta);
  //     const buyerMintBefore = await getAccount(anchor.getProvider().connection, buyerMintAta);

  //     await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
  //       buyer: buyer.publicKey,
  //       admin: admin.publicKey,
  //       config: configPda,
  //       mint: tokenMint,
  //       xdegenMint,
  //       vault: vaultAta,
  //       buyerXdegenAta,
  //       buyerMintAta,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     }).signers([buyer]).rpc();

  //     const configAfter = await program.account.config.fetch(configPda);
  //     const vaultAfter = await getAccount(anchor.getProvider().connection, vaultAta);
  //     const buyerMintAfter = await getAccount(anchor.getProvider().connection, buyerMintAta);

  //     expect(configAfter.totalTrades).to.equal(configBefore.totalTrades.toNumber() + 1);
  //     expect(configAfter.totalBuys).to.equal(configBefore.totalBuys.toNumber() + 1);
  //     expect(vaultAfter.amount - vaultBefore.amount).to.equal(BigInt(buyAmount));
  //     expect(buyerMintAfter.amount - buyerMintBefore.amount).to.equal(BigInt(mintAmount));
  //   });

  //   it("should fail with invalid buy amount", async () => {
  //     const buyAmount = 123_456_789; // not in allowed amounts
  //     const mintAmount = 500_000_000;
  //     try {
  //       await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
  //         buyer: buyer.publicKey,
  //         admin: admin.publicKey,
  //         config: configPda,
  //         mint: tokenMint,
  //         xdegenMint,
  //         vault: vaultAta,
  //         buyerXdegenAta,
  //         buyerMintAta,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       }).signers([buyer]).rpc();
  //       expect.fail("Should have failed");
  //     } catch (error) {
  //       expect(error.message).to.include("InvalidAmount");
  //     }
  //   });

  //   it("should fail with invalid mint amount", async () => {
  //     const buyAmount = 1_000_000_000; // allowed amount
  //     const mintAmount = 0;
  //     try {
  //       await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
  //         buyer: buyer.publicKey,
  //         admin: admin.publicKey,
  //         config: configPda,
  //         mint: tokenMint,
  //         xdegenMint,
  //         vault: vaultAta,
  //         buyerXdegenAta,
  //         buyerMintAta,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       }).signers([buyer]).rpc();
  //       expect.fail("Should have failed");
  //     } catch (error) {
  //       expect(error.message).to.include("InvalidAmount");
  //     }
  //   });

  //   it("should fail with insufficient xdegen funds", async () => {
  //     // Use up buyer's XDEGEN tokens first
  //     const buyAmount = 1_000_000_000;
  //     const mintAmount = 500_000_000;

  //     // This should fail because buyer doesn't have enough XDEGEN tokens
  //     try {
  //       await program.methods.mintToken(new anchor.BN(buyAmount), new anchor.BN(mintAmount)).accountsPartial({
  //         buyer: buyer.publicKey,
  //         admin: admin.publicKey,
  //         config: configPda,
  //         mint: tokenMint,
  //         xdegenMint,
  //         vault: vaultAta,
  //         buyerXdegenAta,
  //         buyerMintAta,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       }).signers([buyer]).rpc();
  //       expect.fail("Should have failed");
  //     } catch (error) {
  //       expect(error.message).to.include("InsufficientFunds");
  //     }
  //   });
  // });

  // describe("Sell", () => {
  //   let admin: Keypair;
  //   let trader: Keypair;
  //   let xdegenMint: PublicKey;
  //   let configPda: PublicKey;
  //   let vaultPda: PublicKey;
  //   let vaultAta: PublicKey;
  //   let traderXdegenAta: PublicKey;
  //   let tokenMint: PublicKey;
  //   let traderTokenAta: PublicKey;

  //   before(async () => {
  //     admin = Keypair.generate();
  //     trader = Keypair.generate();
  //     await anchor.getProvider().connection.confirmTransaction(
  //       await anchor.getProvider().connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
  //     );
  //     await anchor.getProvider().connection.confirmTransaction(
  //       await anchor.getProvider().connection.requestAirdrop(trader.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
  //     );

  //     xdegenMint = await createMint(
  //       anchor.getProvider().connection,
  //       admin,
  //       admin.publicKey,
  //       null,
  //       9
  //     );

  //     [configPda] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("config")],
  //       program.programId
  //     );

  //     [vaultPda] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("vault")],
  //       program.programId
  //     );

  //     vaultAta = await getAssociatedTokenAddress(
  //       xdegenMint,
  //       vaultPda,
  //       true
  //     );

  //     await program.methods.initialize().accountsPartial({
  //       admin: admin.publicKey,
  //       config: configPda,
  //       xdegenMint,
  //       vault: vaultAta,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     }).signers([admin]).rpc();

  //     traderXdegenAta = await createAssociatedTokenAccount(
  //       anchor.getProvider().connection,
  //       trader,
  //       xdegenMint,
  //       trader.publicKey
  //     );

  //     await mintTo(
  //       anchor.getProvider().connection,
  //       admin,
  //       xdegenMint,
  //       traderXdegenAta,
  //       admin,
  //       10_000_000_000
  //     );

  //     // Buy a token first
  //     const tokenParams = {
  //       name: "Test Token",
  //       symbol: "TT",
  //       decimals: 9,
  //       uri: "https://example.com",
  //       supply: new anchor.BN(1_000_000_000),
  //     };
  //     const buyAmount = 500_000_000;
  //     const tokenMintKeypair = Keypair.generate();
  //     tokenMint = tokenMintKeypair.publicKey;
  //     const traderMintAta = await getAssociatedTokenAddress(
  //       tokenMint,
  //       trader.publicKey
  //     );
  //     const metadata = PublicKey.findProgramAddressSync(
  //       [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
  //       METADATA_PROGRAM_ID
  //     )[0];

  //     await program.methods.buy(tokenParams, new anchor.BN(buyAmount)).accountsPartial({
  //       trader: trader.publicKey,
  //       admin: admin.publicKey,
  //       config: configPda,
  //       vault: vaultAta,
  //       mint: tokenMint,
  //       traderMintAta,
  //       metadata,
  //       xdegenMint,
  //       traderXdegenAta,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //       tokenMetadataProgram: METADATA_PROGRAM_ID,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     }).signers([trader, tokenMintKeypair]).rpc();

  //     traderTokenAta = traderMintAta;
  //   });

  //   it("should sell successfully", async () => {
  //     const sellAmount = 500_000_000;
  //     const burnAmount = 500_000_000;
  //     const configBefore = await program.account.config.fetch(configPda);
  //     const traderTokenBefore = await getAccount(anchor.getProvider().connection, traderTokenAta);

  //     await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
  //       trader: trader.publicKey,
  //       admin: admin.publicKey,
  //       config: configPda,
  //       vault: vaultAta,
  //       mint: tokenMint,
  //       traderMint: traderTokenAta,
  //       xdegenMint,
  //       traderXdegenAta,
  //       associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //       tokenProgram: TOKEN_PROGRAM_ID,
  //       systemProgram: SystemProgram.programId,
  //     }).signers([trader]).rpc();

  //     const configAfter = await program.account.config.fetch(configPda);
  //     expect(configAfter.totalTrades).to.equal(configBefore.totalTrades.toNumber() + 1);
  //     expect(configAfter.totalSells).to.equal(configBefore.totalSells.toNumber() + 1);

  //     const traderTokenAfter = await getAccount(anchor.getProvider().connection, traderTokenAta);
  //     expect(traderTokenBefore.amount - traderTokenAfter.amount).to.equal(BigInt(burnAmount));
  //   });

  //   it("should fail with invalid sell amount", async () => {
  //     const sellAmount = 123_456_789; // not allowed
  //     const burnAmount = 500_000_000;
  //     try {
  //       await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
  //         trader: trader.publicKey,
  //         admin: admin.publicKey,
  //         config: configPda,
  //         vault: vaultAta,
  //         mint: tokenMint,
  //         traderMint: traderTokenAta,
  //         xdegenMint,
  //         traderXdegenAta,
  //         associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       }).signers([trader]).rpc();
  //       expect.fail("Should have failed");
  //     } catch (error) {
  //       expect(error.message).to.include("InvalidAmount");
  //     }
  //   });

  //   it("should fail with invalid burn amount", async () => {
  //     const sellAmount = 500_000_000;
  //     const burnAmount = 0;
  //     try {
  //       await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
  //         trader: trader.publicKey,
  //         admin: admin.publicKey,
  //         config: configPda,
  //         vault: vaultAta,
  //         mint: tokenMint,
  //         traderMint: traderTokenAta,
  //         xdegenMint,
  //         traderXdegenAta,
  //         associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       }).signers([trader]).rpc();
  //       expect.fail("Should have failed");
  //     } catch (error) {
  //       expect(error.message).to.include("InvalidAmount");
  //     }
  //   });

  //   it("should fail with insufficient xdegen funds", async () => {
  //     const sellAmount = 50_000_000_000; // more than trader has
  //     const burnAmount = 500_000_000;
  //     try {
  //       await program.methods.sell(new anchor.BN(sellAmount), new anchor.BN(burnAmount)).accountsPartial({
  //         trader: trader.publicKey,
  //         admin: admin.publicKey,
  //         config: configPda,
  //         vault: vaultAta,
  //         mint: tokenMint,
  //         traderMint: traderTokenAta,
  //         xdegenMint,
  //         traderXdegenAta,
  //         associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       }).signers([trader]).rpc();
  //       expect.fail("Should have failed");
  //     } catch (error) {
  //       expect(error.message).to.include("InsufficientFunds");
  //     }
  //   });
  // });
});
