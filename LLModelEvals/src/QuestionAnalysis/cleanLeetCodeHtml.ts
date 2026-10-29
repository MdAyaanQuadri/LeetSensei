import type { ExampleItem, CleanedQuestion } from "./types.js";

/**
 * cleanEntitiesAndMath
 * Decodes HTML entities, converts <sup> and <sub>, and normalizes unicode math symbols.
 */
function cleanEntitiesAndMath(raw: string): string {
  let s = raw;

  // Exponents & Subscripts: <sup>31</sup> -> ^31, nums<sub>i</sub> -> nums_i
  s = s.replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1");
  s = s.replace(/<sub>([\s\S]*?)<\/sub>/gi, "_$1");

  // Common HTML entities and math signs
  const entityMap: [RegExp, string][] = [
    [/&minus;/g, "-"],
    [/&ndash;/g, "-"],
    [/&mdash;/g, "--"],
    [/&le;/g, "<="],
    [/&ge;/g, ">="],
    [/&lt;/g, "<"],
    [/&gt;/g, ">"],
    [/&amp;/g, "&"],
    [/&nbsp;/g, " "],
    [/&#160;/g, " "],
    [/&#39;/g, "'"],
    [/&apos;/g, "'"],
    [/&quot;/g, '"'],
    [/&times;/g, "x"],
    [/&divide;/g, "/"],
    [/&infin;/g, "infinity"],
    [/&pi;/g, "pi"],
    [/&ne;/g, "!="],
    [/&asymp;/g, "~="],
    [/&plusmn;/g, "+-"],
    [/&sum;/g, "sum"],
    [/&rArr;/g, "=>"],
    [/&rarr;/g, "->"],
    [/&larr;/g, "<-"]
  ];

  for (const [pattern, replacement] of entityMap) {
    s = s.replace(pattern, replacement);
  }

  s = s.replace(/&#(\d+);/g, (_match: string, code: string) =>
    String.fromCharCode(Number(code))
  );
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_match: string, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  return s;
}

/**
 * htmlToPlainText
 * Converts arbitrary HTML fragment to clean, readable plain text.
 */
function htmlToPlainText(html: string): string {
  let s = html;

  // 1. Exponents & Subscripts before tag stripping
  s = s.replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1");
  s = s.replace(/<sub>([\s\S]*?)<\/sub>/gi, "_$1");

  // 2. Replace block closures with newlines
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<\/h[1-6]>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/pre>/gi, "\n");
  s = s.replace(/<pre[^>]*>/gi, "\n");

  // List item bullets
  s = s.replace(/<li[^>]*>/gi, "\n• ");
  s = s.replace(/<\/li>/gi, "");
  s = s.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // 3. Strip all real HTML tags FIRST (so &lt; is not mistaken for an HTML tag)
  s = s.replace(/<[a-zA-Z\/][^>]*>/g, "");

  // 4. Now decode HTML entities and math signs
  s = cleanEntitiesAndMath(s);

  // Normalize blank lines and spacing
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]+$/gm, "");
  return s.trim();
}

/**
 * cleanLeetCodeHtml
 *
 * Takes raw LeetCode question HTML and cleanly parses it into:
 *  - body: The pure problem description (prior to Examples)
 *  - examples: Structured list of inputs, outputs, and explanations
 *  - constraints: Clean list of constraints strings
 *  - imageUrls: Ordered image URLs found in the HTML
 *  - fullText: Combined plain text formatted for LLM consumption
 */
export function cleanLeetCodeHtml(rawHtml: string): CleanedQuestion {
  const imageUrls: string[] = [];
  let figureCount = 0;

  // 1. Extract and replace images with "Figure N" placeholders
  let workingHtml = rawHtml.replace(
    /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi,
    (_, src: string) => {
      imageUrls.push(src);
      figureCount++;
      return `\nFigure ${figureCount}: [image: ${src}]\n`;
    }
  );

  // 2. Extract Examples (from <pre> blocks)
  const examples: ExampleItem[] = [];
  const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let preMatch: RegExpExecArray | null;

  while ((preMatch = preRegex.exec(workingHtml)) !== null) {
    let rawPre = (preMatch[1] ?? "");
    rawPre = rawPre.replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1");
    rawPre = rawPre.replace(/<sub>([\s\S]*?)<\/sub>/gi, "_$1");
    // Strip real HTML tags first to avoid collision with &lt;
    rawPre = rawPre.replace(/<[a-zA-Z\/][^>]*>/g, "");
    const rawPreContent = cleanEntitiesAndMath(rawPre).trim();

    const inputMatch = rawPreContent.match(/Input:\s*([\s\S]*?)(?=(?:Output:|$))/i);
    const outputMatch = rawPreContent.match(/Output:\s*([\s\S]*?)(?=(?:Explanation:|$))/i);
    const explMatch = rawPreContent.match(/Explanation:\s*([\s\S]*)/i);

    if (inputMatch && outputMatch) {
      const explanation = explMatch?.[1];
      examples.push({
        input: inputMatch[1]?.trim() ?? "",
        output: outputMatch[1]?.trim() ?? "",
        ...(explanation !== undefined ? { explanation: explanation.trim() } : {})
      });
    }
  }

  // 3. Extract Constraints (from <ul> after "Constraints:")
  const constraints: string[] = [];
  const constraintsSectionMatch = workingHtml.match(
    /Constraints:?[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i
  );

  if (constraintsSectionMatch) {
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(constraintsSectionMatch[1] ?? "")) !== null) {
      let rawLi = liMatch[1] ?? "";
      rawLi = rawLi.replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1");
      rawLi = rawLi.replace(/<sub>([\s\S]*?)<\/sub>/gi, "_$1");
      // Strip real HTML tags first:
      rawLi = rawLi.replace(/<[a-zA-Z\/][^>]*>/g, "");
      // Then clean entities:
      const parsedLi = cleanEntitiesAndMath(rawLi).trim();
      if (parsedLi) {
        constraints.push(parsedLi);
      }
    }
  }

  // 4. Extract Body (everything before the first Example / <pre>)
  let bodyHtml = workingHtml;
  const firstExampleIndex = bodyHtml.search(/<strong[^>]*class=["']example["']|<p><strong[^>]*>Example\s*1/i);
  if (firstExampleIndex !== -1) {
    bodyHtml = bodyHtml.substring(0, firstExampleIndex);
  } else {
    const firstPreIndex = bodyHtml.indexOf("<pre");
    if (firstPreIndex !== -1) {
      bodyHtml = bodyHtml.substring(0, firstPreIndex);
    }
  }
  const body = htmlToPlainText(bodyHtml);

  // 5. Construct Cohesive Full Text
  const fullTextParts: string[] = [];

  if (body) {
    fullTextParts.push(body);
  }

  if (examples.length > 0) {
    fullTextParts.push("\nExamples:");
    examples.forEach((ex, idx) => {
      fullTextParts.push(`\nExample ${idx + 1}:`);
      fullTextParts.push(`Input: ${ex.input}`);
      fullTextParts.push(`Output: ${ex.output}`);
      if (ex.explanation) {
        fullTextParts.push(`Explanation: ${ex.explanation}`);
      }
    });
  }

  if (constraints.length > 0) {
    fullTextParts.push("\nConstraints:");
    constraints.forEach((c) => {
      fullTextParts.push(`• ${c}`);
    });
  }

  const fullText = fullTextParts.join("\n").trim();

  return {
    body,
    examples,
    constraints,
    imageUrls,
    fullText
  };
}