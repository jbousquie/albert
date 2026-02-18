use std::env;
use transcription_albert::transcribe_audio;

// Programme de transcription d'un fichier audio en texte
// Utilise l'API d'Albert pour la transcription
// https://albert.api.etalab.gouv.fr/

// usage : cargo run --bin transcription <fichier_audio> <fichier_transcription_json> <API_key_file> [--no-proxy]
// exemple : cargo run --bin transcription audio_chunks/audio_001.mp3 audio_001.json ./albertine.key
// exemple : cargo run --bin transcription audio_chunks/audio_001.mp3 audio_001.json ./albertine.key --no-proxy

fn main() -> Result<(), reqwest::Error> {
    // Parse command line arguments
    let args: Vec<String> = env::args().collect();

    // Check if --no-proxy flag is present
    let use_system_proxy = !args.iter().any(|arg| arg == "--no-proxy");

    // Filter out the --no-proxy flag for file arguments
    let filtered_args: Vec<&String> = args.iter().filter(|&arg| arg != "--no-proxy").collect();

    let (input_file, output_file, key_file) = if filtered_args.len() > 3 {
        (
            filtered_args[1].as_str(),
            filtered_args[2].as_str(),
            filtered_args[3].as_str(),
        )
    } else {
        (
            "audio_chunks/audio_001.mp3",
            "audio_001.txt",
            "albertine.key",
        )
    };

    println!("Using system proxy: {}", use_system_proxy);

    // Call the library function to perform the transcription
    transcribe_audio(input_file, output_file, key_file, use_system_proxy)
}
