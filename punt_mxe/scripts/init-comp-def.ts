import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Connection, Keypair } from "@solana/web3.js";
import { getArciumProgramId, getCompDefAccAddress, getCompDefAccOffset, getMXEAccAddress } from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const PROGRAM_ID = new PublicKey("3gaXj1oSXKqn9rTgcPahqU9z3L2fjYexKYpmU1xNhefL");
const RPC_URL = "https://api.devnet.solana.com";
const KEYPAIR_PATH = path.join(os.homedir(), ".config", "solana", "id.json");

const IDL = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../target/idl/punt_mxe.json"),
    "utf8"
  )
);

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")))
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );

  const program = new anchor.Program(IDL, provider);

  const arciumProgramId = getArciumProgramId();
  const compDefOffsetBytes = getCompDefAccOffset("store_bet");
  const compDefOffset = Buffer.from(compDefOffsetBytes).readUInt32LE(0);
  const compDefAccount = getCompDefAccAddress(PROGRAM_ID, compDefOffset);
  const mxeAccount = getMXEAccAddress(PROGRAM_ID);

  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("MXE Account:", mxeAccount.toBase58());
  console.log("Comp Def Account:", compDefAccount.toBase58());
  console.log("Arcium Program:", arciumProgramId.toBase58());

  // Check if already initialized
  const info = await connection.getAccountInfo(compDefAccount);
  if (info) {
    console.log("✅ Computation definition already initialized!");
    return;
  }

  console.log("\n🚀 Initializing store_bet computation definition...");

  try {
    const tx = await program.methods
      .initStoreBetCompDef()
      .accounts({
        payer: wallet.publicKey,
        mxeAccount,
        compDefAccount,
        arciumProgram: arciumProgramId,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("✅ Initialization successful!");
    console.log("Transaction:", tx);
  } catch (error) {
    console.error("❌ Initialization failed:", error);
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
