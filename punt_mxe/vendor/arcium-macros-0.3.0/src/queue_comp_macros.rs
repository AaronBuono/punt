use crate::{
    utils::{check_encrypted_ix_path, comp_def_offset},
    validation::{
        is_valid_arcium_program_type,
        is_valid_clock_acc_type,
        is_valid_cluster_acc_type,
        is_valid_comp_acc_type,
        is_valid_comp_def_acc_type,
        is_valid_exec_pool_acc_type,
        is_valid_mempool_acc_type,
        is_valid_mxe_acc_type,
        is_valid_pool_acc_type,
        is_valid_signer_eoa,
        is_valid_signer_pda,
        is_valid_system_program_type,
        validate_struct_fields,
        ValidateFunction,
    },
};
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse::Parse, DeriveInput, Ident, LitStr, Token};

pub struct QueueCompArgs {
    pub encrypted_ix_name: LitStr,
    pub payer_name: Ident,
}

impl Parse for QueueCompArgs {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let encrypted_ix_name: LitStr = input.parse()?;
        input.parse::<Token![,]>()?;
        let payer_name: Ident = input.parse()?;

        Ok(QueueCompArgs {
            encrypted_ix_name,
            payer_name,
        })
    }
}

pub fn queue_comp_derive(input: &mut DeriveInput, args: QueueCompArgs) -> TokenStream {
    // Check if the /build directory already contains the confidential instruction
    // (with the name of the variable encrypted_ix_name)
    check_encrypted_ix_path(&args.encrypted_ix_name.value());
    let encrypted_ix_name = &args.encrypted_ix_name.value();
    let payer_name = &args.payer_name;
    let payer_name_str = &payer_name.to_string();

    let required_fields: Vec<(&str, ValidateFunction, bool)> = vec![
        (payer_name_str, is_valid_signer_eoa, true),
        ("mxe_account", is_valid_mxe_acc_type, false),
        ("sign_pda_account", is_valid_signer_pda, false),
        ("mempool_account", is_valid_mempool_acc_type, true),
        ("executing_pool", is_valid_exec_pool_acc_type, true),
        ("computation_account", is_valid_comp_acc_type, true),
        ("comp_def_account", is_valid_comp_def_acc_type, false),
        ("cluster_account", is_valid_cluster_acc_type, true),
        ("pool_account", is_valid_pool_acc_type, true),
        ("cluster_account", is_valid_cluster_acc_type, false),
        ("clock_account", is_valid_clock_acc_type, false),
        ("system_program", is_valid_system_program_type, false),
        ("arcium_program", is_valid_arcium_program_type, false),
    ];

    if let Err(error_msg) = validate_struct_fields(&input.data, &required_fields) {
        return quote! {
            compile_error!(#error_msg);
        }
        .into();
    }

    let comp_def_offset: u32 = comp_def_offset(encrypted_ix_name);

    let struct_name = &input.ident;

    let trait_impl = quote! {
        impl<'info> ::arcium_anchor::traits::QueueCompAccs<'info> for #struct_name<'info> {
            fn comp_def_offset(&self) -> u32{
                #comp_def_offset
            }

            fn mxe_program(&self) -> Pubkey {
                crate::ID
            }

            fn queue_comp_accs(&self) -> ::arcium_client::idl::arcium::cpi::accounts::QueueComputation<'info> {
                ::arcium_client::idl::arcium::cpi::accounts::QueueComputation {
                    signer: self.#payer_name.to_account_info(),
                    sign_seed: self.sign_pda_account.to_account_info(),
                    comp: self.computation_account.to_account_info(),
                    mxe: self.mxe_account.to_account_info(),
                    mempool: self.mempool_account.to_account_info(),
                    executing_pool: self.executing_pool.to_account_info(),
                    comp_def_acc: self.comp_def_account.to_account_info(),
                    cluster: self.cluster_account.to_account_info(),
                    pool_account: self.pool_account.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    clock: self.clock_account.to_account_info(),
                }
            }

            fn arcium_program(&self) -> AccountInfo<'info> {
                self.arcium_program.to_account_info()
            }

            fn signer_pda_bump(&self) -> u8 {
                self.sign_pda_account.bump
            }
        }
    };

    // Generate the final TokenStream
    quote! {
        #input
        #trait_impl
    }
    .into()
}
