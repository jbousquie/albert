# Transcription Albert

A Rust library and set of command-line tools for transcribing audio files using the Albert API (https://albert.api.etalab.gouv.fr/) and formatting the resulting transcriptions.

## Features

- Transcribe audio files to JSON using the Albert API (both synchronous and asynchronous)
- Format JSON transcriptions into readable text files
- Available both as a library and as command-line utilities
- Optional system proxy support for network connections
- Language selection for async transcription

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
transcription_albert = { path = "/path/to/transcription_albert" }
tokio = { version = "1.35.1", features = ["full"] }  # If you need async functionality
```

## Command-line Usage

### Audio Transcription

Transcribe an audio file into a JSON file containing the transcription:

```bash
cargo run --bin transcription <audio_file> <json_output_file> <key_file_path>
```

Example:
```bash
cargo run --bin transcription audio_chunks/audio_001.mp3 audio_001.json ./AlbertAPI_crypted.key
```

If no arguments are provided, it defaults to:
```bash
cargo run --bin transcription audio_chunks/audio_001.mp3 audio_001.txt ./albertine.key
```

The binary uses system proxy settings by default.

### Transcription Formatting

Convert the JSON transcription into a readable text format:

```bash
cargo run --bin format_transcription <json_transcription_file> <text_output_file>
```

Example:
```bash
cargo run --bin format_transcription audio_001.json audio_001.txt
```

If no arguments are provided, it defaults to:
```bash
cargo run --bin format_transcription audio_001.json audio_001.txt
```

## Library Usage

You can also use this crate as a library in your Rust projects:

### Synchronous API

```rust
use transcription_albert::{transcribe_audio, format_transcription};

// Transcribe an audio file to a JSON file using system proxy
transcribe_audio("input.mp3", "output.json", "./albertine.key", true)?;

// Transcribe an audio file to a JSON file without using system proxy
transcribe_audio("input.mp3", "output.json", "./albertine.key", false)?;

// Format a JSON transcription to text
format_transcription("output.json", "output.txt", Some("Transcription de l'audio"));
```

### Asynchronous API

```rust
use transcription_albert::transcribe_audio_async;

// Inside an async function or block:
async {
    // Transcribe an audio file to a JSON file using system proxy with French language
    transcribe_audio_async("input.mp3", "output.json", "./albertine.key", true, "fr").await?;

    // Transcribe an audio file to a JSON file without using system proxy with English language
    transcribe_audio_async("input.mp3", "output.json", "./albertine.key", false, "en").await?;

    // You can specify other language codes like Spanish ("es"), German ("de"), etc.
}
```

### Available Functions

- `transcribe_audio(input_file: &str, output_file: &str, key_file_path: &str, use_system_proxy: bool) -> Result<(), reqwest::Error>`:
  Transcribes an audio file to JSON using Albert API in a blocking manner.

- `transcribe_audio_async(input_file: &str, output_file: &str, key_file_path: &str, use_system_proxy: bool, language: &str) -> Result<(), reqwest::Error>`:
  Transcribes an audio file to JSON using Albert API asynchronously. The `language` parameter allows you to specify the language of the audio content using a two-letter language code (e.g., "fr" for French, "en" for English).

- `format_transcription(input_file: &str, output_file: &str, header: Option<&str>)`:
  Formats a JSON transcription file into readable text.

The `use_system_proxy` parameter controls whether to use system proxy settings or to make direct connections.

### Data Structures

The library also exports these data structures:

```rust
pub struct JSONChunk {
    pub timestamp: [f64; 2],
    pub text: String,
}

pub struct JSONResponse {
    pub text: String,
    pub chunks: Vec<JSONChunk>,
}
```

## License

This project is proprietary and intended for use by Université Toulouse 1 Capitole - IUT de Rodez.
