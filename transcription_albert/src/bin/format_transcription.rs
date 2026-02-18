use transcription_albert::format_transcription;

// Formatage de la transcription en texte lisible à partir du fichier json
// On récupère les chunks de texte  et on les fusionne en un seul texte

// usage cargo run --bin format_transcription <fichier_transcription_json> <fichier_transcription_texte>
// exemple
// cargo run --bin format_transcription audio_001.json audio_001.txt

fn main() {
    // Parse command line arguments
    let args: Vec<String> = std::env::args().collect();
    let (input_file, output_file) = if args.len() > 2 {
        (&args[1] as &str, &args[2] as &str)
    } else {
        ("audio_001.json", "audio_001.txt")
    };

    // Call the library function to format the transcription
    format_transcription(input_file, output_file, None);
}
