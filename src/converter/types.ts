export type ExcalidrawElementType =
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "draw"
  | "text";

export type ExcalidrawArrowhead = "arrow" | "bar" | "dot" | null;

export interface ExcalidrawBaseElement {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid";
  strokeWidth: number;
  strokeStyle: "solid";
  strokeSharpness: "sharp" | "round";
  roughness: number;
  opacity: number;
  width: number;
  height: number;
  angle: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: string[];
  boundElementIds: null;
}

export interface ExcalidrawRectangleElement extends ExcalidrawBaseElement {
  type: "rectangle";
}

export interface ExcalidrawEllipseElement extends ExcalidrawBaseElement {
  type: "ellipse";
}

export interface ExcalidrawLineElement extends ExcalidrawBaseElement {
  type: "line";
  points: [number, number][];
}

export interface ExcalidrawDrawElement extends ExcalidrawBaseElement {
  type: "draw";
  points: [number, number][];
}

export interface ExcalidrawArrowElement extends ExcalidrawBaseElement {
  type: "arrow";
  points: [number, number][];
  startBinding: null;
  endBinding: null;
  startArrowhead: ExcalidrawArrowhead;
  endArrowhead: ExcalidrawArrowhead;
}

export interface ExcalidrawTextElement extends ExcalidrawBaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: 2;
  baseline: number;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle";
  lineHeight: number;
  originalText: string;
}

export type ExcalidrawElement =
  | ExcalidrawRectangleElement
  | ExcalidrawEllipseElement
  | ExcalidrawLineElement
  | ExcalidrawArrowElement
  | ExcalidrawDrawElement
  | ExcalidrawTextElement;

export interface ExcalidrawDocument {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
}
