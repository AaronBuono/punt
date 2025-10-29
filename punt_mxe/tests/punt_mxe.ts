import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { PuntMxe } from "../target/types/punt_mxe";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import path from "path";
import { randomBytes } from "crypto";
import {
  RescueCipher,
  awaitComputationFinalization,
  deserializeLE,
  getArciumProgramId,
  getClockAccAddress,
  getClusterAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getExecutingPoolAccAddress,
  getMXEAccAddress,
  getMXEPublicKey,
  getMempoolAccAddress,
  getStakingPoolAccAddress,
  getArciumProgramReadonly,
} from "@arcium-hq/client";
import { x25519 } from "@arcium-hq/client";

const MAX_CIPHERTEXT_WORDS = 18;
const WORD_SIZE_BYTES = 16;
const BET_META_SEED = Buffer.from("bet-meta");
const SIGNER_SEED = Buffer.from("SignerAccount");
const DEFAULT_KEYPAIR_PATH = path.join(
  os.homedir(),
  ".config",
  "solana",
  "id.json"
);

describe("PuntMxe", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.PuntMxe as Program<PuntMxe>;
  const owner = readKpJson(process.env.ANCHOR_WALLET ?? DEFAULT_KEYPAIR_PATH);

  const arciumProgramId = getArciumProgramId();
  const compDefOffsetBytes = getCompDefAccOffset("store_bet");
  const compDefOffset = Buffer.from(compDefOffsetBytes).readUInt32LE(0);
  const compDefAccount = getCompDefAccAddress(program.programId, compDefOffset);
  const mxeAccount = getMXEAccAddress(program.programId);

  before(async () => {
    await ensureStoreBetCompDef(program, owner, compDefAccount, mxeAccount, arciumProgramId);
  });

  it("stores and emits encrypted bet payload", async () => {
  const computationOffset = new BN(randomBytes(8).toString("hex"), 16);
    const [betMeta] = PublicKey.findProgramAddressSync(
      [BET_META_SEED, computationOffset.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [signPdaAccount] = PublicKey.findProgramAddressSync(
      [SIGNER_SEED],
      program.programId
    );

    const mempoolAccount = getMempoolAccAddress(program.programId);
    const executingPool = getExecutingPoolAccAddress(program.programId);
    const computationAccount = getComputationAccAddress(
      program.programId,
      computationOffset
    );

    const arciumProgram = await getArciumProgramReadonly(provider);
    const mxeAccountData = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    if (!mxeAccountData.cluster) {
      throw new Error("MXE account has no cluster assigned; run arcium localnet setup");
    }
    const clusterAccount = getClusterAccAddress(mxeAccountData.cluster);

    const poolAccount = getStakingPoolAccAddress();
    const clockAccount = getClockAccAddress();

    const mxePublicKey = await getMXEPublicKeyWithRetry(provider, program.programId);
    const clientSecret = x25519.utils.randomSecretKey();
    const clientPublicKey = x25519.getPublicKey(clientSecret);
    const sharedSecret = x25519.getSharedSecret(clientSecret, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    const payload = {
      bettor: owner.publicKey.toBase58(),
      pollId: "market-123",
      amount: "42.5",
      odds: "+115",
      metadata: { createdAt: new Date().toISOString() },
    };

    const {
      ciphertextBlocks,
      nonce,
      plaintextLength,
      usedWords,
    } = encryptPayload(cipher, payload);

    const betQueuedEventPromise = awaitEvent(program, "betQueuedEvent");
    const betStoredEventPromise = awaitEvent(program, "betStoredEvent");

    const queueSig = await program.methods
      .storeBet(
        computationOffset,
        owner.publicKey,
        Array.from(padPollId(payload.pollId)),
        Array.from(clientPublicKey),
        ciphertextBlocks.map(block => Array.from(block)),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accounts({
        payer: owner.publicKey,
        signPdaAccount,
        mxeAccount,
        mempoolAccount,
        executingPool,
        computationAccount,
        compDefAccount,
        clusterAccount,
        poolAccount,
        clockAccount,
        betMeta,
        systemProgram: SystemProgram.programId,
        arciumProgram: arciumProgramId,
      } as any)
      .signers([owner])
      .rpc({ skipPreflight: true, commitment: "confirmed" });

    console.log("Queued computation:", queueSig);

    const finalizeSig = await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Finalized computation:", finalizeSig);

    const betQueuedEvent = await betQueuedEventPromise;
    expect(betQueuedEvent.bettorWallet.equals(owner.publicKey)).to.be.true;
    expect(Buffer.from(betQueuedEvent.pollId)).to.deep.equal(padPollId(payload.pollId));

    const betStoredEvent = await betStoredEventPromise;
    expect(betStoredEvent.bettorWallet.equals(owner.publicKey)).to.be.true;
    expect(betStoredEvent.betMeta.equals(betMeta)).to.be.true;

    const betMetaAccount = await program.account.betComputationMeta.fetch(betMeta);
    expect(Buffer.from(betMetaAccount.pollId)).to.deep.equal(padPollId(payload.pollId));
    expect(new PublicKey(betMetaAccount.bettorWallet).equals(owner.publicKey)).to.be.true;
    expect(Buffer.from(betMetaAccount.arcisPublicKey)).to.deep.equal(Buffer.from(clientPublicKey));

    const decryptedWords = cipher.decrypt(
      betMetaAccount.ciphertext.map((block: number[]) => Array.from(block)),
      Uint8Array.from(betMetaAccount.nonce)
    );
    expect(Number(decryptedWords[0])).to.equal(usedWords);

    const restored = wordsToPayload(decryptedWords, plaintextLength);
    expect(JSON.parse(restored)).to.deep.equal(payload);
  });
});

async function ensureStoreBetCompDef(
  program: Program<PuntMxe>,
  owner: anchor.web3.Keypair,
  compDefAccount: PublicKey,
  mxeAccount: PublicKey,
  arciumProgramId: PublicKey
) {
  const info = await program.provider.connection.getAccountInfo(compDefAccount);
  if (info) {
    return;
  }

  await program.methods
    .initStoreBetCompDef()
    .accounts({
      payer: owner.publicKey,
      mxeAccount,
      compDefAccount,
      arciumProgram: arciumProgramId,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([owner])
    .rpc({ commitment: "confirmed" });
}

function encryptPayload(cipher: RescueCipher, payload: Record<string, unknown>) {
  const serialized = Buffer.from(JSON.stringify(payload), "utf8");
  const usedWords = Math.ceil(serialized.length / WORD_SIZE_BYTES);
  if (usedWords > MAX_CIPHERTEXT_WORDS) {
    throw new Error("Payload too large for configured ciphertext size");
  }

  const padded = Buffer.alloc(MAX_CIPHERTEXT_WORDS * WORD_SIZE_BYTES);
  serialized.copy(padded);

  const words: bigint[] = [BigInt(usedWords)];
  for (let i = 0; i < MAX_CIPHERTEXT_WORDS; i += 1) {
    let value = 0n;
    for (let j = 0; j < WORD_SIZE_BYTES; j += 1) {
      const byte = padded[i * WORD_SIZE_BYTES + j] ?? 0;
      value |= BigInt(byte) << BigInt(8 * j);
    }
    words.push(value);
  }

  const nonce = randomBytes(16);
  const ciphertext = cipher.encrypt(words, nonce);

  return {
    ciphertextBlocks: ciphertext.map(block => Uint8Array.from(block)),
    nonce,
    plaintextLength: serialized.length,
    usedWords,
  };
}

function wordsToPayload(words: bigint[], length: number): string {
  const usedWords = Number(words[0]);
  const buffer = Buffer.alloc(usedWords * WORD_SIZE_BYTES);
  for (let i = 0; i < usedWords; i += 1) {
    const value = words[i + 1];
    for (let j = 0; j < WORD_SIZE_BYTES; j += 1) {
      buffer[i * WORD_SIZE_BYTES + j] = Number((value >> BigInt(8 * j)) & 0xffn);
    }
  }
  return buffer.subarray(0, length).toString("utf8");
}

function padPollId(pollId: string): Buffer {
  const buf = Buffer.alloc(32);
  buf.write(pollId, 0, "utf8");
  return buf;
}

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries = 10,
  retryDelayMs = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const key = await getMXEPublicKey(provider, programId);
    if (key) {
      return key;
    }
    if (attempt < maxRetries) {
      await delay(retryDelayMs);
    }
  }
  throw new Error("MXE public key not available");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readKpJson(filePath: string): anchor.web3.Keypair {
  const raw = fs.readFileSync(filePath, "utf8");
  const secret = JSON.parse(raw) as number[];
  return anchor.web3.Keypair.fromSecretKey(new Uint8Array(secret));
}

type ProgramEvents = anchor.IdlEvents<PuntMxe>;

type EventName = keyof ProgramEvents;

function awaitEvent<E extends EventName>(
  program: Program<PuntMxe>,
  eventName: E
): Promise<ProgramEvents[E]> {
  return new Promise(async (resolve, reject) => {
    try {
      const listenerId = await program.addEventListener(
        eventName,
        (event: ProgramEvents[E]) => {
          program.removeEventListener(listenerId).catch(() => undefined);
          resolve(event);
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}
