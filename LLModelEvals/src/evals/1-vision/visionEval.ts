import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { modelSelection } from "../../core/modelSelection.js";
import type { GoldenVisionItem, VisionExtractionOutput, CandidateRunResult } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, "../../../.env");
try {
  process.loadEnvFile(envPath);
} catch {
  // Ignore if already loaded or not found
}

const apiKey = process.env.openRouter || process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("❌ Error: OpenRouter API key not found in .env (expected 'openRouter' or 'OPENROUTER_API_KEY').");
  process.exit(1);
}

const visionSystemDir = path.resolve(__dirname, "prompts/visionSystem");
const goldenDatasetPath = path.resolve(__dirname, "data/goldenDataset.json");
const resultsDir = path.resolve(__dirname, "results");

// =========================================================================
// 1. BENCHLM FORMULA & OPENROUTER MAPPING
// =========================================================================
const useCaseFormula = (
  normalisedLatency: number,
  normalisedReasoningScore: number,
  normalisedCodingScore: number,
  normalisedMathScore: number,
  normalisedMultimodalGroundedScore: number
): number => {
  return (
    0.55 * normalisedMultimodalGroundedScore +
    0.20 * normalisedReasoningScore +
    0.15 * normalisedCodingScore +
    0.10 * normalisedLatency
  );
};

async function loadSystemPrompt(baseDir: string): Promise<string> {
  const p1 = await fs.readFile(path.join(baseDir, "1_instruction.txt"), "utf-8");
  const p2 = await fs.readFile(path.join(baseDir, "2_inputGrounding.txt"), "utf-8");
  const p3 = await fs.readFile(path.join(baseDir, "3_extractionRules.txt"), "utf-8");
  const p4 = await fs.readFile(path.join(baseDir, "4_outputRules.txt"), "utf-8");
  const schema = await fs.readFile(path.join(baseDir, "schema.json"), "utf-8");
  const example = await fs.readFile(path.join(baseDir, "example.json"), "utf-8");

  return [
    p1,
    p2,
    p3,
    p4,
    `SCHEMA:\n${schema}`,
    `EXAMPLE:\n${example}`
  ].join("\n\n");
}

async function callVisionModel(
  model: string,
  systemPrompt: string,
  item: GoldenVisionItem
): Promise<CandidateRunResult> {
  const userText = `Problem: ${item.questionName}\nExample: ${item.exampleNumber}\nInput: ${item.input}\nOutput: ${item.output}`;

  const startTime = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: item.image } }
            ]
          }
        ]
      })
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      return {
        testCaseId: item.id,
        questionId: item.questionId,
        questionName: item.questionName,
        exampleNumber: item.exampleNumber,
        latencyMs,
        rawOutput: errText,
        parsedOutput: null,
        isValidJson: false,
        error: `HTTP ${res.status}: ${errText}`
      };
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || "";
    let parsedOutput: VisionExtractionOutput | null = null;
    let isValidJson = false;

    try {
      parsedOutput = JSON.parse(rawContent) as VisionExtractionOutput;
      isValidJson = true;
    } catch {
      // Check if wrapped in markdown code fences
      const cleanContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        parsedOutput = JSON.parse(cleanContent) as VisionExtractionOutput;
        isValidJson = true;
      } catch {
        isValidJson = false;
      }
    }

    return {
      testCaseId: item.id,
      questionId: item.questionId,
      questionName: item.questionName,
      exampleNumber: item.exampleNumber,
      latencyMs,
      rawOutput: rawContent,
      parsedOutput,
      isValidJson
    };
  } catch (err: any) {
    return {
      testCaseId: item.id,
      questionId: item.questionId,
      questionName: item.questionName,
      exampleNumber: item.exampleNumber,
      latencyMs: Date.now() - startTime,
      rawOutput: "",
      parsedOutput: null,
      isValidJson: false,
      error: err.message
    };
  }
}

async function run(): Promise<void> {
  const isPilot = process.argv.includes("--pilot");

  console.log(`\n==========================================`);
  console.log(`🎯 Vision Model Evaluation Runner`);
  console.log(`Mode: ${isPilot ? "PILOT RUN (1 test case)" : "FULL RUN (all test cases)"}`);
  console.log(`==========================================\n`);

  // 1. Dynamically compute the top models via BenchLM formula
  console.log("🔍 Computing Top Vision Models from BenchLM data...");
  const selectedCandidates = await modelSelection(0, 5000, 300, 20, useCaseFormula);
  const topSelectedModels = selectedCandidates.slice(0, 3).map((m) => m.canonicalModelKey);

  console.log("🏆 Top 3 Models Selected by Formula:", topSelectedModels);

  // =========================================================================
  // TOGGLE: CHOOSE EVALUATION TARGETS
  // =========================================================================
  // 👉 ACTIVE ($0 Zero-Budget Mode):
  const modelsToEvaluate = ["dots-studio/dots-3-note-preview:free"];

  // 👉 PRODUCTION (Uncomment when funded to evaluate top 3 models):
  // const modelsToEvaluate = topSelectedModels;
  // =========================================================================

  console.log("🚀 Evaluating Models:", modelsToEvaluate);

  const systemPrompt = await loadSystemPrompt(visionSystemDir);
  const rawDataset = await fs.readFile(goldenDatasetPath, "utf-8");
  const allItems = JSON.parse(rawDataset) as GoldenVisionItem[];
  const testCases = isPilot ? allItems.slice(0, 1) : allItems;

  await fs.mkdir(resultsDir, { recursive: true });

  for (const modelToTest of modelsToEvaluate) {
    console.log(`\n------------------------------------------`);
    console.log(`🤖 Starting evaluation for: ${modelToTest}`);
    console.log(`------------------------------------------`);

    const results: CandidateRunResult[] = [];
    let i = 0;

    for (const item of testCases) {
      i++;
      console.log(`\n[${i}/${testCases.length}] Calling ${modelToTest} on: Q#${item.questionId} ${item.questionName} (Ex ${item.exampleNumber})...`);

      const result = await callVisionModel(modelToTest, systemPrompt, item);
      results.push(result);

      if (result.error) {
        console.error(`❌ Error (${result.latencyMs}ms):`, result.error);
      } else {
        console.log(`✅ Success in ${result.latencyMs}ms | Valid JSON: ${result.isValidJson}`);
        if (result.parsedOutput) {
          console.log(`   • Data Structure:`, result.parsedOutput.dataStructure);
          console.log(`   • Visual Highlights:`, result.parsedOutput.visualHighlights);
          console.log(`   • Dense Summary:`, result.parsedOutput.denseSummary);
        } else {
          console.log(`   Raw Output:`, result.rawOutput.slice(0, 200));
        }
      }

      // Small delay between calls to respect rate limits if running multiple
      if (i < testCases.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const sanitizedModelName = modelToTest.replace(/[/:]/g, "_");
    const outFileName = isPilot ? `${sanitizedModelName}_pilot.json` : `${sanitizedModelName}_full.json`;
    const outFilePath = path.join(resultsDir, outFileName);

    await fs.writeFile(outFilePath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`📁 Saved results for ${modelToTest} to: ${outFilePath}`);
  }

  console.log(`\n==========================================`);
  console.log(`🎉 All Evaluations Complete!`);
  console.log(`==========================================\n`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
