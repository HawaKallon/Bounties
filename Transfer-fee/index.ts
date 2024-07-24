import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAccount,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  getTransferFeeAmount,
  harvestWithheldTokensToMint,
  mintTo,
  transferCheckedWithFee,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
  withdrawWithheldTokensFromMint,
} from "@solana/spl-token";

// Connection to devnet cluster
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// Playground wallet
const payer = Keypair.generate();
console.log("Payer Public Key:", payer.publicKey.toBase58());

// Generate new keypair for Mint Account
const mintKeypair = Keypair.generate();
// Address for Mint Account
const mint = mintKeypair.publicKey;
// Decimals for Mint Account
const decimals = 2;
// Authority that can mint new tokens
const mintAuthority = payer.publicKey;
// Authority that can modify transfer fees
const transferFeeConfigAuthority = payer.publicKey;
// Authority that can move tokens withheld on mint or token accounts
const withdrawWithheldAuthority = payer.publicKey;

// Fee basis points for transfers (100 = 1%)
const feeBasisPoints = 100;
// Maximum fee for transfers in token base units
const maxFee = BigInt(100);

// Async function to handle all transactions
(async () => {
  try {
    // Fund the payer account (make sure to do this before running the script)
    console.log("Airdropping SOL to payer account...");
    const airdropSignature = await connection.requestAirdrop(
      payer.publicKey,
      2 * 1e9 // 2 SOL
    );
    await connection.confirmTransaction(airdropSignature);

    // Size of Mint Account with extensions
    const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
    // Minimum lamports required for Mint Account
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    // Instruction to invoke System Program to create new account
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
      newAccountPubkey: mint, // Address of the account to create
      space: mintLen, // Amount of bytes to allocate to the created account
      lamports, // Amount of lamports transferred to created account
      programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
    });

    // Instruction to initialize TransferFeeConfig Extension
    const initializeTransferFeeConfig = createInitializeTransferFeeConfigInstruction(
      mint, // Mint Account address
      transferFeeConfigAuthority, // Authority to update fees
      withdrawWithheldAuthority, // Authority to withdraw fees
      feeBasisPoints, // Basis points for transfer fee calculation
      maxFee, // Maximum fee per transfer
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    // Instruction to initialize Mint Account data
    const initializeMintInstruction = createInitializeMintInstruction(
      mint, // Mint Account Address
      decimals, // Decimals of Mint
      mintAuthority, // Designated Mint Authority
      null, // Optional Freeze Authority
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    // Add instructions to new transaction
    const transaction = new Transaction().add(
      createAccountInstruction,
      initializeTransferFeeConfig,
      initializeMintInstruction,
    );

    // Send transaction
    let transactionSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair], // Signers
    );

    console.log(
      "\nCreate Mint Account:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
    );

    // Create Token Account for Playground wallet
    const sourceTokenAccount = await createAccount(
      connection,
      payer, // Payer to create Token Account
      mint, // Mint Account address
      payer.publicKey, // Token Account owner
      undefined, // Optional keypair, default to Associated Token Account
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    // Random keypair to use as owner of Token Account
    const randomKeypair = Keypair.generate();
    // Create Token Account for random keypair
    const destinationTokenAccount = await createAccount(
      connection,
      payer, // Payer to create Token Account
      mint, // Mint Account address
      randomKeypair.publicKey, // Token Account owner
      undefined, // Optional keypair, default to Associated Token Account
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    // Mint tokens to sourceTokenAccount
    transactionSignature = await mintTo(
      connection,
      payer, // Transaction fee payer
      mint, // Mint Account address
      sourceTokenAccount, // Mint to
      mintAuthority, // Mint Authority address
      2000_00, // Amount
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    console.log(
      "\nMint Tokens:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
    );

    // Transfer amount
    const transferAmount = BigInt(1000_00);
    // Calculate transfer fee
    const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000);
    // Determine fee charged
    const feeCharged = fee > maxFee ? maxFee : fee;

    // Transfer tokens with fee
    transactionSignature = await transferCheckedWithFee(
      connection,
      payer, // Transaction fee payer
      sourceTokenAccount, // Source Token Account
      mint, // Mint Account address
      destinationTokenAccount, // Destination Token Account
      payer.publicKey, // Owner of Source Account
      transferAmount, // Amount to transfer
      decimals, // Mint Account decimals
      feeCharged, // Transfer fee
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    console.log(
      "\nTransfer Tokens:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
    );

    // Retrieve all Token Accounts for the Mint Account
    const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: mint.toString(), // Mint Account address
          },
        },
      ],
    });

    // List of Token Accounts to withdraw fees from
    const accountsToWithdrawFrom: PublicKey[] = [];

    for (const accountInfo of allAccounts) {
      const account = unpackAccount(
        accountInfo.pubkey, // Token Account address
        accountInfo.account, // Token Account data
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );

      // Extract transfer fee data from each account
      const transferFeeAmount = getTransferFeeAmount(account);

      // Check if fees are available to be withdrawn
      if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > 0) {
        accountsToWithdrawFrom.push(accountInfo.pubkey); // Add account to withdrawal list
      }
    }

    // Withdraw withheld tokens from Token Accounts
    transactionSignature = await withdrawWithheldTokensFromAccounts(
      connection,
      payer, // Transaction fee payer
      mint, // Mint Account address
      destinationTokenAccount, // Destination account for fee withdrawal
      withdrawWithheldAuthority, // Authority for fee withdrawal
      [], // Additional signers
      accountsToWithdrawFrom, // Token Accounts to withdrawal from
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    console.log(
      "\nWithdraw Fee From Token Accounts:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
    );

    // Harvest withheld fees from Token Accounts to Mint Account
    transactionSignature = await harvestWithheldTokensToMint(
      connection,
      payer, // Transaction fee payer
      mint, // Mint Account address
      [destinationTokenAccount], // Source Token Accounts for fee harvesting
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    console.log(
      "\nHarvest Fee To Mint Account:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
    );

    // Withdraw fees from Mint Account
    transactionSignature = await withdrawWithheldTokensFromMint(
      connection,
      payer, // Transaction fee payer
      mint, // Mint Account address
      destinationTokenAccount, // Destination account for fee withdrawal
      withdrawWithheldAuthority, // Withdraw Withheld Authority
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    console.log(
      "\nWithdraw Fee from Mint Account:",
      `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
    );
  } catch (error) {
    console.error("Error occurred:", error);
  }
})();
