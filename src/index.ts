import {
  Box,
  createCliRenderer,
  Text,
  TextAttributes,
} from "@opentui/core";
import { convertSvgToExcalidraw } from "./converter/convert";
import { copyToClipboard } from "./io/clipboard";
import { detectInputMode, resolveSvgInput } from "./io/input";

const renderer = await createCliRenderer({ exitOnCtrlC: true });

type UiStatus = "idle" | "working" | "success" | "error";

interface AppState {
  rawInput: string;
  modeLabel: string;
  resolvedPath: string | null;
  latestJson: string | null;
  latestElementCount: number;
  status: UiStatus;
  statusMessage: string;
  clipboardMessage: string;
}

const state: AppState = {
  rawInput: "",
  modeLabel: "unknown",
  resolvedPath: null,
  latestJson: null,
  latestElementCount: 0,
  status: "idle",
  statusMessage: "Paste SVG markup or drop an SVG path into the terminal.",
  clipboardMessage: "",
};

let isBusy = false;

function buildPreview(text: string): string {
  if (!text.trim()) {
    return "(empty)";
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 92) {
    return compact;
  }

  return `${compact.slice(0, 89)}...`;
}

function setDetectedMode(rawInput: string): void {
  const detection = detectInputMode(rawInput);
  state.modeLabel = detection.mode;
  state.resolvedPath = detection.normalizedPath ?? null;
}

function renderScreen(): void {
  const appId = "app-root";
  if (renderer.root.getRenderable(appId)) {
    renderer.root.remove(appId);
  }

  const statusPrefix =
    state.status === "success"
      ? "ok"
      : state.status === "error"
        ? "error"
        : state.status === "working"
          ? "working"
          : "idle";

  const infoLines = [
    `Shortcuts: enter convert | c copy last JSON | r reset | q quit`,
    `Input mode: ${state.modeLabel}`,
    `Resolved path: ${state.resolvedPath ?? "-"}`,
    `Input preview: ${buildPreview(state.rawInput)}`,
    `Result: ${state.latestJson ? `${state.latestElementCount} elements` : "-"}`,
    `Status (${statusPrefix}): ${state.statusMessage}`,
    `Clipboard: ${state.clipboardMessage || "-"}`,
  ].join("\n");

  renderer.root.add(
    Box(
      {
        id: appId,
        flexDirection: "column",
        padding: 1,
        gap: 1,
      },
      Text({
        content: "SVG to Excalidraw TUI",
        attributes: TextAttributes.BOLD,
      }),
      Text({ content: infoLines, attributes: TextAttributes.DIM }),
    ),
  );
}

async function convertCurrentInput(): Promise<void> {
  if (isBusy) {
    return;
  }

  if (!state.rawInput.trim()) {
    state.status = "error";
    state.statusMessage = "Nothing to convert yet. Paste SVG markup or drop an SVG path first.";
    renderScreen();
    return;
  }

  isBusy = true;
  state.status = "working";
  state.statusMessage = "Converting input to Excalidraw JSON...";
  renderScreen();

  try {
    const resolved = await resolveSvgInput(state.rawInput);
    state.modeLabel = resolved.mode;
    state.resolvedPath = resolved.normalizedPath ?? null;

    const document = convertSvgToExcalidraw(resolved.svg);
    const json = JSON.stringify(document, null, 2);

    state.latestJson = json;
    state.latestElementCount = document.elements.length;
    state.status = "success";
    state.statusMessage = `Converted successfully with ${document.elements.length} elements.`;

    try {
      await copyToClipboard(json);
      state.clipboardMessage = "Copied to clipboard with pbcopy.";
    } catch (clipboardError) {
      const message =
        clipboardError instanceof Error
          ? clipboardError.message
          : "Clipboard copy failed for an unknown reason.";
      state.clipboardMessage = message;
      state.status = "error";
      state.statusMessage =
        "Conversion worked, but clipboard copy failed. Press c to retry after fixing pbcopy.";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown conversion error.";
    state.status = "error";
    state.statusMessage = message;
  } finally {
    isBusy = false;
    renderScreen();
  }
}

async function copyLatestResult(): Promise<void> {
  if (!state.latestJson) {
    state.status = "error";
    state.statusMessage = "No converted JSON available yet. Convert something first with enter.";
    renderScreen();
    return;
  }

  try {
    await copyToClipboard(state.latestJson);
    state.status = "success";
    state.statusMessage = "Copied latest JSON again.";
    state.clipboardMessage = "Copied to clipboard with pbcopy.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clipboard copy failed.";
    state.status = "error";
    state.statusMessage = `Copy failed: ${message}`;
    state.clipboardMessage = message;
  }

  renderScreen();
}

function resetState(): void {
  state.rawInput = "";
  state.modeLabel = "unknown";
  state.resolvedPath = null;
  state.latestJson = null;
  state.latestElementCount = 0;
  state.status = "idle";
  state.statusMessage = "State reset. Paste a new SVG markup or file path.";
  state.clipboardMessage = "";
  renderScreen();
}

setDetectedMode(state.rawInput);
renderScreen();

renderer.keyInput.on("paste", (event) => {
  state.rawInput = event.text;
  setDetectedMode(event.text);
  state.status = "idle";
  state.statusMessage = "Input captured. Press enter to convert.";
  renderScreen();
});

renderer.keyInput.on("keypress", (event) => {
  const name = event.name.toLowerCase();

  if (name === "return" || name === "enter") {
    void convertCurrentInput();
    return;
  }

  if (name === "c") {
    void copyLatestResult();
    return;
  }

  if (name === "r") {
    resetState();
    return;
  }

  if (name === "q") {
    renderer.destroy();
    process.exit(0);
  }
});
