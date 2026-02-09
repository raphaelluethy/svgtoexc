import {
  applyToPoint,
  compose,
  fromDefinition,
  fromTransformAttribute,
  identity,
  type Matrix,
} from "transformation-matrix";
import type { Point } from "./geometry";

type SvgElement = any;

export function getTransformMatrix(element: SvgElement): Matrix {
  const transformAttribute = element.getAttribute("transform");
  if (!transformAttribute) {
    return identity();
  }

  try {
    const definition = fromTransformAttribute(transformAttribute);
    const matrices = fromDefinition(definition);
    return matrices.length > 0 ? compose(matrices) : identity();
  } catch {
    return identity();
  }
}

export function getAccumulatedTransform(element: SvgElement): Matrix {
  const matrices: Matrix[] = [];
  let current: SvgElement | null = element;

  while (current) {
    if (current.tagName.toLowerCase() === "svg") {
      break;
    }

    matrices.unshift(getTransformMatrix(current));
    current = current.parentElement;
  }

  return matrices.length > 0 ? compose(matrices) : identity();
}

export function transformPoint(point: Point, matrix: Matrix): Point {
  const transformed = applyToPoint(matrix, { x: point[0], y: point[1] }) as {
    x: number;
    y: number;
  };
  return [transformed.x, transformed.y];
}

export function transformPoints(points: Point[], matrix: Matrix): Point[] {
  return points.map((point) => transformPoint(point, matrix));
}
