export type Point = [number, number];

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WindingOrder {
  direction: "clockwise" | "counter-clockwise";
  signedArea: number;
}

export function getWindingOrder(points: Point[]): WindingOrder {
  let sum = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0];
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0];
    sum += (x2 - x1) * (y2 + y1);
  }

  return {
    direction: sum > 0 ? "clockwise" : "counter-clockwise",
    signedArea: sum,
  };
}

export function getPolygonArea(points: Point[]): number {
  let sum = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index] ?? [0, 0];
    const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0];
    sum += (x2 - x1) * (y2 + y1);
  }

  return Math.abs(sum / 2);
}

export function dimensionsFromPoints(points: Point[]): Point {
  if (points.length === 0) {
    return [0, 0];
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [maxX - minX, maxY - minY];
}

export function getBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { minX, minY, maxX, maxY };
}

export function isContainedIn(boxA: BoundingBox, boxB: BoundingBox): boolean {
  const centerX = (boxA.minX + boxA.maxX) / 2;
  const centerY = (boxA.minY + boxA.maxY) / 2;
  const tolerance = 2;

  const centerInside =
    centerX >= boxB.minX - tolerance &&
    centerX <= boxB.maxX + tolerance &&
    centerY >= boxB.minY - tolerance &&
    centerY <= boxB.maxY + tolerance;

  const areaA = (boxA.maxX - boxA.minX) * (boxA.maxY - boxA.minY);
  const areaB = (boxB.maxX - boxB.minX) * (boxB.maxY - boxB.minY);
  const isSmallerShape = areaA < areaB * 0.9;

  return centerInside && isSmallerShape;
}
