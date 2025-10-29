use arcis_interface::{CircuitInterface, ManticoreInterface, Value};
use proc_macro2::TokenStream;
use quote::quote;
use sha2::{Digest, Sha256};
use std::fs;
use syn::{parse::Parse, punctuated::Punctuated, Meta, Token};

pub struct ArciumCallbackArgs {
    pub encrypted_ix: String,
    pub auto_serialize: bool,
}

impl Parse for ArciumCallbackArgs {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let mut encrypted_ix = None;
        let mut auto_serialize = None;

        let nested_meta_list = Punctuated::<Meta, Token![,]>::parse_terminated(input)?;

        for nested_meta in nested_meta_list {
            if let Meta::NameValue(nv) = nested_meta {
                if nv.path.is_ident("encrypted_ix") {
                    if let syn::Expr::Lit(lit) = &nv.value {
                        if let syn::Lit::Str(s) = &lit.lit {
                            encrypted_ix = Some(s.value());
                        }
                    }
                } else if nv.path.is_ident("auto_serialize") {
                    if let syn::Expr::Lit(lit) = &nv.value {
                        if let syn::Lit::Bool(b) = &lit.lit {
                            auto_serialize = Some(b.value);
                        }
                    }
                }
            }
        }

        if let Some(c) = encrypted_ix {
            let args = ArciumCallbackArgs {
                encrypted_ix: c,
                auto_serialize: auto_serialize.unwrap_or(true), // Default to true
            };
            Ok(args)
        } else {
            panic!("Arcium callback derive requires a encrypted_ix = \"...\" parameter");
        }
    }
}

pub fn check_encrypted_ix_path(encrypted_ix_name: &str) {
    let encrypted_ix_file_path = format!("build/{}_testnet.arcis", &encrypted_ix_name);
    if fs::metadata(encrypted_ix_file_path.clone()).is_err() {
        panic!(
            "Confidential instruction was not found at path: {}",
            encrypted_ix_file_path,
        );
    }
}

pub fn read_conf_ix_interface(conf_ix_name: &str) -> CircuitInterface {
    let conf_ix_file_path = format!("build/{}.idarc", &conf_ix_name);
    let interface_json = fs::read_to_string(&conf_ix_file_path).unwrap_or_else(|_| {
        panic!(
            "Could not read confidential ix interface at path {}",
            conf_ix_file_path
        )
    });
    CircuitInterface::from_json(&interface_json).expect("Failed to parse interface from json")
}

pub fn read_manticore_interface(conf_ix_name: &str) -> ManticoreInterface {
    let conf_ix_file_path = format!("encrypted-ixs/manticore_defs/{}.json", &conf_ix_name);
    let interface_json = fs::read_to_string(&conf_ix_file_path).unwrap_or_else(|_| {
        panic!(
            "Could not read confidential manticore configuration at path {}",
            conf_ix_file_path
        )
    });

    ManticoreInterface::from_json(&interface_json).expect("Failed to parse interface from json")
}

pub fn read_compiled_conf_ix(conf_ix_name: &str) -> Vec<u8> {
    let conf_ix_file_path = format!("build/{}_testnet.arcis", &conf_ix_name);
    fs::read(&conf_ix_file_path).unwrap_or_else(|_| {
        panic!(
            "Could not read compiled confidential ix at path {}",
            conf_ix_file_path
        )
    })
}

pub fn comp_def_offset(input: &str) -> u32 {
    let mut hasher = Sha256::new();
    hasher.update(input);
    let result = hasher.finalize();
    u32::from_le_bytes([result[0], result[1], result[2], result[3]])
}

/// Transforms the circuit interface into a list of tokens that represent the parameters for the
/// circuit. You might be wondering why we do circuitinterface -> param_tokens, instead of
/// circuitinterface -> params -> param_tokens, as the latter would feel a bit cleaner. The reason
/// is that this would require us to import arcium_client as a dependency of arcium_macros,
/// which for some reason causes a billion errors in anchor programs that then want to use
/// arcium_macros (in spite of these programs having arcium_client as a dependency themselves!).
/// Therefore, this is the only way to do it.
pub fn get_param_tokens_from_interface(circuit: &CircuitInterface) -> Vec<TokenStream> {
    circuit
        .inputs
        .iter()
        .flat_map(raw_input_to_param_tokens)
        .collect()
}

pub fn get_param_tokens_from_manticore_interface(circuit: &ManticoreInterface) -> Vec<TokenStream> {
    circuit
        .inputs
        .iter()
        .map(|x| manticore_interface_arg_to_param_tokens(x))
        .collect()
}

pub fn get_output_tokens_from_manticore_interface(
    circuit: &ManticoreInterface,
) -> Vec<TokenStream> {
    circuit
        .outputs
        .iter()
        .map(|x| manticore_interface_arg_to_output_tokens(x))
        .collect()
}

pub fn get_output_tokens_from_interface(circuit: &CircuitInterface) -> Vec<TokenStream> {
    circuit
        .outputs
        .iter()
        .flat_map(raw_output_to_output_tokens)
        .collect()
}

pub fn manticore_interface_arg_to_param_tokens(arg: &str) -> TokenStream {
    match arg {
        "ManticoreAlgo" => quote! {::arcium_client::idl::arcium::types::Parameter::ManticoreAlgo},
        "InputDataset" => quote! {::arcium_client::idl::arcium::types::Parameter::InputDataset},
        "PlaintextBool" => quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextBool},
        "PlaintextU8" => quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU8},
        "PlaintextU16" => quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU16},
        "PlaintextU32" => quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU32},
        "PlaintextU64" => quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU64},
        "PlaintextU128" => quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU128},

        _ => panic!("Unsupported input type for Manticore"),
    }
}

pub fn manticore_interface_arg_to_output_tokens(arg: &str) -> TokenStream {
    match arg {
        "PlaintextBool" => quote! {::arcium_client::idl::arcium::types::Output::PlaintextBool},
        "PlaintextU8" => quote! {::arcium_client::idl::arcium::types::Output::PlaintextU8},
        "PlaintextU16" => quote! {::arcium_client::idl::arcium::types::Output::PlaintextU16},
        "PlaintextU32" => quote! {::arcium_client::idl::arcium::types::Output::PlaintextU32},
        "PlaintextU64" => quote! {::arcium_client::idl::arcium::types::Output::PlaintextU64},
        "PlaintextU128" => quote! {::arcium_client::idl::arcium::types::Output::PlaintextU128},

        _ => panic!("Unsupported input type for Manticore"),
    }
}

fn raw_input_to_param_tokens(val: &Value) -> Vec<TokenStream> {
    match val {
        Value::Bool => vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextBool}],
        Value::Scalar { size_in_bits } => match size_in_bits {
            8 => vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU8}],
            16 => vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU16}],
            32 => vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU32}],
            64 => vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU64}],
            128 => vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextU128}],
            _ => panic!("Unsupported scalar size: {}", size_in_bits),
        },
        Value::Ciphertext { size_in_bits: _ } => {
            vec![quote! {::arcium_client::idl::arcium::types::Parameter::Ciphertext}]
        }
        Value::PublicKey { size_in_bits: _ } => {
            vec![quote! {::arcium_client::idl::arcium::types::Parameter::ArcisPubkey}]
        }
        Value::Float { size_in_bits } => {
            if *size_in_bits != 64 {
                panic!("Unsupported float size: {}", size_in_bits);
            }
            vec![quote! {::arcium_client::idl::arcium::types::Parameter::PlaintextFloat}]
        }
        Value::Array(c) => c.iter().flat_map(raw_input_to_param_tokens).collect(),
        Value::Tuple(c) => c.iter().flat_map(raw_input_to_param_tokens).collect(),
        Value::Struct(c) => c.iter().flat_map(raw_input_to_param_tokens).collect(),
        Value::MBool => panic!("Unsupported shared bool"),
        Value::MScalar { size_in_bits: _ } => panic!("Unsupported shared scalar"),
        Value::MFloat { size_in_bits: _ } => panic!("Unsupported shared float"),
    }
}

fn raw_output_to_output_tokens(val: &Value) -> Vec<TokenStream> {
    match val {
        Value::Bool => vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextBool}],
        Value::Scalar { size_in_bits } => match size_in_bits {
            8 => vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextU8}],
            16 => vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextU16}],
            32 => vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextU32}],
            64 => vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextU64}],
            128 => vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextU128}],
            _ => panic!("Unsupported scalar size: {}", size_in_bits),
        },
        Value::Ciphertext { size_in_bits: _ } => {
            vec![quote! {::arcium_client::idl::arcium::types::Output::Ciphertext}]
        }
        Value::PublicKey { size_in_bits: _ } => {
            vec![quote! {::arcium_client::idl::arcium::types::Output::ArcisPubkey}]
        }
        Value::Float { size_in_bits } => {
            if *size_in_bits != 64 {
                panic!("Unsupported float size: {}", size_in_bits);
            }
            vec![quote! {::arcium_client::idl::arcium::types::Output::PlaintextFloat}]
        }
        Value::Array(c) => c.iter().flat_map(raw_output_to_output_tokens).collect(),
        Value::Tuple(c) => c.iter().flat_map(raw_output_to_output_tokens).collect(),
        Value::Struct(c) => c.iter().flat_map(raw_output_to_output_tokens).collect(),
        Value::MBool => panic!("Raw encrypted outputs are not supported yet."),
        Value::MScalar { size_in_bits: _ } => {
            panic!("Raw encrypted outputs are not supported yet.")
        }
        Value::MFloat { size_in_bits: _ } => panic!("Raw encrypted outputs are not supported yet."),
    }
}

#[allow(dead_code)]
pub fn circuit_callback_discriminator(circuit_name: &str) -> [u8; 8] {
    let ix_name = format!("{}_callback", circuit_name);
    calc_ix_discriminator(&ix_name)
}

#[allow(dead_code)]
fn calc_ix_discriminator(ix_ident: &str) -> [u8; 8] {
    let preimage_str = format!("global:{}", ix_ident);
    let preimage = preimage_str.as_bytes();
    let mut hasher = Sha256::new();
    hasher.update(preimage);
    let hash = hasher.finalize();
    let mut res = [0u8; 8];
    res.copy_from_slice(&hash[..8]);
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_comp_def_offset() {
        let conf_ix_name = "add_together";
        let offset = comp_def_offset(conf_ix_name);
        assert_eq!(offset, 4005749700);
    }
}
