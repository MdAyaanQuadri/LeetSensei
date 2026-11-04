import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { modelSelection } from "../../core/modelSelection.js";
import type {
  GoldenVisionItem,
  VisionExtractionOutput,
  CandidateRunResult,
  JudgeEvaluationOutput,
  JudgeScoreItem,
  UnifiedTestCaseReport,
  UnifiedEvaluationReport
} from "./types.js";

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

// File paths
const visionSystemDir = path.resolve(__dirname, "prompts/visionSystem");
const judgePromptPath = path.resolve(__dirname, "prompts/llmAsJudge/llmAsJudgePrompt.txt");
const goldenDatasetPath = path.resolve(__dirname, "data/goldenDataset.json");
const rubricsPath = path.resolve(__dirname, "data/rubics.json");
const resultsDir = path.resolve(__dirname, "results");

// Judge Model (Flagship 550B Parameter Reasoning Model - $0 Free Tier)
const JUDGE_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

// =========================================================================
// 1. BENCHLM FORMULA & SELECTION
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

async function loadVisionSystemPrompt(baseDir: string): Promise<string> {
  const p1 = await fs.readFile(path.join(baseDir, "1_instruction.txt"), "utf-8");
  const p2 = await fs.readFile(path.join(baseDir, "2_inputGrounding.txt"), "utf-8");
  const p3 = await fs.readFile(path.join(baseDir, "3_extractionRules.txt"), "utf-8");
  const schema = await fs.readFile(path.join(baseDir, "outputSchema.json"), "utf-8");
  const example = await fs.readFile(path.join(baseDir, "outputExample.json"), "utf-8");

  return [
    p1,
    p2,
    p3,
    `OUTPUT SCHEMA:\n${schema}`,
    `OUTPUT EXAMPLE:\n${example}`
  ].join("\n\n");
}

/**
 * Phase 1: Calls the candidate vision model on the diagram image + grounding context
 */
async function callCandidateVisionModel(
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

/**
 * Phase 2: Automatically grades the candidate output using the 550B LLM-as-a-Judge
 */
async function callJudgeModel(
  judgeSystemPrompt: string,
  userPayload: string
): Promise<{ output: JudgeEvaluationOutput | null; latencyMs: number; error?: string }> {
  const startTime = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: judgeSystemPrompt },
          { role: "user", content: userPayload }
        ]
      })
    });

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      return { output: null, latencyMs, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || "";
    const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson) as any;

    const personalList: JudgeScoreItem[] = Array.isArray(parsed.personal)
      ? parsed.personal
      : Array.isArray(parsed.personalRubrics)
      ? parsed.personalRubrics
      : [];

    const generalList: JudgeScoreItem[] = Array.isArray(parsed.general)
      ? parsed.general
      : Array.isArray(parsed.generalRubrics)
      ? parsed.generalRubrics
      : [];

    const totalScore = typeof parsed.total === "number"
      ? parsed.total
      : personalList.reduce((acc, p) => acc + (p.awarded || 0), 0) +
        generalList.reduce((acc, g) => acc + (g.awarded || 0), 0);

    return {
      output: {
        personal: personalList,
        general: generalList,
        total: totalScore
      },
      latencyMs
    };
  } catch (err: any) {
    return { output: null, latencyMs: Date.now() - startTime, error: err.message };
  }
}

async function run(): Promise<void> {
  const isPilot = process.argv.includes("--pilot");

  console.log(`\n=============================================================`);
  console.log(`🎯 LeetSensei: Unified Vision & Judge Evaluation Pipeline`);
  console.log(`👨‍⚖️  Automated Judge: ${JUDGE_MODEL}`);
  console.log(`Mode: ${isPilot ? "PILOT RUN (1 test case)" : "FULL RUN (all 12 test cases)"}`);
  console.log(`=============================================================\n`);

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

  // Load prompts & datasets
  const visionPrompt = await loadVisionSystemPrompt(visionSystemDir);
  const judgePrompt = await fs.readFile(judgePromptPath, "utf-8");
  const rawDataset = await fs.readFile(goldenDatasetPath, "utf-8");
  const rubricsData = JSON.parse(await fs.readFile(rubricsPath, "utf-8")) as any[];
  const allItems = JSON.parse(rawDataset) as GoldenVisionItem[];

  const count = isPilot ? 1 : Math.min(allItems.length, rubricsData.length);
  await fs.mkdir(resultsDir, { recursive: true });

  for (const modelToTest of modelsToEvaluate) {
    console.log(`\n-------------------------------------------------------------`);
    console.log(`🤖 Starting End-to-End Evaluation for: ${modelToTest}`);
    console.log(`-------------------------------------------------------------`);

    const scorecard: UnifiedTestCaseReport[] = [];
    let grandTotal = 0;
    let maxPossibleTotal = 0;
    let totalCandidateLatency = 0;
    let validJsonCount = 0;

    for (let i = 0; i < count; i++) {
      const item = allItems[i];
      const rubric = rubricsData[i];
      if (!item || !rubric) continue;

      const maxPersonal = rubric.personalRubrics.reduce((acc: number, p: any) => acc + (p.maxPoints || 0), 0);
      const maxPossible = maxPersonal + 3; // 3 general points
      maxPossibleTotal += maxPossible;

      console.log(`\n[${i + 1}/${count}] Processing Q#${item.questionId} ${item.questionName} (Ex ${item.exampleNumber})...`);

      // 1. Candidate Vision Model Call
      const candidateRes = await callCandidateVisionModel(modelToTest, visionPrompt, item);
      totalCandidateLatency += candidateRes.latencyMs;
      if (candidateRes.isValidJson) validJsonCount++;

      if (candidateRes.error || !candidateRes.parsedOutput) {
        console.error(`   ❌ Candidate Error (${candidateRes.latencyMs}ms):`, candidateRes.error);
        scorecard.push({
          testCaseId: item.id,
          questionId: item.questionId,
          questionName: item.questionName,
          exampleNumber: item.exampleNumber,
          candidateLatencyMs: candidateRes.latencyMs,
          judgeLatencyMs: 0,
          score: `0 / ${maxPossible}`,
          percentage: "0.0%",
          maxPoints: maxPossible,
          awardedPoints: 0,
          candidateExtraction: null,
          judgeEvaluation: null,
          error: candidateRes.error
        });
        continue;
      }

      console.log(`   👁️  Candidate Extracted in ${candidateRes.latencyMs}ms (Structure: ${candidateRes.parsedOutput.dataStructure})`);

      // 2. Automated LLM Judge Evaluation
      const judgePayload = `
Problem: ${rubric.problemContext.questionName} (Example ${rubric.problemContext.exampleNumber})
Input: ${rubric.problemContext.input}
Output: ${rubric.problemContext.output}

Candidate Output:
${JSON.stringify(candidateRes.parsedOutput, null, 2)}

Personal Rubrics:
${JSON.stringify(rubric.personalRubrics, null, 2)}
`;

      const judgeRes = await callJudgeModel(judgePrompt, judgePayload);

      if (judgeRes.error || !judgeRes.output) {
        console.error(`   ❌ Judge Error (${judgeRes.latencyMs}ms):`, judgeRes.error);
        scorecard.push({
          testCaseId: item.id,
          questionId: item.questionId,
          questionName: item.questionName,
          exampleNumber: item.exampleNumber,
          candidateLatencyMs: candidateRes.latencyMs,
          judgeLatencyMs: judgeRes.latencyMs,
          score: `0 / ${maxPossible}`,
          percentage: "0.0%",
          maxPoints: maxPossible,
          awardedPoints: 0,
          candidateExtraction: candidateRes.parsedOutput,
          judgeEvaluation: null,
          error: judgeRes.error
        });
      } else {
        const awardedPoints = judgeRes.output.total;
        grandTotal += awardedPoints;
        const casePercentage = `${((awardedPoints / maxPossible) * 100).toFixed(1)}%`;

        console.log(`   ⚖️  Judged in ${judgeRes.latencyMs}ms | Score: ${awardedPoints}/${maxPossible} (${casePercentage})`);

        // Log specific deductions if any
        judgeRes.output.personal.forEach((p) => {
          const check = rubric.personalRubrics.find((r: any) => r.id === p.id);
          const max = check ? check.maxPoints : "?";
          if (p.awarded < max) {
            console.log(`      ⚠️  Deduction [${p.id}]: ${p.awarded}/${max} -> ${p.reason}`);
          }
        });

        judgeRes.output.general.forEach((g) => {
          if (g.awarded < 1) {
            console.log(`      ⚠️  Deduction [${g.id}]: ${g.awarded}/1 -> ${g.reason}`);
          }
        });

        scorecard.push({
          testCaseId: item.id,
          questionId: item.questionId,
          questionName: item.questionName,
          exampleNumber: item.exampleNumber,
          candidateLatencyMs: candidateRes.latencyMs,
          judgeLatencyMs: judgeRes.latencyMs,
          score: `${awardedPoints} / ${maxPossible}`,
          percentage: casePercentage,
          maxPoints: maxPossible,
          awardedPoints,
          candidateExtraction: candidateRes.parsedOutput,
          judgeEvaluation: judgeRes.output
        });
      }

      // Small delay between calls to respect rate limits
      if (i < count - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Consolidated metrics
    const avgLatency = Math.round(totalCandidateLatency / count);
    const overallPercentage = `${((grandTotal / maxPossibleTotal) * 100).toFixed(1)}%`;
    const jsonRate = `${((validJsonCount / count) * 100).toFixed(1)}%`;

    const unifiedReport: UnifiedEvaluationReport = {
      model: modelToTest,
      judgeModel: JUDGE_MODEL,
      executedAt: new Date().toISOString(),
      metrics: {
        totalScore: grandTotal,
        maxScore: maxPossibleTotal,
        percentage: overallPercentage,
        avgLatencyMs: avgLatency,
        validJsonRate: jsonRate,
        totalCases: count
      },
      scorecard
    };

    // Save unified report file
    const sanitizedModelName = modelToTest.replace(/[/:]/g, "_");
    const outFileName = isPilot ? `${sanitizedModelName}_unified_pilot.json` : `${sanitizedModelName}_unified_report.json`;
    const outFilePath = path.join(resultsDir, outFileName);

    await fs.writeFile(outFilePath, JSON.stringify(unifiedReport, null, 2), "utf-8");

    // Display ASCII Scorecard Table in Console
    console.log(`\n========================================================================================`);
    console.log(`🏆 FINAL BENCHMARK SCORECARD: ${modelToTest}`);
    console.log(`========================================================================================`);
    console.log(`Problem Name                            Latency    Score       Percent    Result`);
    console.log(`----------------------------------------------------------------------------------------`);
    for (const sc of scorecard) {
      const qName = `${sc.questionName} (Ex ${sc.exampleNumber})`.padEnd(38);
      const lat = `${sc.candidateLatencyMs}ms`.padEnd(10);
      const scStr = sc.score.padEnd(11);
      const pct = sc.percentage.padEnd(10);
      const status = sc.awardedPoints >= sc.maxPoints * 0.8 ? "✅ PASS" : "⚠️ REVIEW";
      console.log(`${qName} ${lat} ${scStr} ${pct} ${status}`);
    }
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`⭐ OVERALL COMPOSITE: ${grandTotal} / ${maxPossibleTotal} (${overallPercentage}) | Avg Latency: ${avgLatency}ms | Valid JSON: ${jsonRate}`);
    console.log(`📁 Complete Report Saved To: ${outFilePath}`);
    console.log(`========================================================================================\n`);
  }
}

run().catch((err) => {
  console.error("Fatal Pipeline Error:", err);
  process.exit(1);
});
