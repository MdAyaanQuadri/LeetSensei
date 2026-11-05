import type {ExampleItem} from '../../core/types.js'
export type LeetCodeTopicSlug = string;

// ==========================================
// 1. INPUT QUESTION STRUCTURE (Cleaned)
// ==========================================


export interface EnrichedExampleItem {
  exampleNumber: number;
  input: string;
  output: string;
  explanation?: string;
  imageDescription?: string;
}

export interface QuestionAnalysisInput {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  body: string;
  examples: EnrichedExampleItem[];
  constraints: string[];
  officialTopics?: string[];
}

// ==========================================
// 2. STAGE 1: QUESTION ANALYSIS CAPSULE (AI-to-AI Output)
// ==========================================
export interface WrongApproach {
  name: string;
  verdict: "TLE" | "WA" | "RE" | "MLE";
  signal: string;
  reason: string;
}

export interface OptimalApproach {
  name: string;
  keyIdea: string;
  time: string;
  space: string;
  topics: LeetCodeTopicSlug[];
  invariants: string[];
  pitfalls: string[];
  recognizeBy: string[];
}

export interface AlternateApproach {
  name: string;
  keyIdea: string;
  time: string;
  space: string;
  topics: LeetCodeTopicSlug[];
  verdict: "Accepted" | "TLE" | "WA" | "RE" | "MLE";
  whyNotOptimal: string;
  recognizeBy: string[];
}

export interface QuestionAnalysisOutput {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  crux: string;
  edgeCases: string[];
  wrongApproaches: WrongApproach[];
  optimal: OptimalApproach;
  alternates: AlternateApproach[];
}

export interface QuestionRubricItem {
  questionId: string;
  questionFrontendId: string;
  title: string;
  difficulty: "Hard" | "Medium";
  personalRubrics: {
    id: string;
    criterion: string;
    maxPoints: number;
  }[];
}

// ==========================================
// 3. LLM-AS-A-JUDGE & EVALUATION REPORT TYPES
// ==========================================

export interface JudgeScoreItem {
  id: string;
  awarded: number;
  evidence?: string | undefined;
  reason: string;
}

export interface JudgeEvaluationOutput {
  personal: JudgeScoreItem[];
  general: JudgeScoreItem[];
  total: number;
}

export interface UnifiedQuestionAnalysisTestCaseReport {
  questionId: string;
  questionFrontendId: string;
  title: string;
  difficulty: string;
  candidateLatencyMs: number;
  judgeLatencyMs: number;
  score: string;
  percentage: string;
  maxPoints: number;
  awardedPoints: number;
  candidateOutput: QuestionAnalysisOutput | null;
  judgeEvaluation: JudgeEvaluationOutput | null;
  error?: string | undefined;
}

export interface QuestionAnalysisEvalReport {
  model: string;
  judgeModel: string;
  executedAt: string;
  metrics: {
    totalScore: number;
    maxScore: number;
    percentage: string;
    avgLatencyMs: number;
    validJsonRate: string;
    totalCases: number;
  };
  scorecard: UnifiedQuestionAnalysisTestCaseReport[];
}

