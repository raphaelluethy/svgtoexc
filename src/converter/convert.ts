import { DOMParser } from "linkedom";
import type { ExcalidrawBaseElement, ExcalidrawDocument, ExcalidrawElement } from "./types";
import { svgConverters } from "./svg/converters";
import { createStyleContext } from "./svg/style";

type SvgElement = any;

const SUPPORTED_TAGS = [
  "rect",
  "circle",
  "ellipse",
  "line",
  "polygon",
  "polyline",
  "path",
  "text",
];
const EXCALIDRAW_SOURCE = "https://excalidraw.com";
const NON_RENDERED_CONTAINER_TAGS = new Set([
  "defs",
  "symbol",
  "clipPath",
  "mask",
  "marker",
  "pattern",
  "lineargradient",
  "radialgradient",
  "filter",
]);

function parseInlineStyle(styleText: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!styleText) {
    return map;
  }

  for (const declaration of styleText.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const key = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim().toLowerCase();
    if (key && value) {
      map.set(key, value);
    }
  }

  return map;
}

function hasNonRenderedAncestor(element: SvgElement): boolean {
  let current: SvgElement | null = element;

  while (current) {
    const tagName = (current.tagName ?? "").toLowerCase();
    if (NON_RENDERED_CONTAINER_TAGS.has(tagName)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function isVisuallyHidden(element: SvgElement): boolean {
  let current: SvgElement | null = element;

  while (current) {
    const display = (current.getAttribute("display") ?? "").trim().toLowerCase();
    const visibility = (current.getAttribute("visibility") ?? "").trim().toLowerCase();
    const opacityAttr = (current.getAttribute("opacity") ?? "").trim();

    const styleMap = parseInlineStyle(current.getAttribute("style"));
    const styleDisplay = styleMap.get("display");
    const styleVisibility = styleMap.get("visibility");
    const styleOpacity = styleMap.get("opacity");

    if (display === "none" || styleDisplay === "none") {
      return true;
    }

    if (visibility === "hidden" || styleVisibility === "hidden") {
      return true;
    }

    const opacityValue =
      styleOpacity !== undefined
        ? Number.parseFloat(styleOpacity)
        : opacityAttr
          ? Number.parseFloat(opacityAttr)
          : Number.NaN;

    if (!Number.isNaN(opacityValue) && opacityValue <= 0) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function shouldConvertNode(node: SvgElement): boolean {
  if (hasNonRenderedAncestor(node)) {
    return false;
  }

  if (isVisuallyHidden(node)) {
    return false;
  }

  return true;
}

function randomId(): string {
  return (
    Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 15)
  );
}

function randomInteger(): number {
  return Math.floor(Math.random() * 2147483647);
}

function createBaseElement(): ExcalidrawBaseElement {
  return {
    id: randomId(),
    type: "line",
    x: 0,
    y: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    strokeSharpness: "sharp",
    roughness: 0,
    opacity: 100,
    width: 0,
    height: 0,
    angle: 0,
    seed: randomInteger(),
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
    groupIds: [],
    boundElementIds: null,
  };
}

function parseSvg(svgMarkup: string): SvgElement {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgMarkup, "image/svg+xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    const errorText = (parserError.textContent ?? "Malformed SVG input.").trim();
    throw new Error(`SVG parsing error: ${errorText}`);
  }

  const svgRoot = document.querySelector("svg") as SvgElement | null;
  if (!svgRoot) {
    throw new Error("Input does not contain a valid <svg> root element.");
  }

  return svgRoot;
}

export function convertSvgToExcalidraw(svgMarkup: string): ExcalidrawDocument {
  const svgRoot = parseSvg(svgMarkup);
  const styleContext = createStyleContext(svgRoot);
  const selector = SUPPORTED_TAGS.join(", ");
  const nodes = (Array.from(svgRoot.querySelectorAll(selector)) as SvgElement[]).filter(
    shouldConvertNode,
  );

  const elements: ExcalidrawElement[] = [];
  for (const node of nodes) {
    const converter = svgConverters[node.tagName.toLowerCase()];
    if (!converter) {
      continue;
    }

    const conversion = converter(node, { styleContext }, createBaseElement);
    if (!conversion) {
      continue;
    }

    if (Array.isArray(conversion)) {
      elements.push(...conversion);
    } else {
      elements.push(conversion);
    }
  }

  return {
    type: "excalidraw",
    version: 2,
    source: EXCALIDRAW_SOURCE,
    elements,
  };
}
