use crate::{
    utils::{
        comp_def_offset,
        get_output_tokens_from_interface,
        get_output_tokens_from_manticore_interface,
        get_param_tokens_from_interface,
        get_param_tokens_from_manticore_interface,
        read_compiled_conf_ix,
        read_conf_ix_interface,
        read_manticore_interface,
    },
    validation::{
        is_valid_arcium_program_type,
        is_valid_mxe_acc_type,
        is_valid_signer_eoa,
        is_valid_system_program_type,
        is_valid_unchecked_account,
        validate_struct_fields,
        ValidateFunction,
    },
};
use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::{parse::Parse, DeriveInput, Ident, LitStr, Token};

pub struct InitCompDefArgs {
    pub encrypted_ix: LitStr,
    pub payer_field: Ident,
}

impl Parse for InitCompDefArgs {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let encrypted_ix: LitStr = input.parse()?;
        input.parse::<Token![,]>()?;
        let payer_field: Ident = input.parse()?;

        Ok(InitCompDefArgs {
            encrypted_ix,
            payer_field,
        })
    }
}

pub fn init_comp_def_derive(input: &mut DeriveInput, args: InitCompDefArgs) -> TokenStream {
    let struct_name = &input.ident;
    let payer_field = args.payer_field.to_string();
    let encrypted_ix_name = args.encrypted_ix.value();
    let is_manticore = encrypted_ix_name.starts_with("manticore");
    let required_fields: Vec<(&str, ValidateFunction, bool)> = vec![
        (&payer_field, is_valid_signer_eoa, true),
        ("mxe_account", is_valid_mxe_acc_type, true),
        ("comp_def_account", is_valid_unchecked_account, true),
        ("system_program", is_valid_system_program_type, false),
        ("arcium_program", is_valid_arcium_program_type, false),
    ];

    if let Err(error_msg) = validate_struct_fields(&input.data, &required_fields) {
        return quote! {
            compile_error!(#error_msg);
        }
        .into();
    }

    // Convert the payer_field string to an Ident
    let payer_field_ident = format_ident!("{}", payer_field);

    let compiled_conf_ix_len = read_compiled_conf_ix(&encrypted_ix_name).len();
    let (param_tokens, output_tokens) = if is_manticore {
        let manticore_interface = read_manticore_interface(&encrypted_ix_name);
        (
            get_param_tokens_from_manticore_interface(&manticore_interface),
            get_output_tokens_from_manticore_interface(&manticore_interface),
        )
    } else {
        let conf_ix_interface = read_conf_ix_interface(&encrypted_ix_name);
        (
            get_param_tokens_from_interface(&conf_ix_interface),
            get_output_tokens_from_interface(&conf_ix_interface),
        )
    };

    // let param_tokens = get_param_tokens_from_interface(&conf_ix_interface);
    // let output_tokens = get_output_tokens_from_interface(&conf_ix_interface);
    let comp_def_offset = comp_def_offset(&encrypted_ix_name);

    let trait_impl = quote! {
        impl<'info> ::arcium_anchor::traits::InitCompDefAccs<'info> for #struct_name<'info> {
            fn arcium_program(&self) -> AccountInfo<'info> {
                self.arcium_program.to_account_info()
            }

            fn mxe_program(&self) -> Pubkey {
                crate::ID
            }

            fn signer(&self) -> AccountInfo<'info> {
                self.#payer_field_ident.to_account_info()
            }

            fn mxe_acc(&self) -> AccountInfo<'info> {
                self.mxe_account.to_account_info()
            }

            fn comp_def_acc(&self) -> AccountInfo<'info> {
                self.comp_def_account.to_account_info()
            }

            fn system_program(&self) -> AccountInfo<'info> {
                self.system_program.to_account_info()
            }

            fn params(&self) -> Vec<::arcium_client::idl::arcium::types::Parameter>{
                vec![#(#param_tokens),*]
            }

            fn outputs(&self) -> Vec<::arcium_client::idl::arcium::types::Output>{
                vec![#(#output_tokens),*]
            }

            fn comp_def_offset(&self) -> u32 {
                #comp_def_offset
            }

            fn compiled_circuit_len(&self) -> u32 {
                let len = #compiled_conf_ix_len;
                len.try_into().expect("Circuit length exceeds u32 limit")
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
