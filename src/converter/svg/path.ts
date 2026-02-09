import { pointsOnPath } from "points-on-path";
import type { Matrix } from "transformation-matrix";
import {
  type BoundingBox,
  type Point,
  dimensionsFromPoints,
  getBoundingBox,
  getPolygonArea,
  getWindingOrder,
  isContainedIn,
} from "./geometry";
import { transformPoints } from "./transform";

type SvgElement = any;

interface PathSubpathData {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  relativePoints: Point[];
  bbox: BoundingBox;
  area: number;
  windingDirection: "clockwise" | "counter-clockwise";
  isHole: boolean;
}

export interface ConvertedPathSubpath {
  x: number;
  y: number;
  width: number;
  height: number;
  relativePoints: Point[];
  isHole: boolean;
  windingDirection: "clockwise" | "counter-clockwise";
  isClosed: boolean;
}

function isClosedSubpath(points: Point[]): boolean {
  if (points.length < 2) {
    return false;
  }

  const [firstX, firstY] = points[0] ?? [0, 0];
  const [lastX, lastY] = points[points.length - 1] ?? [0, 0];
  const dx = lastX - firstX;
  const dy = lastY - firstY;
  return Math.hypot(dx, dy) < 0.001;
}

function getPathFillRule(element: SvgElement): string {
  const ownFillRule = element.getAttribute("fill-rule");
  if (ownFillRule) {
    return ownFillRule;
  }

  let current: SvgElement | null = element.parentElement;
  while (current) {
    const inheritedFillRule = current.getAttribute("fill-rule");
    if (inheritedFillRule) {
      return inheritedFillRule;
    }

    if (current.tagName.toLowerCase() === "svg") {
      break;
    }

    current = current.parentElement;
  }

  return "nonzero";
}

function buildSubpathData(pathPoints: Point[][], matrix: Matrix): PathSubpathData[] {
  const subpaths: PathSubpathData[] = [];

  for (const [index, subpath] of pathPoints.entries()) {
    if (subpath.length < 2) {
      continue;
    }

    const transformed = transformPoints(subpath, matrix);
    const [x, y] = transformed[0] ?? [0, 0];
    const relativePoints = transformed.map(([pointX, pointY]) => [pointX - x, pointY - y] as Point);
    const [width, height] = dimensionsFromPoints(relativePoints);

    const winding = getWindingOrder(relativePoints);
    const area = getPolygonArea(relativePoints);
    const bbox = getBoundingBox(transformed);

    subpaths.push({
      index,
      x,
      y,
      width,
      height,
      relativePoints,
      bbox,
      area,
      windingDirection: winding.direction,
      isHole: false,
    });
  }

  return subpaths;
}

function markHoleSubpaths(subpaths: PathSubpathData[], useEvenOdd: boolean): void {
  if (subpaths.length < 2) {
    return;
  }

  const sortedByArea = [...subpaths].sort((left, right) => right.area - left.area);
  const largestSubpathIndex = sortedByArea[0]?.index ?? -1;

  for (const subpath of subpaths) {
    if (subpath.index === largestSubpathIndex) {
      continue;
    }

    for (const candidateContainer of subpaths) {
      if (candidateContainer.index === subpath.index) {
        continue;
      }

      const contained = isContainedIn(subpath.bbox, candidateContainer.bbox);
      const smaller = subpath.area < candidateContainer.area;
      const oppositeWinding =
        subpath.windingDirection !== candidateContainer.windingDirection;
      const windingIsCompatible =
        useEvenOdd || oppositeWinding || candidateContainer.index === largestSubpathIndex;

      if (contained && smaller && windingIsCompatible) {
        subpath.isHole = true;
        break;
      }
    }
  }
}

export function convertPathToSubpaths(
  element: SvgElement,
  matrix: Matrix,
): ConvertedPathSubpath[] {
  const pathData = element.getAttribute("d");
  if (!pathData) {
    return [];
  }

  let pathPoints: Point[][];
  try {
    pathPoints = pointsOnPath(pathData) as Point[][];
  } catch {
    return [];
  }

  if (pathPoints.length === 0) {
    return [];
  }

  const subpaths = buildSubpathData(pathPoints, matrix);
  const fillRule = getPathFillRule(element).trim().toLowerCase();
  const useEvenOdd = fillRule === "evenodd";
  markHoleSubpaths(subpaths, useEvenOdd);

  return subpaths.map((subpath) => ({
    x: subpath.x,
    y: subpath.y,
    width: subpath.width,
    height: subpath.height,
    relativePoints: subpath.relativePoints,
    isHole: subpath.isHole,
    windingDirection: subpath.windingDirection,
    isClosed: isClosedSubpath(subpath.relativePoints),
  }));
}
