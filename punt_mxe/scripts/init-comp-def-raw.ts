import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getArciumProgramId,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getMXEAccAddress,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PROGRAM_ID = new PublicKey("3gaXj1oSXKqn9rTgcPahqU9z3L2fjYexKYpmU1xNhefL");
const RPC_URL = "https://api.devnet.solana.com";
const KEYPAIR_PATH = path.join(os.homedir(), ".config", "solana", "id.json");

// Instruction discriminator for init_store_bet_comp_def
// From IDL: [150, 204, 186, 117, 53, 159, 11, 234]
const INIT_COMP_DEF_DISCRIMINATOR = Buffer.from([150, 204, 186, 117, 53, 159, 11, 234]);

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")))
  );

  const arciumProgramId = getArciumProgramId();
  const compDefOffsetBytes = getCompDefAccOffset("store_bet");
  const compDefOffset = Buffer.from(compDefOffsetBytes).readUInt32LE(0);
  const compDefAccount = getCompDefAccAddress(PROGRAM_ID, compDefOffset);
  const mxeAccount = getMXEAccAddress(PROGRAM_ID);

  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("MXE Account:", mxeAccount.toBase58());
  console.log("Comp Def Account:", compDefAccount.toBase58());
  console.log("Arcium Program:", arciumProgramId.toBase58());
  console.log("Payer:", wallet.publicKey.toBase58());

  // Check if already initialized
  const info = await connection.getAccountInfo(compDefAccount);
  if (info) {
    console.log("✅ Computation definition already initialized!");
    return;
  }

  console.log("\n🚀 Initializing store_bet computation definition...");

  // Build instruction manually
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: mxeAccount, isSigner: false, isWritable: true }, // mxe_account
      { pubkey: compDefAccount, isSigner: false, isWritable: true }, // comp_def_account
      { pubkey: arciumProgramId, isSigner: false, isWritable: false }, // arcium_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: PROGRAM_ID,
    data: INIT_COMP_DEF_DISCRIMINATOR,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: "confirmed" }
    );

    console.log("✅ Initialization successful!");
    console.log("Transaction:", signature);
    console.log("Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  } catch (error: any) {
    console.error("❌ Initialization failed");
    if (error.logs) {
      console.error("Program logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    throw error;
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
