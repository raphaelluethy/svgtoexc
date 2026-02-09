import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type InputMode = "svg-markup" | "file-path" | "unknown";

export interface InputDetectionResult {
  mode: InputMode;
  normalizedPath?: string;
}

export interface ResolvedInput {
  mode: "svg-markup" | "file-path";
  svg: string;
  normalizedPath?: string;
}

const SVG_PATTERN = /<svg[\s>]/i;

export function isSvgMarkup(input: string): boolean {
  return SVG_PATTERN.test(input);
}

export function normalizeDroppedPath(input: string): string {
  let normalized = input.trim();

  if (!normalized) {
    return normalized;
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  if (normalized.startsWith("file://")) {
    normalized = decodeURIComponent(normalized.replace(/^file:\/\//, ""));
  }

  normalized = normalized.replace(/\\ /g, " ");
  normalized = normalized.replace(/\\([()'"\\])/g, "$1");

  if (normalized.startsWith("~/")) {
    normalized = path.join(homedir(), normalized.slice(2));
  }

  return path.normalize(normalized);
}

function looksLikeFilePath(input: string): boolean {
  if (!input || input.includes("\n")) {
    return false;
  }

  return (
    input.startsWith("/") ||
    input.startsWith("~/") ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    /\.svg$/i.test(input) ||
    /^[A-Za-z]:\\/.test(input)
  );
}

export function detectInputMode(input: string): InputDetectionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { mode: "unknown" };
  }

  if (isSvgMarkup(trimmed)) {
    return { mode: "svg-markup" };
  }

  const normalizedPath = normalizeDroppedPath(trimmed);
  if (looksLikeFilePath(normalizedPath)) {
    return { mode: "file-path", normalizedPath };
  }

  return { mode: "unknown" };
}

export async function resolveSvgInput(rawInput: string): Promise<ResolvedInput> {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    throw new Error("No input detected. Paste SVG markup or drop an SVG file path.");
  }

  if (isSvgMarkup(trimmed)) {
    return { mode: "svg-markup", svg: trimmed };
  }

  const normalizedPath = normalizeDroppedPath(trimmed);

  if (!looksLikeFilePath(normalizedPath)) {
    throw new Error(
      "Input is neither SVG markup nor a valid-looking file path. Paste <svg ...> or drop a .svg file.",
    );
  }

  if (!existsSync(normalizedPath)) {
    throw new Error(`SVG file not found: ${normalizedPath}`);
  }

  const stats = statSync(normalizedPath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${normalizedPath}`);
  }

  const svg = await readFile(normalizedPath, "utf8");
  if (!isSvgMarkup(svg)) {
    throw new Error(`File does not look like SVG markup: ${normalizedPath}`);
  }

  return {
    mode: "file-path",
    svg,
    normalizedPath,
  };
}
