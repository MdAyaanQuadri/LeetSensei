// ==========================================
// 1. VISION MODEL EXTRACTION OUTPUT SCHEMA
// ==========================================
export interface VisionExtractionOutput {
  /** The identified data structure (e.g. Binary Tree, 2D Grid, Directed Graph, Elevation Map) */
  dataStructure: string;
  /** Structural links, root/parent/child relationships, matrix dimensions, or edges */
  topology: string;
  /** Exact integer values, node labels, or coordinate boundaries without approximation */
  elements: string[];
  /** Visual-specific features: shaded regions, colors, path arrows, state transitions, or 'None' */
  visualHighlights: string;
  /** Dense, unambiguous 40-80 word factual description for text-only downstream solvers */
  denseSummary: string;
}

// ==========================================
// 2. VISION EVALUATION DATASET CONTRACT
// ==========================================
export interface GoldenVisionItem {
  id: string; // crypto.randomUUID()
  questionId: string;
  questionName: string;
  topics: string[];
  exampleNumber: number;
  input: string;
  output: string;
  explanation?: string;
  image: string; // base64 data URI (data:image/...;base64,...)
}

export interface GoldenVisionUrlItem {
  id: string;
  questionId: string;
  questionName: string;
  topics: string[];
  exampleNumber: number;
  input: string;
  output: string;
  explanation?: string;
  imageUrl: string; // clean HTTPS URL
}

export interface CandidateRunResult {
  testCaseId: string;
  questionId: string;
  questionName: string;
  exampleNumber: number;
  latencyMs: number;
  rawOutput: string;
  parsedOutput: VisionExtractionOutput | null;
  isValidJson: boolean;
  error?: string;
}

export interface VisionDatasetItem {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  content: string;
  exampleNumber?: number;
  imageUrl?: string;
  groundTruth?: VisionExtractionOutput;
}

// ==========================================
// 3. UNIFIED EVALUATION REPORT TYPES
// ==========================================
export interface JudgeScoreItem {
  id: string;
  awarded: number;
  reason: string;
}

export interface JudgeEvaluationOutput {
  personal: JudgeScoreItem[];
  general: JudgeScoreItem[];
  total: number;
}

export interface UnifiedTestCaseReport {
  testCaseId: string;
  questionId: string | number;
  questionName: string;
  exampleNumber: number;
  candidateLatencyMs: number;
  judgeLatencyMs: number;
  score: string;
  percentage: string;
  maxPoints: number;
  awardedPoints: number;
  candidateExtraction: VisionExtractionOutput | null;
  judgeEvaluation: JudgeEvaluationOutput | null;
  error?: string | undefined;
}

export interface UnifiedEvaluationReport {
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
  scorecard: UnifiedTestCaseReport[];
}

// ==========================================
// 4. VISION JUDGE EVALUATION RUBRICS
// ==========================================
export interface VisionJudgeRubricScores {
  /** Accuracy of identified data structure and topological connectivity (0-10) */
  structuralFidelity: number;
  /** Precision and completeness of numerical values, coordinates, and labels (0-10) */
  valuePrecision: number;
  /** Absence of hallucinated nodes, phantom edges, or guessed values (0-10) */
  hallucinationControl: number;
  /** Usability and density of text description for an algorithm solver (0-10) */
  algorithmicUtility: number;
  /** Weighted composite score (0-10) */
  compositeScore: number;
  /** Judge reasoning and feedback */
  reasoning: string;
}


