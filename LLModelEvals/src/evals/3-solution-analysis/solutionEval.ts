import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { modelSelection } from "../../core/modelSelection.js";
import type {
  SolutionAnalysisInput,
  SolutionAnalysisOutput,
  SolutionQuestionRubricItem,
  SolutionJudgeEvaluationOutput,
  SolutionJudgeScoreItem,
  UnifiedSolutionTestCaseReport,
  SolutionAnalysisEvalReport
} from "./types.js";

// Load environment variables (.env in LLModelEvals directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../../.env");

try {
  (process as any).loadEnvFile(envPath);
} catch {
  // Ignore if already loaded or not found
}

const apiKey = process.env.openRouter || process.env.OPENROUTER_API_KEY;

// =========================================================================
// 🎛️ MODEL CONFIGURATION (ZERO-BUDGET BENCHLM ROUTING)
// =========================================================================
const DEFAULT_FREE_MODEL = "nvidia/nemotron-3.5-lightning:free";

// Judge Model: High-capacity 550B MoE with strict JSON schema compliance
const JUDGE_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

// Paths
const dataDir = path.resolve(__dirname, "./data");
const solutionsDatasetPath = path.resolve(dataDir, "goldenSolutions.json");
const rubricsPath = path.resolve(dataDir, "solutionRubics.json");
const promptsDir = path.resolve(__dirname, "./prompts");
const resultsDir = path.resolve(__dirname, "./results");

/**
 * Assembles the Solution Analysis system prompt dynamically from modular components
 */
async function loadSolutionAnalysisSystemPrompt(): Promise<string> {
  const instruction = await fs.readFile(path.join(promptsDir, "instruction.txt"), "utf-8");
  const rules = await fs.readFile(path.join(promptsDir, "rulesPrompt.txt"), "utf-8");
  const schema = await fs.readFile(path.join(promptsDir, "schema.json"), "utf-8");
  const example = await fs.readFile(path.join(promptsDir, "example.json"), "utf-8");

  return `${instruction.trim()}

${rules.trim()}

OUTPUT SCHEMA:
${schema.trim()}

EXAMPLE DEMONSTRATION:
${example.trim()}
`;
}

/**
 * Loads the LLM-as-a-Judge system prompt
 */
async function loadJudgePrompt(): Promise<string> {
  return fs.readFile(
    path.join(promptsDir, "llmAsJudge/solutionJudgePrompt.txt"),
    "utf-8"
  );
}

/**
 * Calls candidate Solution Analysis model via OpenRouter
 */
async function callCandidateModel(
  model: string,
  systemPrompt: string,
  input: SolutionAnalysisInput
): Promise<{
  rawOutput: string;
  parsedOutput: SolutionAnalysisOutput | null;
  isValidJson: boolean;
  latencyMs: number;
  error?: string | undefined;
}> {
  const startTime = Date.now();

  const userPayload = {
    problem: {
      questionFrontendId: input.questionFrontendId,
      title: input.title,
      difficulty: input.difficulty,
      body: input.body,
      constraints: input.constraints
    },
    questionAnalysisCapsule: input.questionAnalysis,
    userSubmission: {
      language: input.submission.language,
      code: input.submission.code,
      runtimePercentile: input.submission.runtimePercentile,
      memoryPercentile: input.submission.memoryPercentile
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        reasoning: { effort: "none" },
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this user's accepted solution and output the Solution Analysis JSON capsule:\n\n${JSON.stringify(userPayload, null, 2)}`
          }
        ]
      })
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      return {
        rawOutput: "",
        parsedOutput: null,
        isValidJson: false,
        latencyMs,
        error: `HTTP ${res.status}: ${errText}`
      };
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || "";

    let parsedOutput: SolutionAnalysisOutput | null = null;
    let isValidJson = false;

    if (rawContent) {
      const cleanContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      try {
        parsedOutput = JSON.parse(cleanContent) as SolutionAnalysisOutput;
        isValidJson = true;
      } catch {
        isValidJson = false;
      }
    }

    return {
      rawOutput: rawContent,
      parsedOutput,
      isValidJson,
      latencyMs
    };
  } catch (err: any) {
    return {
      rawOutput: "",
      parsedOutput: null,
      isValidJson: false,
      latencyMs: Date.now() - startTime,
      error: err.message
    };
  }
}

/**
 * Calls 550B LLM-as-a-Judge with 4-layer anti-hallucination asserts
 */
async function callJudgeModel(
  judgeSystemPrompt: string,
  userPayload: string,
  maxPersonalPoints: number
): Promise<{
  output: SolutionJudgeEvaluationOutput | null;
  latencyMs: number;
  error?: string | undefined;
}> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        response_format: { type: "json_object" },
        reasoning: { effort: "none" },
        max_tokens: 1500,
        messages: [
          { role: "system", content: judgeSystemPrompt },
          { role: "user", content: userPayload }
        ]
      })
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      return { output: null, latencyMs, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || "";
    const cleanJson = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson) as any;

    const rawPersonal: any[] = Array.isArray(parsed.personal) ? parsed.personal : [];
    const rawGeneral: any[] = Array.isArray(parsed.general) ? parsed.general : [];

    // 1. Programmatic Clamp on each personal rubric (max 1.0 pt)
    const personalList: SolutionJudgeScoreItem[] = rawPersonal.map((item: any, idx: number) => {
      let awarded = typeof item.awarded === "number" ? item.awarded : 0;
      awarded = Math.max(0, Math.min(1.0, awarded));

      return {
        id: item.id || `PR_${idx + 1}`,
        awarded,
        evidence: item.evidence || undefined,
        reason: item.reason || (awarded > 0 ? "Criteria met" : "Criteria not met")
      };
    });

    // 2. Programmatic Clamp on General Rubrics (max 1.0 pt each)
    const generalList: SolutionJudgeScoreItem[] = rawGeneral.map((item: any, idx: number) => {
      let awarded = typeof item.awarded === "number" ? item.awarded : 0;
      awarded = Math.max(0, Math.min(1.0, awarded));

      return {
        id: item.id || `GR_${idx + 1}`,
        awarded,
        reason: item.reason || (awarded > 0 ? "Criteria met" : "Criteria not met")
      };
    });

    // 3. Programmatic sum of totals
    const personalSum = personalList.reduce((acc, p) => acc + (p.awarded || 0), 0);
    const generalSum = generalList.reduce((acc, g) => acc + (g.awarded || 0), 0);
    const calculatedTotal = Number((personalSum + generalSum).toFixed(2));

    return {
      output: {
        personal: personalList,
        general: generalList,
        total: calculatedTotal
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
  console.log(`🧠 LeetSensei: Stage 3 Solution Analysis Evaluation Pipeline`);
  console.log(`👨‍⚖️  Automated Judge: ${JUDGE_MODEL} (4-Layer Anti-Hallucination Shield)`);
  console.log(`Mode: ${isPilot ? "PILOT RUN (1 test solution)" : "FULL RUN"}`);
  console.log(`=============================================================\n`);

  // 1. Dynamic Model Selection via BenchLM Formula under ₹0 Budget
  console.log("🔍 Running BenchLM Model Selection Engine (Budget: ₹0)...");
  let modelToTest = DEFAULT_FREE_MODEL;

  try {
    const topCandidates = await modelSelection(
      0, // ₹0 Monthly Budget
      2000,
      800,
      100,
      (latency, reasoning, coding, math) =>
        0.45 * coding + 0.35 * reasoning + 0.20 * latency
    );

    console.log(`🏆 BenchLM Formula Top 3 Zero-Cost Candidates:`);
    for (const c of topCandidates.slice(0, 3)) {
      console.log(`   - ${c.name} (${c.canonicalModelKey}) | Coding: ${c.codingScore} | Reasoning: ${c.reasoningScore} | Score: ${c.UseCaseScore.toFixed(3)}`);
    }
  } catch (e: any) {
    console.warn("⚠️ BenchLM calculation fallback to default:", e.message);
  }

  // Allow CLI override: e.g. npm run solnEval -- --model cohere/north-mini-code:free
  const modelArgIdx = process.argv.indexOf("--model");
  if (modelArgIdx !== -1 && process.argv[modelArgIdx + 1]) {
    modelToTest = process.argv[modelArgIdx + 1]!;
  }

  console.log(`\n🎯 Candidate Model Selected for Evaluation: ${modelToTest}\n`);

  // 2. Load Prompts & Data
  const solutionSystemPrompt = await loadSolutionAnalysisSystemPrompt();
  const judgePrompt = await loadJudgePrompt();

  const allSolutions = JSON.parse(await fs.readFile(solutionsDatasetPath, "utf-8")) as SolutionAnalysisInput[];
  const rubricsData = JSON.parse(await fs.readFile(rubricsPath, "utf-8")) as SolutionQuestionRubricItem[];
  const rubricMap = new Map<string, SolutionQuestionRubricItem>(
    rubricsData.map((r) => [r.testCaseId, r])
  );

  const count = isPilot ? 1 : allSolutions.length;

  const scorecard: UnifiedSolutionTestCaseReport[] = [];
  let grandTotal = 0;
  let maxPossibleTotal = 0;
  let totalCandidateLatency = 0;
  let validJsonCount = 0;

  for (let i = 0; i < count; i++) {
    const input = allSolutions[i];
    if (!input) continue;
    const rubric = rubricsData[i];
    if (!rubric) {
      console.warn(`⚠️ No rubric found for test case #${i + 1}`);
      continue;
    }

    const maxPersonal = rubric.personalRubrics.reduce((acc, p) => acc + (p.maxPoints || 0), 0);
    const maxPossible = maxPersonal + 4; // 4 general rubrics (GR_1 to GR_4)
    maxPossibleTotal += maxPossible;

    console.log(`\n[${i + 1}/${count}] TestCase: ${rubric.testCaseId} | Q#${input.questionFrontendId}: ${input.title} (${rubric.solutionType.toUpperCase()})...`);
    console.log(`   🤖 [Step 1/2] Generating Solution Analysis with ${modelToTest}...`);

    // 1. Call Candidate Model
    const candidateRes = await callCandidateModel(modelToTest, solutionSystemPrompt, input);
    totalCandidateLatency += candidateRes.latencyMs;
    if (candidateRes.isValidJson) validJsonCount++;

    if (candidateRes.error || !candidateRes.parsedOutput) {
      console.error(`   ❌ Candidate Error (${candidateRes.latencyMs}ms):`, candidateRes.error);
      scorecard.push({
        testCaseId: rubric.testCaseId,
        questionFrontendId: input.questionFrontendId,
        title: input.title,
        difficulty: input.difficulty,
        solutionType: rubric.solutionType,
        candidateLatencyMs: candidateRes.latencyMs,
        judgeLatencyMs: 0,
        score: `0 / ${maxPossible}`,
        percentage: "0.0%",
        maxPoints: maxPossible,
        awardedPoints: 0,
        candidateOutput: null,
        judgeEvaluation: null,
        error: candidateRes.error
      });
      continue;
    }

    const complexity = candidateRes.parsedOutput.complexity;
    console.log(`   💡 Candidate Finished (${candidateRes.latencyMs}ms) | User Time: ${complexity?.userTime} | Optimal Time: ${complexity?.optimalTime} | Time Optimal: ${complexity?.isTimeOptimal}`);
    console.log(`   ⚖️  [Step 2/2] Evaluating with 550B LLM-as-a-Judge (${JUDGE_MODEL})...`);

    // 2. Automated LLM Judge Evaluation
    const judgePayload = `Problem: #${input.questionFrontendId} ${input.title} (${input.difficulty})
Question Analysis Capsule:
${JSON.stringify(input.questionAnalysis, null, 2)}

User Submitted Code (${input.submission.language}):
\`\`\`${input.submission.language.toLowerCase()}
${input.submission.code}
\`\`\`

Candidate Solution Analysis Output:
${JSON.stringify(candidateRes.parsedOutput, null, 2)}

Personal Rubrics:
${JSON.stringify(rubric.personalRubrics, null, 2)}

General Rubrics:
GR_1: Strict JSON schema conformance.
GR_2: Big-O asymptotic notation correctness.
GR_3: Guidance null check (null when optimal, pedagogical string when suboptimal).
GR_4: Grounding in actual submitted code (no hallucinated variable names).
`;

    const judgeRes = await callJudgeModel(judgePrompt, judgePayload, maxPersonal);

    if (judgeRes.error || !judgeRes.output) {
      console.error(`   ❌ Judge Error (${judgeRes.latencyMs}ms):`, judgeRes.error);
      scorecard.push({
        testCaseId: rubric.testCaseId,
        questionFrontendId: input.questionFrontendId,
        title: input.title,
        difficulty: input.difficulty,
        solutionType: rubric.solutionType,
        candidateLatencyMs: candidateRes.latencyMs,
        judgeLatencyMs: judgeRes.latencyMs,
        score: `0 / ${maxPossible}`,
        percentage: "0.0%",
        maxPoints: maxPossible,
        awardedPoints: 0,
        candidateOutput: candidateRes.parsedOutput,
        judgeEvaluation: null,
        error: judgeRes.error
      });
    } else {
      const awarded = judgeRes.output.total;
      grandTotal += awarded;
      const pct = ((awarded / maxPossible) * 100).toFixed(1) + "%";

      console.log(`   👨‍⚖️  Judge Graded (${judgeRes.latencyMs}ms): ${awarded} / ${maxPossible} (${pct})`);

      scorecard.push({
        testCaseId: rubric.testCaseId,
        questionFrontendId: input.questionFrontendId,
        title: input.title,
        difficulty: input.difficulty,
        solutionType: rubric.solutionType,
        candidateLatencyMs: candidateRes.latencyMs,
        judgeLatencyMs: judgeRes.latencyMs,
        score: `${awarded} / ${maxPossible}`,
        percentage: pct,
        maxPoints: maxPossible,
        awardedPoints: awarded,
        candidateOutput: candidateRes.parsedOutput,
        judgeEvaluation: judgeRes.output
      });
    }

    // Courteous pacing
    await new Promise((r) => setTimeout(r, 300));
  }

  // 3. Print ASCII Scorecard
  const overallPct = maxPossibleTotal > 0 ? ((grandTotal / maxPossibleTotal) * 100).toFixed(1) + "%" : "0.0%";
  const avgLatency = count > 0 ? Math.round(totalCandidateLatency / count) : 0;
  const jsonRate = count > 0 ? ((validJsonCount / count) * 100).toFixed(1) + "%" : "0.0%";

  console.log(`\n========================================================================================`);
  console.log(`📊 FINAL SOLUTION ANALYSIS EVALUATION SCORECARD`);
  console.log(`========================================================================================`);
  console.log(`Model:           ${modelToTest}`);
  console.log(`Judge:           ${JUDGE_MODEL}`);
  console.log(`Overall Score:   ${grandTotal.toFixed(1)} / ${maxPossibleTotal} (${overallPct})`);
  console.log(`Valid JSON Rate: ${jsonRate}`);
  console.log(`Avg Latency:     ${avgLatency} ms`);
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(`| Test Case ID    | Problem Name                    | Type    | Cand(ms) | Judge(ms) | Score     | Pct    |`);
  console.log(`|-----------------|---------------------------------|---------|----------|-----------|-----------|--------|`);

  for (const item of scorecard) {
    const tId = item.testCaseId.padEnd(15, " ");
    const name = item.title.slice(0, 31).padEnd(31, " ");
    const type = item.solutionType.padEnd(7, " ");
    const cLat = String(item.candidateLatencyMs).padStart(8, " ");
    const jLat = String(item.judgeLatencyMs).padStart(9, " ");
    const sc = item.score.padStart(9, " ");
    const pct = item.percentage.padStart(6, " ");
    console.log(`| ${tId} | ${name} | ${type} | ${cLat} | ${jLat} | ${sc} | ${pct} |`);
  }
  console.log(`========================================================================================\n`);

  // 4. Save Final Report
  await fs.mkdir(resultsDir, { recursive: true });
  const sanitizedModel = modelToTest.replace(/[/:]/g, "_");
  const reportPath = path.resolve(
    resultsDir,
    `${sanitizedModel}_solution_analysis_${isPilot ? "pilot" : "report"}.json`
  );

  const report: SolutionAnalysisEvalReport = {
    model: modelToTest,
    judgeModel: JUDGE_MODEL,
    executedAt: new Date().toISOString(),
    metrics: {
      totalScore: Number(grandTotal.toFixed(1)),
      maxScore: maxPossibleTotal,
      percentage: overallPct,
      avgLatencyMs: avgLatency,
      validJsonRate: jsonRate,
      totalCases: count
    },
    scorecard
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`💾 Evaluation report saved to: ${reportPath}\n`);
}

run().catch((err) => {
  console.error("❌ Solution evaluation pipeline failed:", err);
  process.exit(1);
});
