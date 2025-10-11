// Cycle-aware IDL (includes AuthorityMeta + cycle field in BetMarket + new init_authority_meta instruction)
// Keep in sync with on-chain target/idl/stream_bets_program.json
export const STREAM_BETS_PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID!;

export const STREAM_BETS_PROGRAM_IDL = {
  "address": "Cf83CfNFqArAjvQVqpegyuJBjp546jaMKhQA7NGb1zWY",
  "metadata": {"name": "stream_bets_program", "version": "0.1.0", "spec": "0.1.0", "description": "Created with Anchor"},
  "instructions": [
    {"name": "claim_winnings","docs": ["Claim winnings for a resolved market. Losers get nothing; winners proportionally."],"discriminator": [161,215,24,59,14,236,242,221],"accounts": [
      {"name": "user","writable": true,"signer": true,"relations": ["ticket"]},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "market.authority","account": "BetMarket"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]},"relations": ["ticket"]},
      {"name": "ticket","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [116,105,99,107,101,116]},
        {"kind": "account","path": "market"},
        {"kind": "account","path": "user"}
      ]}}
    ],"args": []},
    {"name": "close_market","docs": ["Close a resolved market returning rent to authority. All winnings must be claimed and fees withdrawn."],"discriminator": [88,154,248,186,48,14,123,244],"accounts": [
      {"name": "authority","writable": true,"signer": true,"relations": ["market"]},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "authority"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]}},
      {"name": "host","writable": true}
    ],"args": []},
    {"name": "close_ticket","docs": ["Close a resolved (claimed or losing) ticket returning rent to user."],"discriminator": [66,209,114,197,75,27,182,117],"accounts": [
      {"name": "user","writable": true,"signer": true,"relations": ["ticket"]},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "market.authority","account": "BetMarket"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]},"relations": ["ticket"]},
      {"name": "ticket","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [116,105,99,107,101,116]},
        {"kind": "account","path": "market"},
        {"kind": "account","path": "user"}
      ]}}
    ],"args": []},
    {"name": "create_ticket","docs": ["Create a ticket (locks in side). One ticket per (user, market)."],"discriminator": [16,178,122,25,213,85,96,129],"accounts": [
      {"name": "user","writable": true,"signer": true},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "market.authority","account": "BetMarket"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]}},
      {"name": "ticket","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [116,105,99,107,101,116]},
        {"kind": "account","path": "market"},
        {"kind": "account","path": "user"}
      ]}},
      {"name": "system_program","address": "11111111111111111111111111111111"}
    ],"args": [{"name": "side","type": "u8"}]},
    {"name": "init_authority_meta","docs": ["Initialize authority meta (one-time per authority) holding cycle counter."],"discriminator": [123,206,104,146,13,215,120,71],"accounts": [
      {"name": "authority","writable": true,"signer": true},
      {"name": "authority_meta","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [97,117,116,104,111,114,105,116,121,95,109,101,116,97]},
        {"kind": "account","path": "authority"}
      ]}},
      {"name": "system_program","address": "11111111111111111111111111111111"}
    ],"args": []},
    {"name": "initialize_market","docs": ["Initialize a single market for the authority (1 market per authority in this simple PoC)","Added naming fields: title, label_yes, label_no for richer streamer UX."],"discriminator": [35,35,189,193,155,48,170,203],"accounts": [
      {"name": "authority","writable": true,"signer": true,"relations": ["authority_meta"]},
      {"name": "authority_meta","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [97,117,116,104,111,114,105,116,121,95,109,101,116,97]},
        {"kind": "account","path": "authority"}
      ]}},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "authority"},
        {"kind": "account","path": "authority_meta.next_cycle","account": "AuthorityMeta"}
      ]}},
      {"name": "system_program","address": "11111111111111111111111111111111"}
    ],"args": [
      {"name": "title","type": "string"},
      {"name": "label_yes","type": "string"},
      {"name": "label_no","type": "string"},
      {"name": "fee_bps","type": {"option": "u16"}}
    ]},
    {"name": "place_bet","docs": ["Place a bet increasing ticket amount and updating pools. (No resolve/claim yet in phase 1)"],"discriminator": [222,62,67,220,63,166,126,33],"accounts": [
      {"name": "user","writable": true,"signer": true,"relations": ["ticket"]},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "market.authority","account": "BetMarket"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]},"relations": ["ticket"]},
      {"name": "ticket","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [116,105,99,107,101,116]},
        {"kind": "account","path": "market"},
        {"kind": "account","path": "user"}
      ]}},
      {"name": "system_program","address": "11111111111111111111111111111111"}
    ],"args": [{"name": "amount","type": "u64"}]},
    {"name": "resolve_market","docs": ["Resolve the market selecting a winning side (0=yes,1=no). Only authority."],"discriminator": [155,23,80,173,46,74,23,239],"accounts": [
      {"name": "authority","writable": true,"signer": true,"relations": ["market"]},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "authority"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]}}
    ],"args": [{"name": "winning_side","type": "u8"}]},
    {"name": "withdraw_fees","docs": ["Withdraw accumulated fees to authority."],"discriminator": [198,212,171,109,144,215,174,89],"accounts": [
      {"name": "authority","writable": true,"signer": true,"relations": ["market"]},
      {"name": "market","writable": true,"pda": {"seeds": [
        {"kind": "const","value": [109,97,114,107,101,116]},
        {"kind": "account","path": "authority"},
        {"kind": "account","path": "market.cycle","account": "BetMarket"}
      ]}},
      {"name": "host","writable": true}
    ],"args": []}
  ],
  "accounts": [
    {"name": "AuthorityMeta","discriminator": [219,220,26,240,136,158,213,95]},
    {"name": "BetMarket","discriminator": [52,244,62,195,155,22,113,168]},
    {"name": "BetTicket","discriminator": [13,27,200,131,20,60,226,38]}
  ],
  "events": [
    {"name": "MarketResolvedEvent", "discriminator": [87,249,34,139,194,159,14,156] }
  ],
  "errors": [
    {"code": 6000,"name": "InvalidSide","msg": "Invalid side"},
    {"code": 6001,"name": "ZeroAmount","msg": "Zero amount not allowed"},
    {"code": 6002,"name": "MarketAlreadyResolved","msg": "Market already resolved"},
    {"code": 6003,"name": "AlreadyClaimed","msg": "Ticket already claimed"},
    {"code": 6004,"name": "TicketSideMismatch","msg": "Ticket side mismatch"},
    {"code": 6005,"name": "MathOverflow","msg": "Math overflow"},
    {"code": 6006,"name": "Unauthorized","msg": "Unauthorized"},
    {"code": 6007,"name": "TicketMarketMismatch","msg": "Ticket market mismatch"},
    {"code": 6008,"name": "InvalidFee","msg": "Invalid fee bps"},
    {"code": 6009,"name": "MarketNotResolved","msg": "Market not resolved"},
    {"code": 6010,"name": "InsufficientEscrow","msg": "Insufficient escrow"},
    {"code": 6011,"name": "InvalidWinningSide","msg": "Invalid winning side"},
    {"code": 6012,"name": "FeesRemaining","msg": "Fees still accrued"},
    {"code": 6013,"name": "OutstandingLamports","msg": "Outstanding lamports remain"},
    {"code": 6014,"name": "CannotCloseActiveTicket","msg": "Cannot close active ticket"},
    {"code": 6015,"name": "AuthorityCannotBet","msg": "Authority cannot bet on own market"},
    {"code": 6016,"name": "LabelTooLong","msg": "Label or title too long"}
  ],
  "types": [
    {"name": "AuthorityMeta","type": {"kind": "struct","fields": [
      {"name": "authority","type": "pubkey"},
      {"name": "next_cycle","type": "u16"},
      {"name": "bump","type": "u8"}
    ]}},
    {"name": "BetMarket","type": {"kind": "struct","fields": [
      {"name": "authority","type": "pubkey"},
      {"name": "cycle","type": "u16"},
      {"name": "pool_yes","type": "u64"},
      {"name": "pool_no","type": "u64"},
      {"name": "resolved","type": "bool"},
      {"name": "fee_bps","type": "u16"},
      {"name": "host_fee_bps","type": "u16"},
      {"name": "bump","type": "u8"},
      {"name": "winning_side","type": "u8"},
      {"name": "fees_accrued","type": "u64"},
      {"name": "title","type": {"array": ["u8",64]}},
      {"name": "label_yes","type": {"array": ["u8",32]}},
      {"name": "label_no","type": {"array": ["u8",32]}}
    ]}},
    {"name": "BetTicket","type": {"kind": "struct","fields": [
      {"name": "user","type": "pubkey"},
      {"name": "market","type": "pubkey"},
      {"name": "side","type": "u8"},
      {"name": "amount","type": "u64"},
      {"name": "claimed","type": "bool"},
      {"name": "bump","type": "u8"}
    ]}},
    {"name": "MarketResolvedEvent", "type": {"kind": "struct", "fields": [
      {"name": "market", "type": "pubkey"},
      {"name": "authority", "type": "pubkey"},
      {"name": "winning_side", "type": "u8"},
      {"name": "pool_yes", "type": "u64"},
      {"name": "pool_no", "type": "u64"},
      {"name": "no_winner", "type": "bool"},
      {"name": "fees_accrued", "type": "u64"}
    ]}}
  ]
} as const;

export type StreamBetsProgram = typeof STREAM_BETS_PROGRAM_IDL;
