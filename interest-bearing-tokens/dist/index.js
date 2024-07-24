"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
// Playground wallet
const payer = web3_js_1.Keypair.generate();
// Connection to devnet cluster
const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)("devnet"), "confirmed");
// Generate new keypair for Mint Account
const mintKeypair = web3_js_1.Keypair.generate();
// Address for Mint Account
const mint = mintKeypair.publicKey;
// Decimals for Mint Account
const decimals = 2;
// Authority that can mint new tokens
const mintAuthority = payer.publicKey;
// Generate a new keypair for rate authority
const rateAuthority = web3_js_1.Keypair.generate();
// Interest rate basis points (100 = 1%)
// Max value = 32,767 (i16)
const rate = 32767;
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Size of Mint Account with extension
        const mintLen = (0, spl_token_1.getMintLen)([spl_token_1.ExtensionType.InterestBearingConfig]);
        // Minimum lamports required for Mint Account
        const lamports = yield connection.getMinimumBalanceForRentExemption(mintLen);
        // Instruction to invoke System Program to create new account
        const createAccountInstruction = web3_js_1.SystemProgram.createAccount({
            fromPubkey: payer.publicKey, // Account that will transfer lamports to created account
            newAccountPubkey: mint, // Address of the account to create
            space: mintLen, // Amount of bytes to allocate to the created account
            lamports, // Amount of lamports transferred to created account
            programId: spl_token_1.TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
        });
        // Instruction to initialize the InterestBearingConfig Extension
        const initializeInterestBearingMintInstruction = (0, spl_token_1.createInitializeInterestBearingMintInstruction)(mint, // Mint Account address
        rateAuthority.publicKey, // Designated Rate Authority
        rate, // Interest rate basis points
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        // Instruction to initialize Mint Account data
        const initializeMintInstruction = (0, spl_token_1.createInitializeMintInstruction)(mint, // Mint Account Address
        decimals, // Decimals of Mint
        mintAuthority, // Designated Mint Authority
        null, // Optional Freeze Authority
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        // Add instructions to new transaction
        const transaction = new web3_js_1.Transaction().add(createAccountInstruction, initializeInterestBearingMintInstruction, initializeMintInstruction);
        // Send transaction
        let transactionSignature = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer, mintKeypair]);
        console.log("\nCreate Mint Account:", `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`);
        // New interest rate in basis points
        const updateRate = 0;
        // Update interest rate on Mint Account
        transactionSignature = yield (0, spl_token_1.updateRateInterestBearingMint)(connection, payer, // Transaction fee payer
        mint, // Mint Account Address
        rateAuthority, // Designated Rate Authority
        updateRate, // New interest rate
        [rateAuthority], // Additional signers (rateAuthority needs to sign)
        undefined, // Confirmation options
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        console.log("\nUpdate Rate:", `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`);
        // Fetch Mint Account data
        const mintAccount = yield (0, spl_token_1.getMint)(connection, mint, // Mint Account Address
        undefined, // Optional commitment
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        // Get Interest Config for Mint Account
        const interestBearingMintConfig = yield (0, spl_token_1.getInterestBearingMintConfigState)(mintAccount);
        console.log("\nMint Config:", JSON.stringify(interestBearingMintConfig, null, 2));
        function sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        }
        // Wait 1 second
        yield sleep(1000);
        // Amount to convert
        const amount = 100;
        // Convert amount to UI amount with accrued interest
        const uiAmount = yield (0, spl_token_1.amountToUiAmount)(connection, // Connection to the Solana cluster
        payer, // Account that will transfer lamports for the transaction
        mint, // Address of the Mint account
        amount, // Amount to be converted
        spl_token_1.TOKEN_2022_PROGRAM_ID);
        console.log("\nAmount with Accrued Interest:", uiAmount);
    }
    catch (error) {
        console.error("Error occurred:", error);
    }
}))();
console.log("Payer Public Key:", payer.publicKey.toBase58());
