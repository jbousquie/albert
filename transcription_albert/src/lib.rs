use reqwest::blocking;
use reqwest::blocking::multipart;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Duration;

// For async functionality
use tokio::fs as tokio_fs;

// Shared JSON structures
#[derive(Deserialize, Serialize)]
pub struct JSONChunk {
    pub timestamp: [f64; 2],
    pub text: String,
}

#[derive(Deserialize, Serialize)]
pub struct JSONResponse {
    pub text: String,
    #[serde(default)]
    pub chunks: Option<Vec<JSONChunk>>,
}

// Configuration constants
pub const API_URL: &str = "https://albert.api.etalab.gouv.fr/v1/audio/transcriptions";
pub const URL_API_KEY: &str = "https://llm.iut-rodez.fr/albert/albertine.key";
pub const KEY_FILEPATH: &str = "./albertine.key";

/// Simple XOR encryption key used for basic obfuscation
const ENCRYPTION_KEY: u8 = 42;

/// Encrypts a string using a simple XOR cipher and encodes it as base64
///
/// # Arguments
/// * `input` - The string to encrypt
///
/// # Returns
/// The encrypted string encoded in base64
pub fn encrypt_api_key(input: &str) -> String {
    // XOR each byte with the encryption key
    let encrypted_bytes: Vec<u8> = input.bytes().map(|byte| byte ^ ENCRYPTION_KEY).collect();

    // Convert to base64 for storage/transmission
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, encrypted_bytes)
}

/// Decrypts a base64-encoded XOR-encrypted string
///
/// # Arguments
/// * `encrypted_input` - The base64-encoded encrypted string
///
/// # Returns
/// The decrypted original string, or an empty string if decryption fails
pub fn decrypt_api_key(encrypted_input: &str) -> String {
    // Decode from base64
    if let Ok(decoded) =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encrypted_input)
    {
        // XOR each byte with the same key to get the original value
        let decrypted_bytes: Vec<u8> = decoded.iter().map(|byte| byte ^ ENCRYPTION_KEY).collect();

        // Convert back to a string
        if let Ok(result) = String::from_utf8(decrypted_bytes) {
            return result;
        }
    }

    // Return empty string if decryption fails
    String::new()
}

/// Gets the decrypted API key for use in API requests
pub fn get_api_key(filepath: &str) -> String {
    let encrypted_key = read_encrypted_api_key(filepath).unwrap_or(String::new());
    let mut clean_key = encrypted_key.clone();
    if clean_key.ends_with('\n') {
        clean_key.pop();
    }
    decrypt_api_key(&clean_key)
}

/// Reads the encrypted API key from a file
pub fn read_encrypted_api_key(filepath: &str) -> Result<String, std::io::Error> {
    let path = Path::new(filepath);
    if path.exists() {
        std::fs::read_to_string(filepath)
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("File not found: {}", filepath),
        ))
    }
}

// Functions for transcription
/// Transcribes an audio file using the Albert API and saves the result to a JSON file
///
/// # Arguments
/// * `input_file` - Path to the audio file to transcribe
/// * `output_file` - Path where the JSON transcription will be saved
/// * `key_file` - Path to the file containing the encrypted API key
/// * `use_system_proxy` - Whether to use system proxy settings (true) or make direct connections (false)
///
/// # Returns
/// A Result indicating success or containing a reqwest::Error
pub fn transcribe_audio(
    input_file: &str,
    output_file: &str,
    key_file: &str,
    use_system_proxy: bool,
) -> Result<(), reqwest::Error> {
    // Création du client HTTP
    let client: blocking::Client;
    // Si use_system_proxy est vrai, on utilise le proxy système
    // Sinon, on désactive le proxy

    if !use_system_proxy {
        client = blocking::Client::builder()
            .no_proxy()
            .build()
            .expect("Erreur de création du client HTTP sans proxy");
    } else {
        client = blocking::Client::new();
    }

    // l'API d'Albert attend un formulaire multipart
    let form = multipart::Form::new()
        .text("model", "openai/whisper-large-v3")
        .file("file", input_file)
        .expect("Erreur création du formulaire");

    // Get the decrypted API key
    let api_key = get_api_key(key_file);

    // Envoi de la requête POST de transcription
    let response = client
        .post(API_URL)
        .timeout(Duration::from_secs(600))
        .header("Authorization", format!("Bearer {}", api_key))
        //.header("Accept", "application/json")
        .multipart(form)
        .send()
        .expect("Impossible d'obtenir la réponse à la requête de transcription");

    // Vérification réponse OK
    if response.status().is_success() {
        println!(">>> Transcription OK");

        // Sauvegarde de la transcription dans un fichier JSON
        let response_text: String = response.text().unwrap().to_string();
        fs::write(output_file, response_text.as_bytes()).expect(&format!(
            "Impossible d'écrire le fichier de sortie {}",
            output_file
        ));
        println!("fichier de transcription JSON créé : {}", output_file);
    } else {
        println!(">>> Erreur de transcription : {:?}", response);
    }

    Ok(())
}

/// Transcribes an audio file using the Albert API and saves the result to a JSON file
/// This is the asynchronous version of the transcribe_audio function
///
/// # Arguments
/// * `input_file` - Path to the audio file to transcribe
/// * `output_file` - Path where the JSON transcription will be saved
/// * `key_file` - Path to the file containing the API key
/// * `use_system_proxy` - Whether to use system proxy settings (true) or make direct connections (false)
/// * `language` - Two-letter language code for the transcription (default: "fr")
///
/// # Returns
/// A Result indicating success or containing a reqwest::Error
pub async fn transcribe_audio_async(
    input_file: &str,
    output_file: &str,
    key_file: &str,
    use_system_proxy: bool,
    language: &str,
) -> Result<(), reqwest::Error> {
    // Création du client HTTP asynchrone
    let client: reqwest::Client;

    // Si use_system_proxy est vrai, on utilise le proxy système
    // Sinon, on désactive le proxy
    if !use_system_proxy {
        client = reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("Erreur de création du client HTTP sans proxy");
    } else {
        client = reqwest::Client::new();
    }

    // Lecture du fichier en mémoire
    let file_content = tokio::fs::read(input_file).await.expect(&format!(
        "Impossible de lire le fichier d'entrée {}",
        input_file
    ));

    // Création du fichier pour le formulaire multipart
    let file_part = reqwest::multipart::Part::bytes(file_content).file_name(input_file.to_string());
    //.mime_str("audio/mpeg")
    //.expect("Erreur lors de la création de la multipart du fichier");

    // l'API d'Albert attend un formulaire multipart
    let form = reqwest::multipart::Form::new()
        .text("model", "openweight-audio")
        .text("language", language.to_string())
        .part("file", file_part);

    // Get the decrypted API key
    let api_key = get_api_key(key_file);

    // Envoi de la requête POST de transcription
    let response = client
        .post(API_URL)
        .timeout(Duration::from_secs(600))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json")
        .multipart(form)
        .send()
        .await
        .expect("Impossible d'obtenir la réponse à la requête de transcription");

    // Vérification réponse OK
    if response.status().is_success() {
        println!(">>> Transcription OK");

        // Sauvegarde de la transcription dans un fichier JSON
        // si le chemin du fichier de sortie n'existe pas, on le crée
        let output_path = std::path::Path::new(output_file);
        if let Some(parent) = output_path.parent() {
            if !parent.exists() {
                tokio_fs::create_dir_all(parent).await.expect(&format!(
                    "Impossible de créer le répertoire {}",
                    parent.display()
                ));
            }
        }
        let response_text = response.text().await.unwrap();
        tokio_fs::write(output_file, response_text.as_bytes())
            .await
            .expect(&format!(
                "Impossible d'écrire le fichier de sortie {}",
                output_file
            ));
        println!("fichier de transcription JSON créé : {}", output_file);
    } else {
        println!(">>> Erreur de transcription : {:?}", response);
    }

    Ok(())
}

/// Downloads the encryped API key and write it to a file
pub async fn download_encrypted_api_key(output_file: &str) {
    let response = reqwest::get(URL_API_KEY)
        .await
        .expect("Impossible de récupérer la clé API");

    let response_text = response.text().await.unwrap();
    tokio_fs::write(output_file, response_text.as_bytes())
        .await
        .expect(&format!(
            "Impossible d'écrire la clé dans le fichier de sortie {}",
            output_file
        ));
    println!("clé API téléchargée et écrite dans {}", output_file);
}

// Functions for formatting the transcription
pub fn format_transcription(input_file: &str, output_file: &str, header: Option<&str>) {
    // Lecture du fichier de transcription JSON
    let response = fs::read_to_string(input_file)
        .expect("Impossible de lire le fichier de transcription JSON");

    // Désérialisation du JSON
    let response_json: JSONResponse =
        serde_json::from_str(&response).expect("Failed to parse JSON response");

    // Récupération des chunks de texte
    let response_text = if let Some(chunks) = response_json.chunks {
        // Ancien format avec chunks : utiliser les timestamps pour la mise en forme
        let mut text_chunks: Vec<String> = Vec::new();
        let mut last_ts = 0.0;
        for chunk in chunks {
            text_chunks.push(chunk.text);
            // on saute une ligne si le timestamp d'un chunk est inférieur à celui du précédent
            let ts = chunk.timestamp[0];
            if ts <= last_ts {
                text_chunks.push("\n".to_string());
            }
            last_ts = ts;
        }
        text_chunks.join("\n")
    } else {
        // Nouveau format sans chunks : utiliser directement le texte
        response_json.text
    };

    let line_header = "-------------------------------------------------------------------------------------------------------------------";
    let line_footer = "-------------------------------------------------------------------------------------------------------------------";
    let h = header.unwrap_or(" ");
    // Première ligne du fichier de sortie qui contient le nom du fichier et éventuellement le header transmis
    let first_line = format!(
        "{}\n{}\n{}\n{}\n\n",
        line_header, output_file, h, line_footer
    );
    let text = first_line + &response_text + " \n\n\n";

    fs::write(output_file, text.as_bytes()).expect(&format!(
        "Impossible d'écrire le fichier texte de sortie {}",
        output_file
    ));
    println!("fichier de transcription texte créé : {}", output_file);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let original = "test-api-key-123";
        let encrypted = encrypt_api_key(original);
        let decrypted = decrypt_api_key(&encrypted);
        assert_eq!(original, decrypted);
    }
}
