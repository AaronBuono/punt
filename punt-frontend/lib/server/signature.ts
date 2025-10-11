import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export function verifySignature(authority: string, message: string, sigBase58: string) {
  try {
    const pub = new PublicKey(authority);
    const msg = new TextEncoder().encode(message);
    const sig = bs58.decode(sigBase58);
    return nacl.sign.detached.verify(msg, sig, pub.toBytes());
  } catch {
    return false;
  }
}
