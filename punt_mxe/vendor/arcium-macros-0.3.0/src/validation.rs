use quote::ToTokens;
use syn::{Attribute, Data, Fields, FieldsNamed, GenericArgument, Path, PathArguments, Type};

pub type ValidateFunction = fn(&Type) -> bool;

// Required fields are a tuple of:
// - The account name
// - The validation function
// - Whether the account should be mutable
pub fn validate_struct_fields(
    data: &Data,
    required_fields: &[(&str, ValidateFunction, bool)],
) -> Result<(), String> {
    if let Data::Struct(data_struct) = data {
        if let Fields::Named(FieldsNamed { named, .. }) = &data_struct.fields {
            for (field, validate_fn, is_mut) in required_fields {
                if let Some(f) = named.iter().find(|f| f.ident.as_ref().unwrap() == field) {
                    if !validate_fn(&f.ty) {
                        return Err(format!("Invalid field type for field {:?}", field));
                    };
                    if *is_mut && !is_mut_account(&f.attrs) {
                        return Err(format!("Account {:?} must be mutable", field));
                    }
                } else {
                    return Err(format!("Missing required field: {:?}", field));
                }
            }
        }
    }

    Ok(())
}

pub fn is_valid_unchecked_account(ty: &Type) -> bool {
    match ty {
        Type::Path(type_path) => type_path.path.segments.last().is_some_and(|segment| {
            if segment.ident != "UncheckedAccount" {
                return false;
            }

            if let PathArguments::AngleBracketed(args) = &segment.arguments {
                return args.args.len() == 1
                    && matches!(args.args.first(), Some(GenericArgument::Lifetime(_)));
            }
            false
        }),
        _ => false,
    }
}

pub fn is_valid_system_program_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_program_type(ty) {
        is_system_prog_type(inner_type)
    } else {
        false
    }
}

pub fn is_valid_arcium_program_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_program_type(ty) {
        is_arcium_prog_type(inner_type)
    } else {
        false
    }
}

pub fn is_valid_signer_pda(ty: &Type) -> bool {
    if let Some(inner_type) = get_account_type(ty) {
        is_signer_acc_type(&inner_type)
    } else {
        false
    }
}

pub fn is_valid_signer_eoa(ty: &Type) -> bool {
    match ty {
        Type::Path(type_path) => type_path.path.segments.last().is_some_and(|segment| {
            if segment.ident != "Signer" {
                return false;
            }

            if let PathArguments::AngleBracketed(args) = &segment.arguments {
                return args.args.len() == 1
                    && matches!(args.args.first(), Some(GenericArgument::Lifetime(_)));
            }
            false
        }),
        _ => false,
    }
}

pub fn is_valid_mxe_acc_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_account_type(ty) {
        is_mxe_acc_type(&inner_type)
    } else {
        false
    }
}

pub fn is_valid_mempool_acc_type(ty: &Type) -> bool {
    is_valid_unchecked_account(ty)
}

pub fn is_valid_exec_pool_acc_type(ty: &Type) -> bool {
    is_valid_unchecked_account(ty)
}

pub fn is_valid_comp_acc_type(ty: &Type) -> bool {
    is_valid_unchecked_account(ty)
}

pub fn is_valid_comp_def_acc_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_account_type(ty) {
        is_comp_def_acc_type(&inner_type)
    } else {
        false
    }
}

pub fn is_valid_cluster_acc_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_account_type(ty) {
        is_cluster_acc_type(&inner_type)
    } else {
        false
    }
}

pub fn is_valid_pool_acc_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_account_type(ty) {
        is_pool_acc_type(&inner_type)
    } else {
        false
    }
}

pub fn is_valid_clock_acc_type(ty: &Type) -> bool {
    if let Some(inner_type) = get_account_type(ty) {
        is_clock_acc_type(&inner_type)
    } else {
        false
    }
}

pub fn always_valid_check(_ty: &Type) -> bool {
    true
}

// Not the prettiest way to do this (checking string representation of the attribute),
// but it works unless the user has some constraint that contains the sequence mut or signer and
// prevents us from having to write a custom parser for the anchor account attribute.
pub fn is_mut_account(attrs: &[Attribute]) -> bool {
    attrs.iter().any(|attr| {
        if attr.path().is_ident("account") {
            let attr_str = attr.to_token_stream().to_string();
            attr_str.contains("mut")
        } else {
            false
        }
    })
}

fn get_account_type(ty: &Type) -> Option<Path> {
    let path_no_box = strip_box_type(ty);

    match path_no_box {
        Type::Path(type_path) => type_path.path.segments.last().and_then(|segment| {
            if segment.ident != "Account" {
                return None;
            }

            if let PathArguments::AngleBracketed(args) = &segment.arguments {
                if args.args.len() == 2 {
                    return match (args.args.first(), args.args.last()) {
                        (
                            Some(GenericArgument::Lifetime(_)),
                            Some(GenericArgument::Type(Type::Path(path))),
                        ) => Some(path.path.clone()),
                        _ => None,
                    };
                }
            }
            None
        }),
        _ => None,
    }
}

fn get_program_type(ty: &Type) -> Option<&Path> {
    match ty {
        Type::Path(type_path) => type_path.path.segments.last().and_then(|segment| {
            if segment.ident != "Program" {
                return None;
            }

            if let PathArguments::AngleBracketed(args) = &segment.arguments {
                if args.args.len() == 2 {
                    return match (args.args.first(), args.args.last()) {
                        (
                            Some(GenericArgument::Lifetime(_)),
                            Some(GenericArgument::Type(Type::Path(path))),
                        ) => Some(&path.path),
                        _ => None,
                    };
                }
            }
            None
        }),
        _ => None,
    }
}

fn is_system_prog_type(path: &Path) -> bool {
    if path.segments.len() == 1 {
        path.segments[0].ident == "System"
    } else if path.segments.len() == 2 {
        path.segments[0].ident == "anchor_lang" && path.segments[1].ident == "System"
    } else {
        false
    }
}

fn is_arcium_prog_type(path: &Path) -> bool {
    path.segments.len() == 1 && path.segments[0].ident == "Arcium"
}

fn is_arcium_account_type(path: &Path, account_name: &str) -> bool {
    match path.segments.len() {
        1 => path.segments[0].ident == account_name,
        2 => path.segments[0].ident == "accounts" && path.segments[1].ident == account_name,
        3 => {
            path.segments[0].ident == "arcium"
                && path.segments[1].ident == "accounts"
                && path.segments[2].ident == account_name
        }
        4 => {
            path.segments[0].ident == "idl"
                && path.segments[1].ident == "arcium"
                && path.segments[2].ident == "accounts"
                && path.segments[3].ident == account_name
        }
        5 => {
            path.segments[0].ident == "arcium_client"
                && path.segments[1].ident == "idl"
                && path.segments[2].ident == "arcium"
                && path.segments[3].ident == "accounts"
                && path.segments[4].ident == account_name
        }
        _ => false,
    }
}

fn is_account_type(path: &Path, account_name: &str) -> bool {
    match path.segments.len() {
        1 => path.segments[0].ident == account_name,
        _ => false,
    }
}

fn is_mxe_acc_type(path: &Path) -> bool {
    is_arcium_account_type(path, "MXEAccount")
}

fn is_signer_acc_type(path: &Path) -> bool {
    is_account_type(path, "SignerAccount")
}

fn is_comp_def_acc_type(path: &Path) -> bool {
    is_arcium_account_type(path, "ComputationDefinitionAccount")
}

fn is_cluster_acc_type(path: &Path) -> bool {
    is_arcium_account_type(path, "Cluster")
}

fn is_pool_acc_type(path: &Path) -> bool {
    is_arcium_account_type(path, "FeePool")
}

fn is_clock_acc_type(path: &Path) -> bool {
    is_arcium_account_type(path, "ClockAccount")
}

fn strip_box(path: &Path) -> Path {
    if path.segments.len() == 1 && path.segments[0].ident == "Box" {
        // If the path is just Box<T>, return T
        if let PathArguments::AngleBracketed(args) = &path.segments[0].arguments {
            if let Some(GenericArgument::Type(Type::Path(inner_path))) = args.args.first() {
                return inner_path.path.clone();
            }
        }
    }
    path.clone() // Return the original path if it's not a Box
}

pub fn strip_box_type(ty: &Type) -> Type {
    match ty {
        Type::Path(path) => {
            let stripped_path = strip_box(&path.path);
            Type::Path(syn::TypePath {
                qself: None,
                path: stripped_path,
            })
        }
        _ => ty.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::{parse_quote, Path};

    #[test]
    fn test_strip_box() {
        // Test case: Box<T<V>>
        let path: Path = parse_quote! { Box<T<V>> };
        let result = strip_box(&path);
        assert_eq!(result.segments.len(), 1);
        assert_eq!(result.segments[0].ident.to_string(), "T");
        match &result.segments[0].arguments {
            PathArguments::AngleBracketed(args) => {
                assert_eq!(args.args.len(), 1);
                match &args.args[0] {
                    GenericArgument::Type(type_path) => {
                        if let Type::Path(type_path) = type_path {
                            assert_eq!(type_path.path.segments.len(), 1);
                            assert_eq!(type_path.path.segments[0].ident.to_string(), "V");
                        } else {
                            panic!("Expected a Type::Path");
                        }
                    }
                    _ => panic!("Expected a type argument"),
                }
            }
            _ => panic!("Expected angle-bracketed arguments"),
        }

        // Test case: T<V> (no Box)
        let non_box_path: Path = parse_quote! { T<V> };
        let non_box_result = strip_box(&non_box_path);
        assert_eq!(non_box_result.segments.len(), 1);
        assert_eq!(non_box_result.segments[0].ident.to_string(), "T");
        match &result.segments[0].arguments {
            PathArguments::AngleBracketed(args) => {
                assert_eq!(args.args.len(), 1);
                match &args.args[0] {
                    GenericArgument::Type(type_path) => {
                        if let Type::Path(type_path) = type_path {
                            assert_eq!(type_path.path.segments.len(), 1);
                            assert_eq!(type_path.path.segments[0].ident.to_string(), "V");
                        } else {
                            panic!("Expected a Type::Path");
                        }
                    }
                    _ => panic!("Expected a type argument"),
                }
            }
            _ => panic!("Expected angle-bracketed arguments"),
        }
    }
}
