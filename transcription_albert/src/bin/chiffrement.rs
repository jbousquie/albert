use std::env;
use transcription_albert::encrypt_api_key;

/// Programme de chiffrement de la clé API Albert
fn main() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: chiffre <api_key>");
        return Err(String::from("Invalid arguments"));
    }
    let api_key = &args[1];

    let encrypted_api_key = encrypt_api_key(api_key);
    println!("{}", encrypted_api_key);
    Ok(())
}
