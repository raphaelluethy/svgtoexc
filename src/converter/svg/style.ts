type SvgElement = any;

export interface StyleContext {
  svgRoot: SvgElement;
  classStyles: Map<string, Map<string, string>>;
}

function parseCssDeclarations(cssText: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const declaration of cssText.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (property && value) {
      declarations.set(property, value);
    }
  }

  return declarations;
}

function parseClassStyles(svgRoot: SvgElement): Map<string, Map<string, string>> {
  const classStyles = new Map<string, Map<string, string>>();
  const styleBlocks = Array.from(svgRoot.querySelectorAll("style")) as SvgElement[];

  for (const styleBlock of styleBlocks) {
    const cssText = styleBlock.textContent ?? "";
    const blockMatches = cssText.matchAll(/([^{}]+)\{([^{}]+)\}/g);

    for (const blockMatch of blockMatches) {
      const selectorText = (blockMatch[1] ?? "").trim();
      const declarationText = (blockMatch[2] ?? "").trim();
      if (!selectorText || !declarationText) {
        continue;
      }

      const declarations = parseCssDeclarations(declarationText);
      if (declarations.size === 0) {
        continue;
      }

      for (const selector of selectorText.split(",")) {
        const trimmedSelector = selector.trim();
        const classMatches = Array.from(
          trimmedSelector.matchAll(/\.([A-Za-z0-9_-]+)/g),
        ) as RegExpMatchArray[];
        if (classMatches.length === 0) {
          continue;
        }

        for (const classMatch of classMatches) {
          const className = classMatch[1];
          if (!className) {
            continue;
          }

          const existing = classStyles.get(className) ?? new Map<string, string>();
          for (const [property, value] of declarations.entries()) {
            existing.set(property, value);
          }
          classStyles.set(className, existing);
        }
      }
    }
  }

  return classStyles;
}

function getInlineStyleValue(element: SvgElement, property: string): string | null {
  const styleAttr = element.getAttribute("style");
  if (!styleAttr) {
    return null;
  }

  const declarations = parseCssDeclarations(styleAttr);
  return declarations.get(property.toLowerCase()) ?? null;
}

function getClassStyleValue(
  element: SvgElement,
  context: StyleContext,
  property: string,
): string | null {
  const classNameAttr = element.getAttribute("class");
  if (!classNameAttr) {
    return null;
  }

  const classNames = classNameAttr.split(/\s+/).filter(Boolean);
  for (const className of classNames) {
    const styleMap = context.classStyles.get(className);
    const value = styleMap?.get(property.toLowerCase());
    if (value) {
      return value;
    }
  }

  return null;
}

function getInheritedPresentationValue(element: SvgElement, property: string): string | null {
  let current: SvgElement | null = element.parentElement;

  while (current) {
    const directAttribute = current.getAttribute(property);
    if (directAttribute) {
      return directAttribute;
    }

    const inlineStyleValue = getInlineStyleValue(current, property);
    if (inlineStyleValue) {
      return inlineStyleValue;
    }

    if (current.tagName.toLowerCase() === "svg") {
      break;
    }

    current = current.parentElement;
  }

  return null;
}

export function getPresentationValue(
  element: SvgElement,
  context: StyleContext,
  property: string,
): string | null {
  return (
    getInlineStyleValue(element, property) ??
    element.getAttribute(property) ??
    getClassStyleValue(element, context, property) ??
    getInheritedPresentationValue(element, property)
  );
}

export function createStyleContext(svgRoot: SvgElement): StyleContext {
  return {
    svgRoot,
    classStyles: parseClassStyles(svgRoot),
  };
}

function resolveGradientUrl(urlRef: string, svgRoot: SvgElement): string | null {
  if (!urlRef.startsWith("url(")) {
    return null;
  }

  const gradientId = urlRef.match(/url\(#(.+?)\)/)?.[1];
  if (!gradientId) {
    return null;
  }

  const gradientElement = svgRoot.querySelector(`#${gradientId}`) as SvgElement | null;
  if (!gradientElement) {
    return null;
  }

  const stopElements = Array.from(gradientElement.querySelectorAll("stop")) as SvgElement[];
  for (const stopElement of stopElements) {
    const stopColor =
      stopElement.getAttribute("stop-color") ?? getInlineStyleValue(stopElement, "stop-color");
    if (stopColor) {
      return stopColor;
    }
  }

  return null;
}

function normalizeSvgColor(
  color: string | null,
  fallback: string,
  svgRoot: SvgElement,
): string {
  if (!color) {
    return fallback;
  }

  const normalizedColor = color.trim();
  if (!normalizedColor) {
    return fallback;
  }

  if (normalizedColor === "none") {
    return "transparent";
  }

  if (normalizedColor.startsWith("url(")) {
    return resolveGradientUrl(normalizedColor, svgRoot) ?? fallback;
  }

  return normalizedColor;
}

export function getFillColor(element: SvgElement, context: StyleContext): string {
  let fillColor = getPresentationValue(element, context, "fill");

  if (!fillColor || fillColor === "none") {
    fillColor = getClassStyleValue(element, context, "fill") ?? fillColor;
  }

  return normalizeSvgColor(fillColor, "#000000", context.svgRoot);
}

export function getStrokeColor(element: SvgElement, context: StyleContext): string {
  let strokeColor = getPresentationValue(element, context, "stroke");

  if (!strokeColor || strokeColor === "none") {
    strokeColor = getClassStyleValue(element, context, "stroke") ?? strokeColor;
  }

  return normalizeSvgColor(strokeColor, "transparent", context.svgRoot);
}

export function getNumericAttribute(
  element: SvgElement,
  attributeName: string,
  fallback = 0,
): number {
  const raw = element.getAttribute(attributeName);
  if (!raw) {
    return fallback;
  }

  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? fallback : value;
}

export function getNumericPresentationValue(
  element: SvgElement,
  context: StyleContext,
  property: string,
  fallback = 0,
): number {
  const raw = getPresentationValue(element, context, property);
  if (!raw) {
    return fallback;
  }

  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? fallback : value;
}
