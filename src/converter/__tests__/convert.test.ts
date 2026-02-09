import { describe, expect, test } from "bun:test";
import { convertSvgToExcalidraw } from "../convert";

async function readFixture(fileName: string): Promise<string> {
  return Bun.file(new URL(`./fixtures/${fileName}`, import.meta.url)).text();
}

describe("convertSvgToExcalidraw", () => {
  test("converts basic primitives", async () => {
    const svg = await readFixture("primitives.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.type).toBe("excalidraw");
    expect(result.version).toBe(2);
    expect(result.source).toBe("https://excalidraw.com");
    expect(result.elements).toHaveLength(3);
    expect(result.elements.map((element) => element.type)).toEqual([
      "rectangle",
      "ellipse",
      "ellipse",
    ]);

    const rect = result.elements[0];
    if (!rect) {
      throw new Error("Expected first primitive element.");
    }
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(12);
    expect(rect.width).toBe(30);
    expect(rect.height).toBe(20);
  });

  test("converts polygon and polyline to line elements", async () => {
    const svg = await readFixture("polygon-polyline.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(2);
    expect(result.elements[0]?.type).toBe("line");
    expect(result.elements[1]?.type).toBe("line");

    const polygon = result.elements[0];
    const polyline = result.elements[1];

    if (!polygon || !polyline || polygon.type !== "line" || polyline.type !== "line") {
      throw new Error("Expected polygon/polyline conversion to return line elements.");
    }

    expect(polygon.points.at(-1)).toEqual([0, 0]);
    expect(polyline.points.at(-1)).not.toEqual([0, 0]);
  });

  test("keeps multi-subpath paths grouped and handles holes", async () => {
    const svg = await readFixture("path-holes.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(2);

    const outer = result.elements[0];
    const inner = result.elements[1];
    if (!outer || !inner || outer.type !== "draw" || inner.type !== "draw") {
      throw new Error("Expected path conversion to return draw elements.");
    }

    expect(outer.groupIds).toHaveLength(1);
    expect(inner.groupIds).toEqual(outer.groupIds);
    expect(
      result.elements.some((element) => element.backgroundColor === "transparent"),
    ).toBeTrue();
  });

  test("applies nested group transforms", async () => {
    const svg = await readFixture("nested-transforms.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(1);
    const rect = result.elements[0];
    if (!rect) {
      throw new Error("Expected transformed rectangle element.");
    }

    expect(rect.type).toBe("rectangle");
    expect(rect.x).toBeCloseTo(18, 6);
    expect(rect.y).toBeCloseTo(35, 6);
    expect(rect.width).toBeCloseTo(12, 6);
    expect(rect.height).toBeCloseTo(21, 6);
  });

  test("supports gradients, classes, and inherited styles", async () => {
    const svg = await readFixture("styles-gradients.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(3);

    const classFilledRect = result.elements[0];
    const gradientCircle = result.elements[1];
    const inheritedEllipse = result.elements[2];

    if (!classFilledRect || !gradientCircle || !inheritedEllipse) {
      throw new Error("Expected all style fixture elements.");
    }

    expect(classFilledRect.backgroundColor).toBe("#123123");
    expect(gradientCircle.backgroundColor).toBe("#ff00ff");
    expect(gradientCircle.strokeColor).toBe("#010203");
    expect(inheritedEllipse.backgroundColor).toBe("#abcdef");
  });

  test("converts text nodes to text elements", async () => {
    const svg = await readFixture("text.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(1);
    const textElement = result.elements[0];

    if (!textElement || textElement.type !== "text") {
      throw new Error("Expected a text element.");
    }

    expect(textElement.text).toBe("Hello SVG");
    expect(textElement.strokeColor).toBe("#112233");
    expect(textElement.fontSize).toBe(24);
  });

  test("converts open paths with fill none to stroked lines", async () => {
    const svg = await readFixture("path-open.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(1);
    const element = result.elements[0];
    if (!element || element.type !== "line") {
      throw new Error("Expected open path to convert to line element.");
    }

    expect(element.backgroundColor).toBe("transparent");
    expect(element.strokeColor).toBe("#000000");
    expect(element.strokeWidth).toBe(2);
  });

  test("ignores geometry inside defs and clip paths", async () => {
    const svg = await readFixture("defs-noise.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(1);
    const element = result.elements[0];
    if (!element || element.type !== "rectangle") {
      throw new Error("Expected only visible rectangle element.");
    }

    expect(element.x).toBe(10);
    expect(element.y).toBe(10);
    expect(element.width).toBe(30);
    expect(element.height).toBe(20);
  });

  test("converts marker-ended connectors to arrows", async () => {
    const svg = await readFixture("arrow-marker.svg");
    const result = convertSvgToExcalidraw(svg);

    expect(result.elements).toHaveLength(1);
    const element = result.elements[0];
    if (!element || element.type !== "arrow") {
      throw new Error("Expected marker-ended path to become arrow element.");
    }

    expect(element.strokeColor).toBe("#0D32B2");
    expect(element.strokeWidth).toBe(2);
    expect(element.startArrowhead).toBeNull();
    expect(element.endArrowhead).toBe("arrow");
  });
});
