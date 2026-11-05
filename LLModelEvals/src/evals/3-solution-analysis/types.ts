/**
 * Stage 3: Solution Analysis Evaluation Types
 */

export interface SolutionAnalysisInput {
  questionFrontendId: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  body: string;
  constraints: string[];
  // Stage 2 Question Analysis Capsule passed as context
  questionAnalysis: {
    crux: string;
    optimalTimeComplexity: string;
    optimalSpaceComplexity: string;
    allowedTopicSlugs: string[];
  };
  // User's Accepted Submission Data
  submission: {
    submissionId: string;
    language: string;
    code: string;
    runtimePercentile?: number | null;
    memoryPercentile?: number | null;
  };
}

export interface SolutionTopicsOutput {
  canSolveWith: string[];
  userUsed: string[];
}

export interface SolutionComplexityOutput {
  userTime: string;
  userSpace: string;
  optimalTime: string;
  optimalSpace: string;
  isTimeOptimal: boolean;
  isSpaceOptimal: boolean;
  guidance: string | null;
}

export interface SolutionCodeQualityOutput {
  strengths: string[];
  improvements: string[];
}

export interface SolutionAnalysisOutput {
  topics: SolutionTopicsOutput;
  complexity: SolutionComplexityOutput;
  codeQuality: SolutionCodeQualityOutput;
}

export interface SolutionPersonalRubric {
  id: string; // e.g. "PR_1"
  name: string;
  description: string;
  maxPoints: number;
  expectedValue?: string | boolean | string[] | null | undefined;
}

export interface SolutionQuestionRubricItem {
  questionFrontendId: string;
  title: string;
  testCaseId: string; // e.g. "42_optimal" or "42_suboptimal"
  solutionType: "optimal" | "suboptimal";
  expectedUserUsedTopics: string[];
  expectedUserTime: string;
  expectedUserSpace: string;
  optimalTime: string;
  optimalSpace: string;
  isTimeOptimal: boolean;
  isSpaceOptimal: boolean;
  personalRubrics: SolutionPersonalRubric[];
}

export interface SolutionJudgeScoreItem {
  id: string;
  awarded: number;
  reason?: string;
  evidence?: string;
}

export interface SolutionJudgeEvaluationOutput {
  personal: SolutionJudgeScoreItem[];
  general: SolutionJudgeScoreItem[];
  total: number;
}

export interface UnifiedSolutionTestCaseReport {
  testCaseId: string;
  questionFrontendId: string;
  title: string;
  difficulty: string;
  solutionType: "optimal" | "suboptimal";
  candidateLatencyMs: number;
  judgeLatencyMs: number;
  score: string;
  percentage: string;
  maxPoints: number;
  awardedPoints: number;
  candidateOutput: SolutionAnalysisOutput | null;
  judgeEvaluation: SolutionJudgeEvaluationOutput | null;
  error?: string | undefined;
}

export interface SolutionAnalysisEvalReport {
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
  scorecard: UnifiedSolutionTestCaseReport[];
}
