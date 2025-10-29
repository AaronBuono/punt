use crate::utils::{get_param_tokens_from_interface, read_conf_ix_interface};
use proc_macro2::{Span, TokenStream};
use quote::ToTokens;
use std::collections::HashMap;
use syn::{
    parse::Parser,
    parse_quote,
    punctuated::Punctuated,
    visit_mut::VisitMut,
    Attribute,
    Expr,
    ExprArray,
    ExprCall,
    ItemFn,
    Macro,
    Stmt,
};

const ARGS_ATTRIBUTE_NAME: &str = "args";

#[derive(Default)]
struct IxArgsFinder {
    current_ix: Option<String>,
    current_ix_stmt_depth: usize,
    found: HashMap<String, Punctuated<Expr, syn::token::Comma>>,
    errors: Vec<syn::Error>,
}

impl VisitMut for IxArgsFinder {
    fn visit_attributes_mut(&mut self, i: &mut Vec<Attribute>) {
        let attr = i
            .iter()
            .enumerate()
            .find(|attr| attr.1.meta.path().is_ident(ARGS_ATTRIBUTE_NAME));
        if let Some((idx, attr)) = attr {
            match attr.meta.require_list() {
                Ok(nv) => {
                    let s: syn::LitStr = match syn::parse2(nv.tokens.clone()) {
                        Ok(s) => s,
                        Err(e) => {
                            self.errors.push(e);
                            return;
                        }
                    };
                    self.current_ix = Some(s.value());
                    self.current_ix_stmt_depth = 0;
                }
                Err(e) => self.errors.push(e),
            }
            i.remove(idx);
        }
    }
    fn visit_expr_array_mut(&mut self, i: &mut ExprArray) {
        self.visit_attributes_mut(&mut i.attrs);
        let Some(current_ix) = self.current_ix.as_ref() else {
            return;
        };
        if self.found.contains_key(current_ix) {
            return;
        }
        self.found.insert(current_ix.clone(), i.elems.clone());
        syn::visit_mut::visit_expr_array_mut(self, i);
    }
    fn visit_macro_mut(&mut self, i: &mut Macro) {
        let Some(current_ix) = self.current_ix.as_ref() else {
            return;
        };
        if self.found.contains_key(current_ix) {
            return;
        }
        if i.path.is_ident("vec") {
            let Ok(punctuated) = Punctuated::parse_terminated.parse2(i.tokens.clone()) else {
                self.errors.push(syn::Error::new_spanned(
                    &i.tokens,
                    "Error while parsing this. This macro does not work on vec![...;...].",
                ));
                return;
            };
            self.found.insert(current_ix.clone(), punctuated);
        }
    }
    fn visit_stmt_mut(&mut self, i: &mut Stmt) {
        self.current_ix_stmt_depth += 1;
        syn::visit_mut::visit_stmt_mut(self, i);
        if self.current_ix_stmt_depth == 0 {
            self.current_ix = None;
        } else {
            self.current_ix_stmt_depth -= 1;
        }
    }
}

struct IxArgsConstMaker;

impl VisitMut for IxArgsConstMaker {
    fn visit_expr_call_mut(&mut self, i: &mut ExprCall) {
        let Expr::Path(syn::ExprPath { path, .. }) = i.func.as_ref() else {
            return;
        };
        let last_ident = path.segments.last().unwrap().ident.to_string();
        // Constant expressions that can replace arguments and still pass.
        let mut replacement_expressions = if last_ident == "PlaintextFloat" {
            vec![syn::parse_quote! {0.0}]
        } else if last_ident.starts_with("Plaintext") {
            vec![syn::parse_quote! {0}]
        } else if last_ident.starts_with("Encrypted") || last_ident == "ArcisPubkey" {
            vec![syn::parse_quote! {[0; 32]}]
        } else if last_ident == "ArcisSignature" {
            vec![syn::parse_quote! {[0; 64]}]
        } else if last_ident == "Account" {
            vec![
                syn::parse_quote! {anchor_lang::solana_program::pubkey::Pubkey::new_from_array([0;32])},
                syn::parse_quote! {0},
            ]
        } else {
            Vec::new()
        };
        i.args.iter_mut().enumerate().for_each(|(i, arg)| {
            if i < replacement_expressions.len() {
                std::mem::swap(arg, &mut replacement_expressions[i]);
            }
        })
    }
}

pub fn check_args_fn(mut item_fn: ItemFn) -> TokenStream {
    let mut ix_args_finder = IxArgsFinder::default();
    ix_args_finder.visit_item_fn_mut(&mut item_fn);
    if ix_args_finder.found.is_empty() {
        ix_args_finder.errors.push(syn::Error::new(
            Span::call_site(),
            "No `#[args(\"your_instruction\")]` found.",
        ));
    }
    ix_args_finder.found.values_mut().for_each(|arg| {
        arg.iter_mut()
            .for_each(|expr| IxArgsConstMaker.visit_expr_mut(expr));
    });
    let extra_stmts = ix_args_finder.found.into_iter().map(|(ix, arguments)| {
        let conf_ix_interface = read_conf_ix_interface(&ix);
        let param_tokens = get_param_tokens_from_interface(&conf_ix_interface);
        let quote_args = arguments.iter();
        parse_quote! {
            const {
                let args = [#(#quote_args),*];
                let params = [#(#param_tokens),*];
                const_match_computation(&args, &params);
            };
        }
    });

    item_fn.block.stmts.splice(0..0, extra_stmts);
    let mut res = item_fn.to_token_stream();
    for err in ix_args_finder.errors {
        res.extend(err.to_compile_error());
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;
    #[ignore = "Used for debugging, not for testing."]
    #[test]
    fn debug_this_macro() {
        let input = parse_quote! {
            pub fn find_next_match(ctx: Context<NextMatch>, computation_offset: u64) -> Result<()> {
                ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

                // Call the Arcium program to queue the computations
                queue_computation(
                    ctx.accounts,
                    computation_offset,
                    #[args("find_next_match")]
                    vec![
                        Argument::ArcisPubkey(ctx.accounts.orderbook.encryption_pubkey),
                        Argument::PlaintextU128(ctx.accounts.orderbook.nonce),
                        Argument::Account(
                            ctx.accounts.orderbook.key(),
                            // Offset of 8 (discriminator) + 1 (bump) + 16 (nonce) + 32 (encryption pubkey)
                            8 + 1 + 16 + 32,
                            32 * 3 * ORDERBOOK_SIZE as u32,
                        ),
                    ],
                    Some("http://172.20.0.10:8080".to_string()),
                    vec![CallbackInstruction{
                        program_id: ID_CONST,
                        discriminator: instruction::FindNextMatchCallback::DISCRIMINATOR.to_vec(),
                        accounts: vec![
                            CallbackAccount{
                                pubkey: ARCIUM_PROGRAM_ID,
                                is_writable: false,
                            },
                            CallbackAccount{
                                pubkey: derive_comp_def_pda!(COMP_DEF_OFFSET_FIND_MATCH),
                                is_writable: false,
                            },
                            CallbackAccount{
                                pubkey: INSTRUCTIONS_SYSVAR_ID,
                                is_writable: false,
                            },
                        ],
                }])?;
                Ok(())
            }
        };
        let res = check_args_fn(input);
        println!("{}", res);
    }
}
