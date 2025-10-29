use crate::{
    gen_callback_types::gen_callback_output_struct,
    utils::{check_encrypted_ix_path, ArciumCallbackArgs},
    validation::{
        always_valid_check,
        is_valid_arcium_program_type,
        is_valid_comp_def_acc_type,
        validate_struct_fields,
        ValidateFunction,
    },
};
use convert_case::{Case, Casing};
use quote::quote;
use syn::{parse::Parse, DeriveInput, ItemFn, LitStr, PatType};

pub struct CallbackAccArgs {
    pub encrypted_ix: LitStr,
}

impl Parse for CallbackAccArgs {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let encrypted_ix: LitStr = input.parse()?;
        Ok(CallbackAccArgs { encrypted_ix })
    }
}

pub fn callback_accs_derive(input: &DeriveInput, args: CallbackAccArgs) -> proc_macro::TokenStream {
    // Access the struct name here!
    let struct_name = &input.ident;

    // Check if the /build directory already contains the confidential instruction
    check_encrypted_ix_path(&args.encrypted_ix.value());

    let required_fields: Vec<(&str, ValidateFunction, bool)> = vec![
        ("arcium_program", is_valid_arcium_program_type, false),
        ("comp_def_account", is_valid_comp_def_acc_type, false),
        ("instructions_sysvar", always_valid_check, false),
    ];

    if let Err(error_msg) = validate_struct_fields(&input.data, &required_fields) {
        return quote! {
            compile_error!(#error_msg);
        }
        .into();
    }

    let encrypted_ix_value = &args.encrypted_ix.value();
    let callback_output_struct = gen_callback_output_struct(encrypted_ix_value);
    let callback_trait_impl = quote::quote! {
        impl ::arcium_anchor::traits::CallbackCompAccs for #struct_name<'_>{
            fn callback_ix(extra_accs: &[::arcium_client::idl::arcium::types::CallbackAccount]) -> ::arcium_client::idl::arcium::types::CallbackInstruction{
                let mut accounts = Vec::with_capacity(extra_accs.len() + 3);
                accounts.push(::arcium_client::idl::arcium::types::CallbackAccount{
                    pubkey: ::arcium_client::ARCIUM_PROGRAM_ID,
                    is_writable: false,
                });
                accounts.push(::arcium_client::idl::arcium::types::CallbackAccount{
                    pubkey: ::arcium_anchor::derive_comp_def_pda!(::arcium_anchor::comp_def_offset(#encrypted_ix_value)),
                    is_writable: false,
                });
                accounts.push(::arcium_client::idl::arcium::types::CallbackAccount{
                    pubkey: ::anchor_lang::solana_program::sysvar::instructions::ID,
                    is_writable: false,
                });
                accounts.extend_from_slice(extra_accs);

                ::arcium_client::idl::arcium::types::CallbackInstruction{
                    program_id: crate::ID_CONST,
                    discriminator: crate::instruction::#struct_name::DISCRIMINATOR.to_vec(),
                    accounts,
                }
            }
        }
    };

    // Generate the final TokenStream
    let expanded = quote! {
        #callback_output_struct
        #input
        #callback_trait_impl
    };

    expanded.into()
}

pub fn callback_ix_derive(input_fn: ItemFn, args: ArciumCallbackArgs) -> proc_macro::TokenStream {
    let fn_name = &input_fn.sig.ident;
    let fn_body = &input_fn.block;
    let fn_params = &input_fn.sig.inputs;

    // Check if the /build directory already contains the confidential instruction
    check_encrypted_ix_path(&args.encrypted_ix);

    // Function name should be "<encrypted_ix>_callback"
    if *fn_name.to_string() != format!("{}_callback", &args.encrypted_ix) {
        return syn::Error::new_spanned(
            fn_name,
            "function name must be `<encrypted_ix_name>_callback`",
        )
        .to_compile_error()
        .into();
    }

    // The function must have exactly two parameters
    if fn_params.len() != 2 {
        return syn::Error::new_spanned(
            input_fn.sig.inputs,
            "expected exactly two parameters, `ctx` and `output`",
        )
        .to_compile_error()
        .into();
    }

    // The first parameter must be a Context<T> type where T is any struct
    let ctx_param = fn_params
        .first()
        .expect("First parameter must be a Context<T>");
    if let syn::FnArg::Typed(PatType { ty, .. }) = ctx_param {
        if let syn::Type::Path(type_path) = ty.as_ref() {
            if let Some(segment) = type_path.path.segments.last() {
                if segment.ident != "Context" {
                    return syn::Error::new_spanned(ty, "parameter must be of type `Context<T>`")
                        .to_compile_error()
                        .into();
                }
                if let syn::PathArguments::AngleBracketed(args) = &segment.arguments {
                    if args.args.len() != 1 {
                        return syn::Error::new_spanned(
                            ty,
                            "`Context` must have exactly one type argument",
                        )
                        .to_compile_error()
                        .into();
                    }
                } else {
                    return syn::Error::new_spanned(ty, "`Context` must have a type argument")
                        .to_compile_error()
                        .into();
                }
            }
        } else {
            return syn::Error::new_spanned(ty, "parameter must be of type `Context<T>`")
                .to_compile_error()
                .into();
        }
    } else {
        return syn::Error::new_spanned(ctx_param, "parameter must be of type `Context<T>`")
            .to_compile_error()
            .into();
    }

    // The second parameter must be a ComputationOutputs
    let output_param = fn_params.iter().nth(1).unwrap();
    if let syn::FnArg::Typed(PatType { ty, .. }) = output_param {
        if let syn::Type::Path(type_path) = ty.as_ref() {
            if let Some(segment) = type_path.path.segments.last() {
                if segment.ident != "ComputationOutputs" {
                    return syn::Error::new_spanned(
                        ty,
                        "second parameter must be of type `ComputationOutputs`",
                    )
                    .to_compile_error()
                    .into();
                }

                // Check that ComputationOutputs has exactly one type argument
                let type_arg = match &segment.arguments {
                    syn::PathArguments::AngleBracketed(args_bracket)
                        if args_bracket.args.len() == 1 =>
                    {
                        args_bracket.args.first()
                    }
                    syn::PathArguments::AngleBracketed(_) => {
                        return syn::Error::new_spanned(
                            ty,
                            "`ComputationOutputs` must have exactly one type argument",
                        )
                        .to_compile_error()
                        .into();
                    }
                    _ => {
                        return syn::Error::new_spanned(
                            ty,
                            "`ComputationOutputs` must have a type argument",
                        )
                        .to_compile_error()
                        .into();
                    }
                };

                // When auto_serialize is true, validate that the type matches the expected
                // generated type
                if args.auto_serialize {
                    if let Some(syn::GenericArgument::Type(syn::Type::Path(inner_path))) = type_arg
                    {
                        if let Some(inner_segment) = inner_path.path.segments.last() {
                            let expected_type_name =
                                format!("{}Output", args.encrypted_ix.to_case(Case::Pascal));
                            // Note: This only compares the last segment, so qualified paths like
                            // `crate::AddOrderOutput` will only check `AddOrderOutput`
                            if inner_segment.ident != expected_type_name {
                                return syn::Error::new_spanned(
                                    ty,
                                    format!(
                                        "when auto_serialize is true (default), expected type `ComputationOutputs<{}>` but found `ComputationOutputs<{}>`. \
                                         Consider using `auto_serialize = false` if you want to use a custom type.",
                                        expected_type_name, inner_segment.ident
                                    ),
                                )
                                .to_compile_error()
                                .into();
                            }
                        }
                    }
                }
                // When auto_serialize is false, any type is allowed
            } else {
                return syn::Error::new_spanned(
                    ty,
                    "second parameter must be of type `ComputationOutputs`",
                )
                .to_compile_error()
                .into();
            }
        } else {
            return syn::Error::new_spanned(
                ty,
                "second parameter must be of type `ComputationOutputs`",
            )
            .to_compile_error()
            .into();
        }
    } else {
        return syn::Error::new_spanned(
            output_param,
            "second parameter must be of type `ComputationOutputs`",
        )
        .to_compile_error()
        .into();
    }

    // Check if the function returns a Result type
    let return_type = &input_fn.sig.output;

    if let syn::ReturnType::Type(_, ty) = return_type {
        if let syn::Type::Path(type_path) = ty.as_ref() {
            if let Some(segment) = type_path.path.segments.last() {
                if segment.ident != "Result" {
                    return syn::Error::new_spanned(ty, "function must return a `Result` type")
                        .to_compile_error()
                        .into();
                }
            }
        } else {
            return syn::Error::new_spanned(ty, "function must return a `Result` type")
                .to_compile_error()
                .into();
        }
    } else {
        return syn::Error::new_spanned(return_type, "function must return a `Result` type")
            .to_compile_error()
            .into();
    }

    quote! {
        pub fn #fn_name (#fn_params) -> ::anchor_lang::Result<()> {
            validate_callback_ixs(&ctx.accounts.instructions_sysvar, &ctx.accounts.arcium_program.key())?;

            #fn_body
        }
    }
    .into()
}
