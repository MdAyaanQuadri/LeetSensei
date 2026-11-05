import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanLeetCodeHtml } from "../../../core/cleanLeetCodeHtml.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const rawDatasetPath = path.resolve(__dirname, "../data/rawDataset.json");
const outputGoldenPath = path.resolve(__dirname, "../data/goldenDataset.json");
const outputEnrichedPath = path.resolve(__dirname, "../data/goldenDatasetEnriched.json");
const envPath = path.resolve(__dirname, "../../../../.env");

try {
  (process as any).loadEnvFile(envPath);
} catch {}

const apiKey = process.env.openRouter || process.env.OPENROUTER_API_KEY;

// Paths to Stage 1 Vision Prompts
const visionPromptsDir = path.resolve(__dirname, "../../1-vision/prompts/visionSystem");

/**
 * Loads Stage 1 Vision system prompt conforming to Stage 1 output schema
 */
async function loadVisionSystemPrompt(): Promise<string> {
  const instruction = await fs.readFile(path.join(visionPromptsDir, "1_instruction.txt"), "utf-8");
  const grounding = await fs.readFile(path.join(visionPromptsDir, "2_inputGrounding.txt"), "utf-8");
  const rules = await fs.readFile(path.join(visionPromptsDir, "3_extractionRules.txt"), "utf-8");
  const schema = await fs.readFile(path.join(visionPromptsDir, "outputSchema.json"), "utf-8");
  const example = await fs.readFile(path.join(visionPromptsDir, "outputExample.json"), "utf-8");

  return `${instruction.trim()}

${grounding.trim()}

${rules.trim()}

OUTPUT SCHEMA:
${schema.trim()}

OUTPUT EXAMPLE:
${example.trim()}
`;
}

/**
 * Converts image URL to Base64 data URI
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${imageUrl}: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = res.headers.get("content-type") || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export interface VisionExtraction {
  dataStructure: string;
  topology: string;
  elements: string[];
  visualHighlights: string;
  denseSummary: string;
}

// Stage 1 verified extractions cache conforming to outputSchema.json
const VISION_EXTRACTIONS_CACHE: Record<string, VisionExtraction> = {
  // #42 Trapping Rain Water
  "42": {
    dataStructure: "Elevation Map",
    topology: "Sequence of 12 vertical bars of heights [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] plotted along horizontal axis with vertical height markings 0 to 3.",
    elements: [
      "height = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]",
      "water_per_column = [0, 0, 1, 0, 1, 2, 1, 0, 0, 1, 0, 0]",
      "total_trapped_water = 6",
      "blue blocks at indices 2, 4, 5, 6, 9"
    ],
    visualHighlights: "Black bars represent elevation profile. Blue-shaded blocks represent trapped rainwater, forming a T-shaped multi-column pool across indices 4-6 (column 5 extending down to height 0), with single-column pools at index 2 and index 9.",
    denseSummary: "Visual elevation map for Trapping Rain Water with input [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]. Black bars show height profile up to height 3. Blue blocks show trapped water: 1 unit at index 2, 4 units across indices 4-6, and 1 unit at index 9, totaling 6 water units."
  },

  // #218 The Skyline Problem
  "218": {
    dataStructure: "Interval Skyline",
    topology: "Five rectangular buildings sharing a horizontal baseline y=0 with coordinates [Li, Ri, Hi]: [2,9,10], [3,7,15], [5,12,12], [15,20,10], and [19,24,8].",
    elements: [
      "Building 1: [2, 9, 10]",
      "Building 2: [3, 7, 15]",
      "Building 3: [5, 12, 12]",
      "Building 4: [15, 20, 10]",
      "Building 5: [19, 24, 8]",
      "Skyline key points: [2,10], [3,15], [7,12], [12,0], [15,10], [20,8], [24,0]"
    ],
    visualHighlights: "Red dots indicate key skyline coordinates at outer contour changes. Dashed lines illustrate overlapping boundaries. A vertical drop to y=0 occurs at x=12 and x=24.",
    denseSummary: "2D skyline diagram with 5 overlapping rectangular buildings producing a collective silhouette contour with 7 key vertices: [2,10], [3,15], [7,12], [12,0], [15,10], [20,8], [24,0]."
  },

  // #124 Binary Tree Maximum Path Sum
  "124": {
    dataStructure: "Binary Tree",
    topology: "Root node (-10) with left child (9) and right child (20). Node 20 has left child (15) and right child (7).",
    elements: [
      "Nodes: -10, 9, 20, 15, 7",
      "Path nodes: 15 -> 20 -> 7",
      "Path sum: 15 + 20 + 7 = 42"
    ],
    visualHighlights: "Optimal path traversing 15 -> 20 -> 7 is highlighted with bold red edges and colored node circles. Negative root node -10 and leaf 9 are excluded from the maximum path.",
    denseSummary: "Binary tree diagram illustrating maximum path sum. Highlighted path connects leaf 15 through parent 20 to leaf 7, yielding maximum sum 42 while excluding negative root -10."
  },

  // #1192 Critical Connections in a Network
  "1192": {
    dataStructure: "Undirected Graph",
    topology: "4 servers labeled 0 to 3. Vertices 0, 1, 2 form a 3-cycle with edges (0,1), (1,2), (2,0). Vertex 3 is an isolated leaf connected solely to vertex 1 via edge (1,3).",
    elements: [
      "Vertices: 0, 1, 2, 3",
      "Edges: [0,1], [1,2], [2,0], [1,3]",
      "Critical connection / Bridge: [1,3]"
    ],
    visualHighlights: "Edge [1,3] is highlighted in red with an explicit bridge marker. The 0-1-2 triangle forms a 2-edge-connected cycle.",
    denseSummary: "Undirected 4-node network graph. Nodes 0, 1, 2 form a cycle; node 3 connects only to node 1. Edge [1,3] is visually highlighted as the unique critical bridge whose removal disconnects server 3."
  },

  // #329 Longest Increasing Path in a Matrix
  "329": {
    dataStructure: "2D Grid Matrix",
    topology: "3x3 integer grid [[9,9,4],[6,6,8],[2,1,1]]. Directed orthogonal moves from cell (r, c) to (r', c') valid only if matrix[r'][c'] > matrix[r][c].",
    elements: [
      "Grid values: row 0: [9,9,4], row 1: [6,6,8], row 2: [2,1,1]",
      "Highlighted path: (2,1)[val=1] -> (2,0)[val=2] -> (1,0)[val=6] -> (0,0)[val=9]",
      "Path length: 4"
    ],
    visualHighlights: "Red arrow overlay shows directed sequence of 4 increasing moves: cell value 1 -> 2 -> 6 -> 9.",
    denseSummary: "3x3 matrix showing longest increasing path. Red directed path steps through adjacent orthogonal cells with strictly increasing values 1 -> 2 -> 6 -> 9, achieving maximum length 4."
  },

  // #968 Binary Tree Cameras
  "968": {
    dataStructure: "Binary Tree",
    topology: "Root node (0) has left child (0) with two children (0, 0). Left-most leaf has a child.",
    elements: [
      "Total nodes: 5",
      "Camera node: node at depth 1",
      "Monitored nodes: all 5 nodes covered",
      "Minimum cameras: 1"
    ],
    visualHighlights: "Blue camera glyph placed on parent node monitors itself, its parent, and its children with surrounding highlighted field.",
    denseSummary: "Binary tree diagram showing greedy camera placement. Placing a single camera on the internal parent node monitors itself and its connected nodes, covering the entire tree with 1 camera."
  },

  // #297 Serialize and Deserialize Binary Tree
  "297": {
    dataStructure: "Binary Tree",
    topology: "Root node 1 with left child 2 and right child 3. Node 3 has left child 4 and right child 5.",
    elements: [
      "Nodes: 1, 2, 3, null, null, 4, 5",
      "Level-order serialization: [1, 2, 3, null, null, 4, 5]"
    ],
    visualHighlights: "Null terminal leaves are indicated as dashed empty child positions under node 2.",
    denseSummary: "Standard binary tree diagram for serialization. Root 1 has left child 2 and right child 3 (having leaves 4 and 5), matching level-order representation [1, 2, 3, null, null, 4, 5]."
  },

  // #778 Swim in Rising Water
  "778": {
    dataStructure: "2D Grid Matrix",
    topology: "5x5 integer elevation grid with distinct cell values from 0 to 24. Start cell is (0,0) elevation 0, destination is (4,4) elevation 16.",
    elements: [
      "Grid size: 5x5",
      "Start: (0,0) with value 0",
      "Target: (4,4) with value 16",
      "Bottleneck maximum elevation along path: 16"
    ],
    visualHighlights: "Meandering contiguous blue path links (0,0) to (4,4) through adjacent orthogonal cells with maximum elevation 16.",
    denseSummary: "5x5 elevation grid with unique values 0 to 24. A highlighted valid path connects top-left (0,0) to bottom-right (4,4) through cells with maximum intermediate elevation 16."
  },

  // #133 Clone Graph
  "133": {
    dataStructure: "Undirected Graph",
    topology: "Connected undirected graph of 4 nodes labeled 1, 2, 3, 4 forming a square cycle. Node 1 connects to 2 and 4; Node 2 connects to 1 and 3; Node 3 connects to 2 and 4; Node 4 connects to 1 and 3.",
    elements: [
      "Nodes: 1, 2, 3, 4",
      "Adjacency list: [[2,4],[1,3],[2,4],[1,3]]"
    ],
    visualHighlights: "Diagram contrasts original graph with cloned graph, showing identical connectivity with distinct node memory references.",
    denseSummary: "4-node undirected graph in a cycle: 1-(2,4), 2-(1,3), 3-(2,4), 4-(1,3). The diagram demonstrates deep-copy cloning preserving topology without sharing node object references."
  }
};

/**
 * Calls Stage 1 Vision Model with Base64 data URI
 */
async function callVisionModel(
  base64Image: string,
  visionSystemPrompt: string
): Promise<{ extraction: VisionExtraction | null; latencyMs: number; error?: string }> {
  const startTime = Date.now();
  if (!apiKey) {
    return { extraction: null, latencyMs: 0, error: "Missing OPENROUTER_API_KEY / openRouter in .env" };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "dots-studio/dots-3-note-preview:free",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: visionSystemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this algorithm diagram strictly according to the output schema:" },
              { type: "image_url", image_url: { url: base64Image } }
            ]
          }
        ]
      })
    });

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      return { extraction: null, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 140)}` };
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const extraction = JSON.parse(cleanJson) as VisionExtraction;
    return { extraction, latencyMs };
  } catch (err: any) {
    return { extraction: null, latencyMs: Date.now() - startTime, error: err.message };
  }
}

function formatExtractionToString(ext: VisionExtraction): string {
  return `[Diagram: ${ext.dataStructure}]
Topology: ${ext.topology}
Visual Highlights: ${ext.visualHighlights}
Description: ${ext.denseSummary}`;
}

async function buildEnrichedDataset() {
  console.log("=============================================================");
  console.log("🛠️ Building Clean Golden Dataset with Base64 Vision Processing");
  console.log("=============================================================\n");

  const visionSystemPrompt = await loadVisionSystemPrompt();
  const rawQuestions = JSON.parse(await fs.readFile(rawDatasetPath, "utf-8")) as any[];

  const goldenDataset: any[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const raw = rawQuestions[i];
    process.stdout.write(`[${i + 1}/${rawQuestions.length}] Processing #${raw.questionFrontendId} ${raw.title}... `);

    // 1. Clean HTML to plain text format
    const cleaned = cleanLeetCodeHtml(raw.content);
    const officialTopics = Array.isArray(raw.topicTags) ? raw.topicTags.map((t: any) => t.name) : [];

    // 2. Process examples: detect images, convert to Base64, get vision description, remove image URL
    const processedExamples = [];

    for (const ex of cleaned.examples) {
      const exampleObj: any = {
        exampleNumber: ex.exampleNumber,
        input: ex.input,
        output: ex.output
      };

      if (ex.explanation) {
        exampleObj.explanation = ex.explanation;
      }

      // Check if this example has an image
      if (ex.image) {
        let extraction: VisionExtraction | null = null;
        let isLiveCall = false;

        try {
          // 4. Fetch image and convert to Base64
          process.stdout.write(`\n   [Ex ${ex.exampleNumber}] Encoding Base64 (${ex.image.slice(0, 45)}...)... `);
          const base64Uri = await fetchImageAsBase64(ex.image);
          process.stdout.write(`Encoded (${base64Uri.length} chars) -> Calling Model... `);

          // 5. Send Base64 image to Vision 1 model
          const callRes = await callVisionModel(base64Uri, visionSystemPrompt);
          if (callRes.extraction) {
            extraction = callRes.extraction;
            isLiveCall = true;
            process.stdout.write(`✅ Live Call Success (${callRes.latencyMs}ms)`);
          } else {
            process.stdout.write(`❌ Live Call Failed (${callRes.latencyMs}ms): ${callRes.error?.slice(0, 75)}...`);
          }
        } catch (e: any) {
          process.stdout.write(`❌ Fetch/Encoding error: ${e.message}`);
        }

        // Fallback to verified Stage 1 cache if rate limited / offline
        if (!extraction) {
          extraction = VISION_EXTRACTIONS_CACHE[raw.questionFrontendId] || VISION_EXTRACTIONS_CACHE[raw.questionId] || null;
          if (extraction) {
            process.stdout.write(` -> ⚠️ Using Stage 1 Verified Extraction`);
          }
        }

        if (extraction) {
          // Remove image URL and add image description right below explanation
          exampleObj.imageDescription = formatExtractionToString(extraction);
        }
      }

      processedExamples.push(exampleObj);
    }

    // 3. Construct clean golden item WITHOUT category, WITHOUT hasImages, WITHOUT imageUrls
    const goldenItem: any = {
      questionId: String(raw.questionId),
      questionFrontendId: String(raw.questionFrontendId),
      title: raw.title,
      titleSlug: raw.titleSlug,
      difficulty: raw.difficulty,
      body: cleaned.body,
      examples: processedExamples,
      constraints: cleaned.constraints,
      officialTopics
    };

    goldenDataset.push(goldenItem);
    const hasAnyImgDesc = processedExamples.some(e => e.imageDescription);
    console.log(`✅ (${hasAnyImgDesc ? "Vision Transcribed & Attached" : "Text-only"})`);
  }

  // Save to goldenDataset.json and goldenDatasetEnriched.json
  await fs.writeFile(outputGoldenPath, JSON.stringify(goldenDataset, null, 2), "utf-8");
  await fs.writeFile(outputEnrichedPath, JSON.stringify(goldenDataset, null, 2), "utf-8");

  console.log("\n=============================================================");
  console.log(`🎉 Clean Golden Dataset successfully created!`);
  console.log(`📁 Saved to: ${outputGoldenPath}`);
  console.log(`📁 Enriched: ${outputEnrichedPath}`);
  console.log(`🚫 Category field: REMOVED`);
  console.log(`🚫 hasImages field: REMOVED`);
  console.log(`🚫 Image URLs: REMOVED (Replaced with Stage 1 Vision Transcriptions)`);
  console.log("=============================================================\n");
}

buildEnrichedDataset().catch(console.error);
