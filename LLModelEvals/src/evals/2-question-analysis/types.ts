import type {ExampleItem} from '../../core/types.js'
export type LeetCodeTopicSlug = string;

// ==========================================
// 1. INPUT QUESTION STRUCTURE (Cleaned)
// ==========================================


export interface QuestionAnalysisInput {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  body: string;
  examples: ExampleItem[];
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
