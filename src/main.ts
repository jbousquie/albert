// Required modules :
// cargo tauri add shell
// cargo tauri add @tauri-apps/api/core
// cargo tauri add process
// pnpm tauri add process
// pnpm tauri add store

import "./style.css";
import "./code_lang.ts";
import { languageCodes } from "./code_lang.ts";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { exit, relaunch } from "@tauri-apps/plugin-process";
import { load, Store } from "@tauri-apps/plugin-store";

// Version number
const VERSION = "0.5.3";

// Default chunk duration (in minutes)
const CHUNKDURATION = 10;

// Global variables for settings with defaults that will be updated by loadSettings()
let store: Store;
let storedChunkDuration = CHUNKDURATION;
let storedLanguage = "fr";
let storedNoProxy = false;

// Global variable to store the current file path
let currentFilePath = "";

// Create a sorted list of language codes for the dropdown
const sortedLanguageCodes = (() => {
  const preferredLanguages = [
    "fr",
    "en",
    "es",
    "de",
    "it",
    "nl",
    "da",
    "sv",
    "no",
    "pt",
    "pl",
    "ro",
    "sk",
  ];

  const allLanguages = Object.entries(languageCodes);

  const remainingLanguages = allLanguages
    .filter(([code]) => !preferredLanguages.includes(code))
    .sort((a, b) => a[1].localeCompare(b[1], "fr"));

  return [
    ...preferredLanguages.map((code) => [
      code,
      languageCodes[code as keyof typeof languageCodes],
    ]),
    ...remainingLanguages,
  ];
})();

// Initialize the app with settings from store
async function initializeApp() {
  try {
    store = await load("store.json");
    storedChunkDuration =
      (await store.get<number>("chunk_duration")) || CHUNKDURATION;
    storedLanguage = (await store.get<string>("language")) || "fr";
    storedNoProxy = (await store.get<boolean>("no_proxy")) || false;

    updateUIWithStoredSettings();
    await invoke("download_api_key");
    console.log("Settings loaded successfully");
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Update UI elements with stored settings
function updateUIWithStoredSettings() {
  const chunkDurationSlider = document.getElementById(
    "chunk-duration",
  ) as HTMLInputElement;
  const chunkDurationValue = document.getElementById(
    "chunk-duration-value",
  ) as HTMLDivElement;

  if (chunkDurationSlider && chunkDurationValue) {
    chunkDurationSlider.value = storedChunkDuration.toString();
    chunkDurationValue.textContent = storedChunkDuration.toString();
  }

  const languageSelect = document.getElementById(
    "transcription-language",
  ) as HTMLSelectElement;
  if (languageSelect) {
    languageSelect.value = storedLanguage;
  }

  const noProxyCheckbox = document.getElementById(
    "no-proxy",
  ) as HTMLInputElement;
  if (noProxyCheckbox) {
    noProxyCheckbox.checked = storedNoProxy;
  }
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <div class="logo-container">
      <img src="/assets/logo.png" alt="Albertine" class="logo" />
    </div>
    <div class="input-section">
      <label for="session-name">Nom de la transcription :</label>
      <input type="text" id="session-name" placeholder="ConseilIUT" maxlength="20">
      <p id="validation-message" class="validation-message"></p>
    </div>
    <div class="card" id="card-section" style="display: none;">
      <div id="file-drop-area" class="file-drop-area">
        <p>Glissez / déposez<br> votre fichier audio wav ou mp3 ici</p>
        <p>ou</p>
        <button id="file-select-button">Sélectionnez un fichier</button>
      </div>
      <div id="file-path-display" class="file-path-display">
        <p>Aucun fichier sélectionné</p>
      </div>
      <div>
        <button id="file-submit-button" hidden>Transcrire</button>
        <button id="file-cancel-button" hidden>Annuler</button>
      </div>
      <div id="log-message">
      </div>
      <div id="timer-display" class="timer-display">
        <span>Temps écoulé: </span>
        <span id="timer-value">00:00</span>
        <button id="fusion-button" class="fusion-button" title="Fusionner les différents morceaux de la transcriptions en un seul fichier global" hidden>Fusion</button>
      </div>
    </div>

    <!-- Settings Panel -->
    <div id="settings-panel" class="settings-panel">
      <div id="settings-tab" class="settings-tab">
        <img src="/assets/parametres.png" alt="Settings" />
      </div>
      <div class="settings-content">
        <div class="settings-header">
          <h2>Paramètres</h2>
          <button id="close-settings" class="close-settings">
            <img src="/assets/fleche-droite.png" alt="Close" />
          </button>
        </div>
        <div class="settings-body">
          <div class="settings-item">
            <div class="label-with-value">
              <label for="chunk-duration"><b>Durée en minutes de découpage du fichier audio</b></label>
              <div class="slider-value" id="chunk-duration-value">${CHUNKDURATION}</div>
            </div>
            <div class="slider-container">
              <input
                type="range"
                id="chunk-duration"
                min="2"
                max="12"
                value="${CHUNKDURATION}"
                step="1"
                class="slider"
                list="chunk-duration-ticks"
              >
              <datalist id="chunk-duration-ticks">
                ${Array.from({ length: 11 }, (_, i) => i + 2)
                  .map((val) => `<option value="${val}"></option>`)
                  .join("")}
              </datalist>
            </div>
            <div class="slider-ticks">
              ${Array.from({ length: 11 }, (_, i) => i + 2)
                .map((val) => `<span class="tick">${val}</span>`)
                .join("")}
            </div>
            <div class="chunk-duration-info">
              <p>Le fichier audio va être découpé en plusieurs fichiers audio plus courts avant d'être transmis successivement à Albert, le nom de l'IA de la DINUM, pour transcription. <br>
              Le temps de traitement d'Albert est d'environ 1 minute par fichier audio de 10 minutes ou encore de 1 minute par tranche de taille de 10 Mo pour un fichier mp3 ou de 100 Mo pour un fichier wav.<br>
              Ainsi, un fichier audio mp3 de 1 heure pourra par exemple être découpé en 6 fichiers audio de 10 minutes et prendra environ 6 minutes à être traité par Albert.<br>
              Chaque morceau fait l'objet d'une transcription séparée et sera enregistré le répertoire transcription_albertine du dossier Documents de votre ordinateur. Il est possible de fusionner les fichiers de chacune des parties en un seul fichier à la fin.</p>
            </div>
          </div>

          <!-- Language Selection -->
          <div class="settings-item">
            <label for="transcription-language"><b>Langue de la transcription :</b></label>
            <div class="select-container">
              <select id="transcription-language" class="language-select">
                ${sortedLanguageCodes
                  .map(
                    ([code, name]) =>
                      `<option value="${code}">${name}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <div class="language-info">
              <p>Sélectionnez la langue principalement parlée dans le fichier audio à transcrire.</p>
            </div>
          </div>

          <label for="no-proxy"><b>Paramètres de proxy</b></label>
          <div class="settings-item checkbox-setting">
            <label class="checkbox-label">
              <input
                type="checkbox"
                id="no-proxy"
                class="checkbox-input">
              <span class="checkbox-text">Ne pas utiliser le proxy du système</span>
            </label>
            <div class="checkbox-info">
              <p>Par défaut, ce logiciel utilise les paramètres proxy du système.<br>
              Ce proxy peut parfois avoir des limitations sur les temps de réponse (timeout) ou sur la taille des fichiers autorisée à l'envoi.<br>
              Si vous cochez cette case, le proxy du système ne sera pas utilisé et la connexion se fera directement à Albert, dans la mesure où votre ordinateur a accès directement à l'Internet.<br>
              </p>
          </div>
        </div>
        <div class="api-status-info">
          <p>État actuel des services Albert : <a href="#" id="api-status-link">Consulter</a></p>
        </div>
        <div class="version-info">
          <p>${VERSION}</p>
        </div>
      </div>
    </div>

    <!-- Reset Panel -->
    <div id="reset-panel" class="settings-panel">
      <div id="reset-tab" class="settings-tab" style="top: 140px;">
        <img src="/assets/refresh-arrow.png" alt="Reset" />
      </div>
      <div class="settings-content">
        <div class="settings-header">
          <h2>Réinitialisation</h2>
          <button id="close-reset" class="close-settings">
            <img src="/assets/fleche-droite.png" alt="Close" />
          </button>
        </div>
        <p class="reset-warning"><b>En cliquant sur l'un des boutons,<br>vous confirmez que vous voulez directement</b></p>
        <div class="settings-body">
          <div class="reset-options-container">
            <div class="reset-option">
              <div class="reset-icon-container">
                <img src="/assets/power-switch.png" alt="Quitter" class="reset-icon">
              </div>
              <div class="reset-label">QUITTER</div>
            </div>
            <div class="reset-option">
              <div class="reset-icon-container">
                <img src="/assets/refresh-arrow.png" alt="Réinitialiser" class="reset-icon">
              </div>
              <div class="reset-label">RÉINITIALISER</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// Get DOM elements
const sessionNameInput = document.getElementById(
  "session-name",
) as HTMLInputElement;
const validationMessage = document.getElementById(
  "validation-message",
) as HTMLParagraphElement;
const cardSection = document.getElementById("card-section") as HTMLDivElement;
const fileDropArea = document.getElementById(
  "file-drop-area",
) as HTMLDivElement;
const fileSelectButton = document.getElementById(
  "file-select-button",
) as HTMLButtonElement;
const filePathDisplay = document.getElementById(
  "file-path-display",
) as HTMLDivElement;
const timerValue = document.getElementById("timer-value") as HTMLSpanElement;
const languageSelect = document.getElementById(
  "transcription-language",
) as HTMLSelectElement;
const fusionButton = document.getElementById(
  "fusion-button",
) as HTMLButtonElement;

// Timer variables
let timerInterval: number | null = null;
let secondsElapsed = 0;

// Timer functions
function startTimer() {
  resetTimer();
  timerInterval = window.setInterval(() => {
    secondsElapsed++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTimer() {
  stopTimer();
  secondsElapsed = 0;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  timerValue.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Validate session name input
function validateSessionName(value: string): boolean {
  const regex = /^[a-zA-Z0-9_-]{4,20}$/;
  return regex.test(value);
}

// Function logMessage
function logMessage(message: string) {
  let logMessageDiv = document.getElementById("log-message") as HTMLDivElement;
  let logMessageContent = logMessageDiv.innerHTML;
  logMessageContent += `<p>${message}</p>`;
  logMessageDiv.innerHTML = logMessageContent;
  logMessageDiv.scrollTop = logMessageDiv.scrollHeight;
  console.log(message);
}

// Function to disable file input elements
function disableFileInputs() {
  fileDropArea.classList.add("disabled");
  fileSelectButton.disabled = true;
}

// Function to enable file input elements
function enableFileInputs() {
  fileDropArea.classList.remove("disabled");
  fileSelectButton.disabled = false;
}

// Session name input validation
sessionNameInput.addEventListener("input", () => {
  const value = sessionNameInput.value;

  if (validateSessionName(value)) {
    validationMessage.textContent = "";
    cardSection.style.display = "block";
  } else {
    cardSection.style.display = "none";

    if (value.length < 4) {
      validationMessage.textContent =
        "Le nom doit comporter au moins 4 caractères";
    } else if (value.length > 20) {
      validationMessage.textContent =
        "Le nom ne doit pas dépasser 20 caractères";
    } else if (!/^[a-zA-Z0-9_-]*$/.test(value)) {
      validationMessage.textContent =
        "Uniquement des lettres, des chiffres, le tiret et le souligné";
    } else {
      validationMessage.textContent = "Nom de transcription invalide";
    }
  }
});

// Function to handle the submit button click - defined once for the whole app
function handleSubmitButtonClick() {
  const submitButton = document.getElementById(
    "file-submit-button",
  ) as HTMLButtonElement;
  const cancelButton = document.getElementById(
    "file-cancel-button",
  ) as HTMLButtonElement;

  resetTimer();
  startTimer();

  disableFileInputs();

  submitButton.hidden = true;
  cancelButton.hidden = false;

  const sessionName = sessionNameInput.value;

  invoke<string[]>("split_file", {
    file_path: currentFilePath,
    session_name: sessionName,
    chunk_duration: chunkDuration,
  })
    .then((response) => {
      let length = response.length;
      let msgResponse =
        "Découpage du fichier audio en " +
        length.toString() +
        " morceaux de " +
        chunkDuration.toString() +
        " minutes maximum :<br><br>";
      for (let i = 0; i < length; i++) {
        msgResponse += `${response[i]}<br>`;
      }
      logMessage(msgResponse);
      send_chunks(response, chunkDuration);
    })
    .catch((error) => {
      logMessage("<br>Erreur lors du découpage du fichier audio :<br>" + error);
      stopTimer();
      submitButton.hidden = false;
      cancelButton.hidden = true;
      enableFileInputs();
    });
}

// Set up the submit button event handler just once during initialization
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();

  const submitButton = document.getElementById(
    "file-submit-button",
  ) as HTMLButtonElement;
  submitButton.addEventListener("click", handleSubmitButtonClick);

  const quitOption = document.querySelector(
    ".reset-option:nth-child(1)",
  ) as HTMLDivElement;
  const resetOption = document.querySelector(
    ".reset-option:nth-child(2)",
  ) as HTMLDivElement;

  if (quitOption) {
    quitOption.addEventListener("click", async () => {
      console.log("Quitting application...");
      await quitApp();
    });
  }

  if (resetOption) {
    resetOption.addEventListener("click", async () => {
      console.log("Restarting application...");
      await resetApp();
    });
  }
});

// Simplified handleFile function
function handleFile(filePath: string) {
  resetTimer();

  currentFilePath = filePath;

  const fileName = filePath.split("/").pop() || "";
  const fileExtension = fileName.split(".").pop() || "";
  const validExtensions = ["wav", "WAV", "mp3", "MP3"];
  let submitButton = document.getElementById(
    "file-submit-button",
  ) as HTMLButtonElement;

  submitButton.hidden = true;
  let msg = "";

  if (!validExtensions.includes(fileExtension)) {
    msg =
      "<b>Type de fichier non accepté.<p>Sélectionnez svp un fichier audio<br> avec l'extension .mp3 ou .wav</b>";
  } else {
    msg = `<p>Fichier sélectionné :<br><b> ${fileName}</b></p>`;
    submitButton.hidden = false;
  }
  filePathDisplay.innerHTML = msg;
}

let isCancelled = false;

document
  .getElementById("file-cancel-button")
  ?.addEventListener("click", async () => {
    if (await showConfirmationDialog()) {
      isCancelled = true;

      logMessage("Annulation en cours... Arrêt des transcriptions.");

      terminate(0);
    }
  });

async function showConfirmationDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "dialog-box";

    dialog.innerHTML = `
      <p>Confirmer l'annulation de la transcription OUI/NON ?</p>
      <div class="dialog-buttons">
        <button id="dialog-yes" class="dialog-button">OUI</button>
        <button id="dialog-no" class="dialog-button dialog-button-primary">NON</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    setTimeout(() => {
      const noButton = document.getElementById("dialog-no");
      if (noButton) noButton.focus();
    }, 0);

    const yesButton = document.getElementById("dialog-yes");
    const noButton = document.getElementById("dialog-no");

    if (yesButton) {
      yesButton.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(true);
      });
    }

    if (noButton) {
      noButton.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve(false);
      });

      noButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          document.body.removeChild(overlay);
          resolve(false);
        }
      });
    }

    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", escHandler);
        resolve(false);
      }
    });
  });
}

function send_chunks(chunks: string[], chunkDuration: number) {
  isCancelled = false;

  let length = chunks.length;
  let duration = length * chunkDuration * 0.1;
  let minutes = Math.floor(duration);
  let seconds = Math.round((duration - minutes) * 60);

  logMessage(
    "<br>Envoi des " +
      length.toString() +
      " morceaux successivement à Albert pour transcription.<br>Durée totale <i>maximum</i> estimée à environ <b>" +
      minutes.toString() +
      "' " +
      ("0" + seconds.toString()).slice(-2) +
      '"</b><br>Merci de patienter...<br><br>',
  );

  processChunksSequentially(chunks, 0, 0);
}

async function processChunksSequentially(
  chunks: string[],
  index: number,
  errors: number,
) {
  if (isCancelled) {
    logMessage("Transcription annulée par l'utilisateur.");
    return;
  }

  if (index >= chunks.length) {
    terminate(errors);
    return;
  }

  const path = chunks[index];
  const label =
    "Audio de " +
    (index * chunkDuration).toString() +
    " à " +
    ((index + 1) * chunkDuration).toString() +
    " minutes";

  await invoke<string>("send_chunk", {
    path,
    use_system_proxy: useSystemProxy,
    language: transcriptionLanguage,
    label: label,
  })
    .then((response) => {
      if (isCancelled) {
        logMessage("Transcription annulée par l'utilisateur.");
        return;
      }
      const n = index + 1;
      const msg = `fichier ${n} transcrit : ${response}`;
      addTranscriptionFile(response);
      logMessage(msg);
      processChunksSequentially(chunks, index + 1, errors);
    })
    .catch((error) => {
      if (isCancelled) {
        logMessage("Transcription annulée par l'utilisateur.");
        return;
      }
      logMessage(`Erreur pour le fichier ${index + 1}: ${error}`);
      processChunksSequentially(chunks, index + 1, errors + 1);
    });
}

function terminate(errors: number) {
  let msg = isCancelled ? "Transcription annulée" : "Transcription terminée";
  if (errors > 0 && !isCancelled) {
    msg += " avec " + errors.toString() + " fichiers en erreur";
  }
  msg += ".";
  logMessage(msg);

  let submitButton = document.getElementById(
    "file-submit-button",
  ) as HTMLButtonElement;
  let cancelButton = document.getElementById(
    "file-cancel-button",
  ) as HTMLButtonElement;
  lastSessionName = sessionNameInput.value;
  if (!isCancelled) {
    sessionNameInput.value = "";
  } else {
    sessionNameInput.focus();
  }
  filePathDisplay.innerHTML = "Aucun fichier sélectionné";

  invoke<string>("terminate_transcription", { cancelled: isCancelled })
    .then((response) => {
      logMessage(response);
      cancelButton.hidden = true;
      submitButton.hidden = false;
      stopTimer();
      enableFileInputs();

      if (!isCancelled && transcriptionFiles.length >= 2) {
        fusionButton.hidden = false;
      } else {
        fusionButton.hidden = true;
      }

      currentFilePath = "";

      if (isCancelled) {
        resetTranscriptionFiles();
      }
    })
    .catch((error) => {
      logMessage(
        "Erreur lors de la suppression des fichiers temporaires : " + error,
      );
      cancelButton.hidden = true;
      submitButton.hidden = false;
      stopTimer();
      enableFileInputs();
      fusionButton.hidden = true;
      resetTranscriptionFiles();

      currentFilePath = "";
    });
}

fileDropArea.addEventListener("dragenter", (event) => {
  event.preventDefault();
  event.stopPropagation();
  fileDropArea.classList.add("drag-over");
});

fileDropArea.addEventListener("dragleave", (event) => {
  event.preventDefault();
  event.stopPropagation();
  fileDropArea.classList.remove("drag-over");
});

let _unlisten: () => void;

async function setupDragDropListener() {
  _unlisten = await getCurrentWebviewWindow().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      const filePath = event.payload.paths[0];
      handleFile(filePath);
    }
  });
}

setupDragDropListener();

function cleanup() {
  if (_unlisten) {
    _unlisten();
    console.log("Drag-drop event listener removed");
  }
}

window.addEventListener("beforeunload", cleanup);

fileSelectButton.addEventListener("click", async (_event) => {
  const file = await open({
    multiple: false,
    directory: false,
    title: "Selectionnez un fichier mp3 ou wav",
    filters: [
      {
        name: "Audio Files",
        extensions: ["mp3", "MP3", "wav", "WAV"],
      },
    ],
  });
  if (file) {
    handleFile(file as string);
  }
});

async function concatFiles(files: string[], sessionName: string) {
  try {
    logMessage("Fusion des transcriptions en cours...");

    fusionButton.disabled = true;

    const outputFile = await invoke<string>("concat_transcription_files", {
      transcription_chunks: files,
      output_file: `${sessionName}_entier.txt`,
    });

    logMessage(`Fusion terminée. Fichier complet créé : ${outputFile}`);

    fusionButton.hidden = true;

    resetTranscriptionFiles();
  } catch (error) {
    logMessage(`Erreur lors de la fusion des transcriptions : ${error}`);

    fusionButton.disabled = false;
  }
}

async function resetApp() {
  await relaunch();
}

async function quitApp() {
  await exit(0);
}

fusionButton.addEventListener("click", () => {
  concatFiles(transcriptionFiles, lastSessionName);
});

const settingsPanel = document.getElementById(
  "settings-panel",
) as HTMLDivElement;
const settingsTab = document.getElementById("settings-tab") as HTMLDivElement;
const closeSettings = document.getElementById(
  "close-settings",
) as HTMLButtonElement;
const chunkDurationSlider = document.getElementById(
  "chunk-duration",
) as HTMLInputElement;
const chunkDurationValue = document.getElementById(
  "chunk-duration-value",
) as HTMLDivElement;
const noProxyCheckbox = document.getElementById("no-proxy") as HTMLInputElement;

const resetPanel = document.getElementById("reset-panel") as HTMLDivElement;
const resetTab = document.getElementById("reset-tab") as HTMLDivElement;
const closeReset = document.getElementById("close-reset") as HTMLButtonElement;

let useSystemProxy = true;
let chunkDuration = parseInt(chunkDurationSlider.value);
let transcriptionLanguage = languageSelect.value;
let transcriptionFiles: string[] = [];
let lastSessionName = "";

async function handleChunkDurationChange() {
  chunkDuration = parseInt(chunkDurationSlider.value);
  chunkDurationValue.textContent = chunkDurationSlider.value;
  if (store) {
    await store.set("chunk_duration", chunkDuration);
  }
}

async function handleLanguageChange() {
  transcriptionLanguage = languageSelect.value;
  if (store) {
    await store.set("language", transcriptionLanguage);
  }
  console.log(
    `Transcription language set to: ${transcriptionLanguage} (${languageCodes[transcriptionLanguage as keyof typeof languageCodes]})`,
  );
}

async function handleProxyChange() {
  useSystemProxy = !noProxyCheckbox.checked;
  if (store) {
    await store.set("no_proxy", !useSystemProxy);
  }
  console.log(`Use system proxy: ${useSystemProxy}`);
}

function openSettingsPanel() {
  settingsPanel.classList.add("open");
  resetTab.style.opacity = "0";
  resetTab.style.pointerEvents = "none";
}

function closeSettingsPanel() {
  settingsPanel.classList.remove("open");

  setTimeout(() => {
    settingsTab.style.opacity = "1";
    settingsTab.style.pointerEvents = "auto";
    resetTab.style.opacity = "1";
    resetTab.style.pointerEvents = "auto";
  }, 300);
}

function openResetPanel() {
  resetPanel.classList.add("open");
  settingsTab.style.opacity = "0";
  settingsTab.style.pointerEvents = "none";
}

function closeResetPanel() {
  resetPanel.classList.remove("open");

  setTimeout(() => {
    resetTab.style.opacity = "1";
    resetTab.style.pointerEvents = "auto";
    settingsTab.style.opacity = "1";
    settingsTab.style.pointerEvents = "auto";
  }, 300);
}

function resetTranscriptionFiles() {
  transcriptionFiles = [];
}

function addTranscriptionFile(filePath: string) {
  transcriptionFiles.push(filePath);
}

settingsTab.addEventListener("click", openSettingsPanel);
closeSettings.addEventListener("click", closeSettingsPanel);
chunkDurationSlider.addEventListener("input", handleChunkDurationChange);
languageSelect.addEventListener("change", handleLanguageChange);
noProxyCheckbox.addEventListener("change", handleProxyChange);

resetTab.addEventListener("click", openResetPanel);
closeReset.addEventListener("click", closeResetPanel);

document
  .getElementById("api-status-link")
  ?.addEventListener("click", async (e) => {
    e.preventDefault();
    await openExternal("https://albert.api.etalab.gouv.fr/status/api");
  });
