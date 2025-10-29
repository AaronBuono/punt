use proc_macro::TokenStream;
use quote::quote;
use syn::Item;

pub fn arcium_program_macro(input: &mut Item) -> TokenStream {
    let errors = quote! {
        #[error_code]
        pub enum FinalizeError {
            #[msg("Invalid finalize transaction")]
            InvalidFinalizeTx,
            #[msg("Invalid account")]
            InvalidAccount,
        }
    };

    let signer_account_struct = quote! {
        // We declare this here instead of just importing it from arcium, as otherwise
        // anchor automatically enforces its owner to be the arcium program, which is not what we want.
        #[::anchor_lang::prelude::account]
        pub struct SignerAccount {
            bump: u8,
        }
    };

    let validate_callback_ixs = quote! {
        /// Validate the transaction for the `arcium_callback` instruction is built correctly.
        fn validate_callback_ixs(instructions_sysvar: &AccountInfo, arcium_program: &Pubkey) -> Result<()> {
            /// The discriminator for the `finalize_computation` instruction within Arcium program.
            const ARCIUM_FINALIZE_COMPUTATION_DISCRIMINATOR: [u8; 8] =
            [43, 29, 152, 92, 241, 179, 193, 210];

            const ARCIUM_CALLBACK_COMPUTATION_DISCRIMINATOR: [u8; 8] =
            [11, 224, 42, 236, 0, 154, 74, 163];

            // Verify the ixs:
            // - User program's arcium_finalize ix must either be at last index
            // - The previous ix must be a finalize computation ix in the Arcium program
            // - There must be no more ixs after this one

            let curr_ix_index = ::anchor_lang::solana_program::sysvar::instructions::load_current_index_checked(instructions_sysvar)?;
            require!(curr_ix_index != 0, FinalizeError::InvalidFinalizeTx);

            // The previous ix must be a finalize computation ix in the Arcium program
            let prev_ix = ::anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked((curr_ix_index as usize) - 1, instructions_sysvar)?;

            require!(
                prev_ix.program_id == *arcium_program,
                FinalizeError::InvalidFinalizeTx,
            );
            require!(
                prev_ix.data[0..8] == ARCIUM_FINALIZE_COMPUTATION_DISCRIMINATOR || prev_ix.data[0..8] == ARCIUM_CALLBACK_COMPUTATION_DISCRIMINATOR,
                FinalizeError::InvalidFinalizeTx
            );

            // There must be no more ixs after this (and we didn't fail for some other reason)
            require!(
                ::anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked((curr_ix_index as usize) + 1, instructions_sysvar)
                    .is_err_and(|e| { e == ProgramError::InvalidArgument }),
                FinalizeError::InvalidFinalizeTx
            );

            Ok(())
        }
    };

    quote! {
        #errors
        #signer_account_struct
        #validate_callback_ixs

        #[program]
        #input
    }
    .into()
}
