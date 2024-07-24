import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    clusterApiUrl,
    sendAndConfirmTransaction,
  } from "@solana/web3.js";
  import {
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMintInstruction,
    createInitializeNonTransferableMintInstruction,
    getMintLen,
    mintTo,
    createAccount,
    transfer,
    burn,
    closeAccount,
  } from "@solana/spl-token";
  


  const payer = Keypair.generate();
  
  // Connection to devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Transaction signature returned from sent transaction
  let transactionSignature: string;


  // Generate new keypair for Mint Account
const mintKeypair = Keypair.generate();
// Address for Mint Account
const mint = mintKeypair.publicKey;
// Decimals for Mint Account
const decimals = 2;
// Authority that can mint new tokens
const mintAuthority = payer.publicKey;

// Size of Mint Account with extension
const mintLen = getMintLen([ExtensionType.NonTransferable]);
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

  // Instruction to initialize the NonTransferable Extension
const initializeNonTransferableMintInstruction =
createInitializeNonTransferableMintInstruction(
  mint, // Mint Account address
  TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
);


// Add instructions to new transaction
const transaction = new Transaction().add(
    createAccountInstruction,
    initializeNonTransferableMintInstruction,
    
  );
  
  // Send transaction
  transactionSignature = await sendAndConfirmTransaction(
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
const randomKeypair = new Keypair();
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
    100, // Amount
    undefined, // Additional signers
    undefined, // Confirmation options
    TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  );
  
  console.log(
    "\nMint Tokens:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
  );

  try {
    // Attempt to Transfer tokens
    await transfer(
      connection,
      payer, // Transaction fee payer
      sourceTokenAccount, // Transfer from
      destinationTokenAccount, // Transfer to
      payer.publicKey, // Source Token Account owner
      100, // Amount
      undefined, // Additional signers
      undefined, // Confirmation options
      TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );
  } catch (error) {
    console.log("\nExpect Error:", error);
  }


  // Burn tokens
transactionSignature = await burn(
    connection,
    payer, // Transaction fee payer
    sourceTokenAccount, // Burn from
    mint, // Mint Account address
    payer.publicKey, // Token Account owner
    100, // Amount
    undefined, // Additional signers
    undefined, // Confirmation options
    TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  );
  
  console.log(
    "\nBurn Tokens:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
  );

  // Close Token Account
transactionSignature = await closeAccount(
    connection,
    payer, // Transaction fee payer
    sourceTokenAccount, // Token Account to close
    payer.publicKey, // Account to receive lamports from closed account
    payer.publicKey, // Owner of Token Account
    undefined, // Additional signers
    undefined, // Confirmation options
    TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
  );
  
  console.log(
    "\nClose Token Account:",
    `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
  );