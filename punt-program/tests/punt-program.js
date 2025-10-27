const assert = require("assert");
const anchor = require("@coral-xyz/anchor");

const { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } = anchor.web3;

function cycleSeed(cycle) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(cycle);
  return buf;
}

async function requestAirdrop(connection, pubkey, sol) {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

describe("stream-bets-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StreamBetsProgram;

  it("runs a market lifecycle", async () => {
    const authority = Keypair.generate();
    await requestAirdrop(provider.connection, authority.publicKey, 3);

    const [authorityMeta] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority_meta"), authority.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .initAuthorityMeta()
      .accounts({
        authority: authority.publicKey,
        authorityMeta,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const cycle = 0;
    const [market] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), authority.publicKey.toBuffer(), cycleSeed(cycle)],
      program.programId,
    );

    await program.methods
      .initializeMarket("Hackathon Demo", "YES", "NO", null)
      .accounts({
        authority: authority.publicKey,
        authorityMeta,
        market,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const bettor = Keypair.generate();
    await requestAirdrop(provider.connection, bettor.publicKey, 2);

    const [ticket] = PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), market.toBuffer(), bettor.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .createTicket(0)
      .accounts({
        user: bettor.publicKey,
        market,
        ticket,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor])
      .rpc();

    await program.methods
      .placeBet(new anchor.BN(0.5 * LAMPORTS_PER_SOL))
      .accounts({
        user: bettor.publicKey,
        market,
        ticket,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor])
      .rpc();

    await program.methods
      .freezeMarket()
      .accounts({ authority: authority.publicKey, market })
      .signers([authority])
      .rpc();

    await program.methods
      .resolveMarket(0)
      .accounts({ authority: authority.publicKey, market })
      .signers([authority])
      .rpc();

    await program.methods
      .claimWinnings()
      .accounts({ user: bettor.publicKey, market, ticket })
      .signers([bettor])
      .rpc();

    const ticketAccount = await program.account.betTicket.fetch(ticket);
    assert.strictEqual(ticketAccount.claimed, true, "ticket should be marked claimed");

    await program.methods
      .closeTicket()
      .accounts({ user: bettor.publicKey, market, ticket })
      .signers([bettor])
      .rpc();

    const marketAccount = await program.account.betMarket.fetch(market);
    assert.strictEqual(marketAccount.resolved, true, "market should remain resolved");
  });
});
