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
    updateRateInterestBearingMint,
    createInitializeInterestBearingMintInstruction,
    createInitializeMintInstruction,
    getMintLen,
    TOKEN_2022_PROGRAM_ID,
    amountToUiAmount,
    getInterestBearingMintConfigState,
    getMint,
  } from "@solana/spl-token";
  
  // Playground wallet
  const payer = Keypair.generate();
  
  // Connection to devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Generate new keypair for Mint Account
  const mintKeypair = Keypair.generate();
  // Address for Mint Account
  const mint = mintKeypair.publicKey;
  // Decimals for Mint Account
  const decimals = 2;
  // Authority that can mint new tokens
  const mintAuthority = payer.publicKey;
  // Generate a new keypair for rate authority
  const rateAuthority = Keypair.generate();
  // Interest rate basis points (100 = 1%)
  // Max value = 32,767 (i16)
  const rate = 32_767;
  
  (async () => {
    try {
      // Size of Mint Account with extension
      const mintLen = getMintLen([ExtensionType.InterestBearingConfig]);
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
  
      // Instruction to initialize the InterestBearingConfig Extension
      const initializeInterestBearingMintInstruction =
        createInitializeInterestBearingMintInstruction(
          mint, // Mint Account address
          rateAuthority.publicKey, // Designated Rate Authority
          rate, // Interest rate basis points
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
        initializeInterestBearingMintInstruction,
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
  
      // New interest rate in basis points
      const updateRate = 0;
      // Update interest rate on Mint Account
      transactionSignature = await updateRateInterestBearingMint(
        connection,
        payer, // Transaction fee payer
        mint, // Mint Account Address
        rateAuthority, // Designated Rate Authority
        updateRate, // New interest rate
        [rateAuthority], // Additional signers (rateAuthority needs to sign)
        undefined, // Confirmation options
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );
  
      console.log(
        "\nUpdate Rate:",
        `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
      );
  
      // Fetch Mint Account data
      const mintAccount = await getMint(
        connection,
        mint, // Mint Account Address
        undefined, // Optional commitment
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );
  
      // Get Interest Config for Mint Account
      const interestBearingMintConfig = await getInterestBearingMintConfigState(
        mintAccount, // Mint Account data
      );
  
      console.log(
        "\nMint Config:",
        JSON.stringify(interestBearingMintConfig, null, 2),
      );
  
      function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
  
      // Wait 1 second
      await sleep(1000);
  
      // Amount to convert
      const amount = 100;
      // Convert amount to UI amount with accrued interest
      const uiAmount = await amountToUiAmount(
        connection, // Connection to the Solana cluster
        payer, // Account that will transfer lamports for the transaction
        mint, // Address of the Mint account
        amount, // Amount to be converted
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
      );
  
      console.log("\nAmount with Accrued Interest:", uiAmount);
    } catch (error) {
      console.error("Error occurred:", error);
    }
  })();
  
  console.log("Payer Public Key:", payer.publicKey.toBase58());
  