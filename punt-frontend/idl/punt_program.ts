// Cycle-aware IDL (includes AuthorityMeta + cycle field in BetMarket + new init_authority_meta instruction)
// Keep in sync with on-chain target/idl/punt_program.json
import puntProgramIdl from './punt_program.json';

export const PUNT_PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID!;

export const PUNT_PROGRAM_IDL = puntProgramIdl;

export type PuntProgram = typeof PUNT_PROGRAM_IDL;
