import type {
  ExcalidrawArrowElement,
  ExcalidrawArrowhead,
  ExcalidrawBaseElement,
  ExcalidrawDrawElement,
  ExcalidrawElement,
  ExcalidrawLineElement,
  ExcalidrawTextElement,
} from "../types";
import { type Point, dimensionsFromPoints, getBoundingBox } from "./geometry";
import { convertPathToSubpaths } from "./path";
import {
  type StyleContext,
  getFillColor,
  getNumericAttribute,
  getNumericPresentationValue,
  getPresentationValue,
  getStrokeColor,
} from "./style";
import { getAccumulatedTransform, transformPoints } from "./transform";

type SvgElement = any;

export interface ConverterContext {
  styleContext: StyleContext;
}

export type SvgTagConverter = (
  element: SvgElement,
  context: ConverterContext,
  createBaseElement: () => ExcalidrawBaseElement,
) => ExcalidrawElement | ExcalidrawElement[] | null;

function randomId(): string {
  return (
    Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 15)
  );
}

function parsePointsAttribute(pointsAttr: string): Point[] {
  const numericValues = pointsAttr
    .match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi)
    ?.map((value) => Number.parseFloat(value)) ?? [];

  const points: Point[] = [];
  for (let index = 0; index + 1 < numericValues.length; index += 2) {
    const x = numericValues[index] ?? 0;
    const y = numericValues[index + 1] ?? 0;
    points.push([x, y]);
  }

  return points;
}

function createLineFromPoints(
  transformedPoints: Point[],
  element: SvgElement,
  context: ConverterContext,
  createBaseElement: () => ExcalidrawBaseElement,
  options?: {
    closePath?: boolean;
    groupIds?: string[];
    forceBackgroundColor?: string;
    forceStrokeColor?: string;
  },
): ExcalidrawLineElement | null {
  if (transformedPoints.length === 0) {
    return null;
  }

  const [x, y] = transformedPoints[0] ?? [0, 0];
  const relativePoints = transformedPoints.map(
    ([pointX, pointY]) => [pointX - x, pointY - y] as Point,
  );

  if (options?.closePath) {
    relativePoints.push([0, 0]);
  }

  const [width, height] = dimensionsFromPoints(relativePoints);
  const backgroundColor =
    options?.forceBackgroundColor ?? getFillColor(element, context.styleContext);
  const strokeColor = options?.forceStrokeColor ?? getStrokeColor(element, context.styleContext);

  return {
    ...createBaseElement(),
    type: "line",
    x,
    y,
    width,
    height,
    points: relativePoints,
    backgroundColor,
    strokeColor,
    strokeWidth: getNumericAttribute(element, "stroke-width", 1),
    groupIds: options?.groupIds ?? [],
  };
}

function markerToArrowhead(markerValue: string | null): ExcalidrawArrowhead {
  if (!markerValue || markerValue === "none") {
    return null;
  }

  const normalized = markerValue.toLowerCase();
  if (normalized.includes("dot") || normalized.includes("circle")) {
    return "dot";
  }
  if (normalized.includes("bar")) {
    return "bar";
  }
  return "arrow";
}

function getArrowheads(
  element: SvgElement,
  context: ConverterContext,
): { startArrowhead: ExcalidrawArrowhead; endArrowhead: ExcalidrawArrowhead } {
  const markerStart = getPresentationValue(element, context.styleContext, "marker-start");
  const markerEnd = getPresentationValue(element, context.styleContext, "marker-end");

  return {
    startArrowhead: markerToArrowhead(markerStart),
    endArrowhead: markerToArrowhead(markerEnd),
  };
}

function shouldUseArrowType(element: SvgElement, context: ConverterContext): boolean {
  const { startArrowhead, endArrowhead } = getArrowheads(element, context);
  return startArrowhead !== null || endArrowhead !== null;
}

function createArrowFromPoints(
  transformedPoints: Point[],
  element: SvgElement,
  context: ConverterContext,
  createBaseElement: () => ExcalidrawBaseElement,
  options?: { closePath?: boolean; groupIds?: string[] },
): ExcalidrawArrowElement | null {
  if (transformedPoints.length === 0) {
    return null;
  }

  const [x, y] = transformedPoints[0] ?? [0, 0];
  const relativePoints = transformedPoints.map(
    ([pointX, pointY]) => [pointX - x, pointY - y] as Point,
  );

  if (options?.closePath) {
    relativePoints.push([0, 0]);
  }

  const [width, height] = dimensionsFromPoints(relativePoints);
  const { startArrowhead, endArrowhead } = getArrowheads(element, context);

  return {
    ...createBaseElement(),
    type: "arrow",
    x,
    y,
    width,
    height,
    points: relativePoints,
    backgroundColor: "transparent",
    strokeColor: getStrokeColor(element, context.styleContext),
    strokeWidth: getNumericPresentationValue(element, context.styleContext, "stroke-width", 1),
    groupIds: options?.groupIds ?? [],
    startBinding: null,
    endBinding: null,
    startArrowhead,
    endArrowhead,
  };
}

function createDrawFromPoints(
  transformedPoints: Point[],
  element: SvgElement,
  context: ConverterContext,
  createBaseElement: () => ExcalidrawBaseElement,
  options?: { groupIds?: string[]; forceBackgroundColor?: string; forceStrokeColor?: string },
): ExcalidrawDrawElement | null {
  if (transformedPoints.length < 2) {
    return null;
  }

  const [x, y] = transformedPoints[0] ?? [0, 0];
  const relativePoints = transformedPoints.map(
    ([pointX, pointY]) => [pointX - x, pointY - y] as Point,
  );

  const [width, height] = dimensionsFromPoints(relativePoints);
  const fillColor = options?.forceBackgroundColor ?? getFillColor(element, context.styleContext);
  const strokeColor = options?.forceStrokeColor ?? getStrokeColor(element, context.styleContext);
  const strokeWidth = getNumericAttribute(element, "stroke-width", 1);

  return {
    ...createBaseElement(),
    type: "draw",
    x,
    y,
    width,
    height,
    points: relativePoints,
    backgroundColor: fillColor,
    strokeColor,
    strokeWidth,
    groupIds: options?.groupIds ?? [],
  };
}

function getTextContent(element: SvgElement): string {
  const tspans = Array.from(element.querySelectorAll("tspan")) as SvgElement[];
  if (tspans.length === 0) {
    return (element.textContent ?? "").trim();
  }

  const lines = tspans
    .map((tspan) => (tspan.textContent ?? "").trim())
    .filter((line) => line.length > 0);
  return lines.join("\n");
}

function getTextAnchorPoint(element: SvgElement): Point {
  const textX = Number.parseFloat(element.getAttribute("x") ?? "");
  const textY = Number.parseFloat(element.getAttribute("y") ?? "");
  if (!Number.isNaN(textX) && !Number.isNaN(textY)) {
    return [textX, textY];
  }

  const firstTspan = element.querySelector("tspan") as SvgElement | null;
  if (firstTspan) {
    const tspanX = Number.parseFloat(firstTspan.getAttribute("x") ?? "");
    const tspanY = Number.parseFloat(firstTspan.getAttribute("y") ?? "");
    if (!Number.isNaN(tspanX) && !Number.isNaN(tspanY)) {
      return [tspanX, tspanY];
    }
  }

  return [0, 0];
}

function toTextAlign(textAnchor: string | null): "left" | "center" | "right" {
  if (textAnchor === "middle") {
    return "center";
  }
  if (textAnchor === "end") {
    return "right";
  }
  return "left";
}

function toVerticalAlign(dominantBaseline: string | null): "top" | "middle" {
  if (dominantBaseline === "middle" || dominantBaseline === "central") {
    return "middle";
  }
  return "top";
}

const rectConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const x = getNumericAttribute(element, "x", 0);
  const y = getNumericAttribute(element, "y", 0);
  const width = getNumericAttribute(element, "width", 0);
  const height = getNumericAttribute(element, "height", 0);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const matrix = getAccumulatedTransform(element);
  const transformedCorners = transformPoints(
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ],
    matrix,
  );

  const bounds = getBoundingBox(transformedCorners);
  const isRounded = element.hasAttribute("rx") || element.hasAttribute("ry");

  return {
    ...createBaseElement(),
    type: "rectangle",
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    backgroundColor: getFillColor(element, context.styleContext),
    strokeColor: getStrokeColor(element, context.styleContext),
    strokeWidth: getNumericAttribute(element, "stroke-width", 1),
    strokeSharpness: isRounded ? "round" : "sharp",
  };
};

const circleConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const cx = getNumericAttribute(element, "cx", 0);
  const cy = getNumericAttribute(element, "cy", 0);
  const radius = getNumericAttribute(element, "r", 0);

  if (radius <= 0) {
    return null;
  }

  const matrix = getAccumulatedTransform(element);
  const transformed = transformPoints(
    [
      [cx - radius, cy],
      [cx + radius, cy],
      [cx, cy - radius],
      [cx, cy + radius],
    ],
    matrix,
  );
  const bounds = getBoundingBox(transformed);

  return {
    ...createBaseElement(),
    type: "ellipse",
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    backgroundColor: getFillColor(element, context.styleContext),
    strokeColor: getStrokeColor(element, context.styleContext),
    strokeWidth: getNumericAttribute(element, "stroke-width", 1),
  };
};

const ellipseConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const cx = getNumericAttribute(element, "cx", 0);
  const cy = getNumericAttribute(element, "cy", 0);
  const radiusX = getNumericAttribute(element, "rx", 0);
  const radiusY = getNumericAttribute(element, "ry", 0);

  if (radiusX <= 0 || radiusY <= 0) {
    return null;
  }

  const matrix = getAccumulatedTransform(element);
  const transformed = transformPoints(
    [
      [cx - radiusX, cy],
      [cx + radiusX, cy],
      [cx, cy - radiusY],
      [cx, cy + radiusY],
    ],
    matrix,
  );
  const bounds = getBoundingBox(transformed);

  return {
    ...createBaseElement(),
    type: "ellipse",
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    backgroundColor: getFillColor(element, context.styleContext),
    strokeColor: getStrokeColor(element, context.styleContext),
    strokeWidth: getNumericAttribute(element, "stroke-width", 1),
  };
};

const polygonConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const pointsAttr = element.getAttribute("points") ?? "";
  const points = parsePointsAttribute(pointsAttr);
  if (points.length < 2) {
    return null;
  }

  const matrix = getAccumulatedTransform(element);
  const transformedPoints = transformPoints(points, matrix);

  return createLineFromPoints(transformedPoints, element, context, createBaseElement, {
    closePath: true,
  });
};

const polylineConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const pointsAttr = element.getAttribute("points") ?? "";
  const points = parsePointsAttribute(pointsAttr);
  if (points.length < 2) {
    return null;
  }

  const matrix = getAccumulatedTransform(element);
  const transformedPoints = transformPoints(points, matrix);

  if (shouldUseArrowType(element, context)) {
    return createArrowFromPoints(transformedPoints, element, context, createBaseElement);
  }

  return createLineFromPoints(transformedPoints, element, context, createBaseElement);
};

const lineConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const x1 = getNumericAttribute(element, "x1", 0);
  const y1 = getNumericAttribute(element, "y1", 0);
  const x2 = getNumericAttribute(element, "x2", 0);
  const y2 = getNumericAttribute(element, "y2", 0);

  const matrix = getAccumulatedTransform(element);
  const transformedPoints = transformPoints(
    [
      [x1, y1],
      [x2, y2],
    ],
    matrix,
  );

  if (shouldUseArrowType(element, context)) {
    return createArrowFromPoints(transformedPoints, element, context, createBaseElement);
  }

  return createLineFromPoints(transformedPoints, element, context, createBaseElement, {
    forceBackgroundColor: "transparent",
  });
};

const pathConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const matrix = getAccumulatedTransform(element);
  const convertedSubpaths = convertPathToSubpaths(element, matrix);
  if (convertedSubpaths.length === 0) {
    return null;
  }

  const hasMultipleSubpaths = convertedSubpaths.length > 1;
  const sharedGroupIds = hasMultipleSubpaths ? [randomId()] : [];
  const fillColor = getFillColor(element, context.styleContext);
  const strokeColor = getStrokeColor(element, context.styleContext);
  const strokeWidth = getNumericPresentationValue(element, context.styleContext, "stroke-width", 1);
  const fillRule = (element.getAttribute("fill-rule") ?? "nonzero").trim().toLowerCase();
  const hasVisibleFill = fillColor !== "transparent";
  const hasVisibleStroke = strokeColor !== "transparent" && strokeWidth > 0;

  let initialWinding: "clockwise" | "counter-clockwise" | null = null;

  return convertedSubpaths
    .map((subpath) => {
      const absolutePoints = subpath.relativePoints.map(([pointX, pointY]) => [
        subpath.x + pointX,
        subpath.y + pointY,
      ]) as Point[];

      if (!subpath.isClosed) {
        if (!hasVisibleStroke) {
          return null;
        }

        if (shouldUseArrowType(element, context)) {
          return createArrowFromPoints(absolutePoints, element, context, createBaseElement, {
            groupIds: sharedGroupIds,
          });
        }

        return createLineFromPoints(absolutePoints, element, context, createBaseElement, {
          closePath: false,
          groupIds: sharedGroupIds,
          forceBackgroundColor: "transparent",
          forceStrokeColor: strokeColor,
        });
      }

      if (!hasVisibleFill) {
        if (!hasVisibleStroke) {
          return null;
        }

        return createLineFromPoints(absolutePoints, element, context, createBaseElement, {
          closePath: true,
          groupIds: sharedGroupIds,
          forceBackgroundColor: "transparent",
          forceStrokeColor: strokeColor,
        });
      }

      let backgroundColor = fillColor;
      if (fillRule === "nonzero") {
        const winding = subpath.windingDirection;
        if (!initialWinding) {
          initialWinding = winding;
        } else if (winding !== initialWinding || subpath.isHole) {
          backgroundColor = "transparent";
        }
      } else if (subpath.isHole) {
        backgroundColor = "transparent";
      }

      const draw = createDrawFromPoints(absolutePoints, element, context, createBaseElement, {
        groupIds: sharedGroupIds,
        forceBackgroundColor: backgroundColor,
        forceStrokeColor: strokeColor,
      });

      if (!draw) {
        return null;
      }

      if (!hasVisibleStroke) {
        draw.strokeWidth = 0;
      }

      return draw;
    })
    .filter((item): item is ExcalidrawDrawElement | ExcalidrawLineElement => item !== null);
};

const textConverter: SvgTagConverter = (element, context, createBaseElement) => {
  const rawText = getTextContent(element);
  if (!rawText) {
    return null;
  }

  const [x, y] = getTextAnchorPoint(element);
  const fontSize = Math.max(
    1,
    getNumericPresentationValue(element, context.styleContext, "font-size", 20),
  );
  const matrix = getAccumulatedTransform(element);
  const transformedPosition = transformPoints([[x, y]], matrix)[0] ?? [x, y];
  const [tx, ty] = transformedPosition;

  const lines = rawText.split("\n");
  const maxChars = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const lineHeight = 1.25;

  const width = Math.max(1, maxChars * fontSize * 0.6);
  const height = Math.max(1, lines.length * fontSize * lineHeight);
  const textAlign = toTextAlign(
    getPresentationValue(element, context.styleContext, "text-anchor"),
  );
  const verticalAlign = toVerticalAlign(
    getPresentationValue(element, context.styleContext, "dominant-baseline"),
  );

  let textX = tx;
  if (textAlign === "center") {
    textX = tx - width / 2;
  } else if (textAlign === "right") {
    textX = tx - width;
  }

  let textY = ty - fontSize * 0.8;
  if (verticalAlign === "middle") {
    textY = ty - height / 2;
  }

  const textColor = getFillColor(element, context.styleContext);

  const textElement: ExcalidrawTextElement = {
    ...createBaseElement(),
    type: "text",
    x: textX,
    y: textY,
    width,
    height,
    strokeColor: textColor,
    backgroundColor: "transparent",
    strokeWidth: 0,
    text: rawText,
    originalText: rawText,
    fontSize,
    fontFamily: 2,
    baseline: fontSize,
    textAlign,
    verticalAlign,
    lineHeight,
  };

  return textElement;
};

export const svgConverters: Record<string, SvgTagConverter> = {
  rect: rectConverter,
  circle: circleConverter,
  ellipse: ellipseConverter,
  line: lineConverter,
  polygon: polygonConverter,
  polyline: polylineConverter,
  path: pathConverter,
  text: textConverter,
};
