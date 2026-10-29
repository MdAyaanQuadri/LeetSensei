import * as fs from "node:fs/promises";

import type {
  ModelBenchmarkRanking,
  ModelPricingSpec,
  ModelDetailProfile,
  ModelSpeedSpec,
  MergedModelCandidate,
  MergedModelCandidateNormalised
} from "./types.js";

// Safe cross-platform path resolution relative to this file
const loadData = async (filename: string) => {
  return fs.readFile(new URL(`../LLMdata/${filename}`, import.meta.url), "utf-8");
};

const leaderboardRaw = await loadData("leaderboard.json");
const modelsRaw = await loadData("models.json");
const pricingRaw = await loadData("pricing.json");
const speedRaw = await loadData("speed.json");

const unFilteredLeaderboard = JSON.parse(leaderboardRaw);
const codingLeaderboard = unFilteredLeaderboard.categories.coding as ModelBenchmarkRanking[];

const unFilteredModels = JSON.parse(modelsRaw);
const models = unFilteredModels.items as ModelDetailProfile[];

const unFilteredPricing = JSON.parse(pricingRaw);
const pricing = unFilteredPricing.items as ModelPricingSpec[];

const unFilteredSpeed = JSON.parse(speedRaw);
const speed = unFilteredSpeed.items as ModelSpeedSpec[];

// 1. Create fast O(1) lookup map for pricing
const pricingMap = new Map(pricing.map(
  (price) => [price.canonicalModelKey, price]
));

const modelsMap = new Map(models.map(
  (model) => [model.canonicalModelKey, model]
))

const speedMap = new Map(speed.map(
  (s) => [s.canonicalModelKey, s]
))

export async function getUsdToInrRate(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    return data.rates.INR;
  } catch {
    return 95.01; // Fallback rate
  }
}





export const modelSelection = async (budget: number, avgInputTokens: number, avgOutputTokens: number, avgReqPerday: number, useCaseFormula: (normalisedLatency: number,
  normalisedReasoningScore: number,
  normalisedCodingScore: number,
  normalisedMathScore: number,
  normalisedMultimodalGroundedScore: number) => number)
  : Promise<MergedModelCandidateNormalised[]> => {
  const usdToInr = await getUsdToInrRate();

  let MIN_CODING_SCORE = Infinity;
  let MIN_LATENCY_SCORE = Infinity;
  let MIN_REASONING_SCORE = Infinity;
  let MIN_MATH_SCORE = Infinity;
  let MIN_MULTIMODALGROUNDEDSCORE_SCORE = Infinity;

  let MAX_CODING_SCORE = -Infinity;
  let MAX_LATENCY_SCORE = -Infinity;
  let MAX_REASONING_SCORE = -Infinity;
  let MAX_MATH_SCORE = -Infinity;
  let MAX_MULTIMODALGROUNDEDSCORE_SCORE = -Infinity;

  const mergedModelData: MergedModelCandidate[] = codingLeaderboard.map(
    (model) => {
      const pricing = pricingMap.get(model.canonicalModelKey);
      if (!pricing || pricing.inputPrice == null || pricing.outputPrice == null) {
        return false;
      }

      const modelStats = modelsMap.get(model.canonicalModelKey);
      const speedStats = speedMap.get(model.canonicalModelKey);

      if (modelStats === undefined || speedStats === undefined) return false;

      const codingScore = modelStats.scores.displayCategoryScores.coding;
      if (codingScore === null || codingScore === undefined) return false;
      const reasoningScore = modelStats.scores.displayCategoryScores.reasoning || codingScore;
      const mathScore = modelStats.scores.displayCategoryScores.math || codingScore;
      const multimodalGroundedScore = modelStats.scores.displayCategoryScores.multimodalGrounded || 0;
      const ttft = speedStats.ttft;
      const tokensPerSecond = speedStats.tokensPerSecond;
      const latencyScore = ttft + avgOutputTokens / tokensPerSecond;
      MAX_CODING_SCORE = Math.max(MAX_CODING_SCORE, codingScore);
      MIN_CODING_SCORE = Math.min(MIN_CODING_SCORE, codingScore);

      MAX_REASONING_SCORE = Math.max(MAX_REASONING_SCORE, reasoningScore);
      MIN_REASONING_SCORE = Math.min(MIN_REASONING_SCORE, reasoningScore);

      MAX_LATENCY_SCORE = Math.max(MAX_LATENCY_SCORE, latencyScore);
      MIN_LATENCY_SCORE = Math.min(MIN_LATENCY_SCORE, latencyScore);

      MAX_MATH_SCORE = Math.max(MAX_MATH_SCORE, mathScore);
      MIN_MATH_SCORE = Math.min(MIN_MATH_SCORE, mathScore);

      MAX_MULTIMODALGROUNDEDSCORE_SCORE = Math.max(MAX_MULTIMODALGROUNDEDSCORE_SCORE, multimodalGroundedScore);
      MIN_MULTIMODALGROUNDEDSCORE_SCORE = Math.min(MIN_MULTIMODALGROUNDEDSCORE_SCORE, multimodalGroundedScore);





      const monthlyExpense = ((pricing.inputPrice * avgInputTokens + pricing.outputPrice * avgOutputTokens) * avgReqPerday * usdToInr * 30) / 1000000;
      if (budget < monthlyExpense) return false;


      const modelData = {
        rank: model.rank,
        name: model.model,
        canonicalModelKey: model.canonicalModelKey,
        creator: model.creator,
        sourceType: model.sourceType,
        contextWindowTokens: model.contextWindowTokens,
      }


      const modelStatsData = {
        overAllScore: modelStats.scores.overallScore,
        codingScore,
        reasoningScore,
        mathScore,
        multimodalGroundedScore

        
      }


      const pricingData = {
        inputPrice: pricing.inputPrice,
        outputPrice: pricing.outputPrice,
        isFreePricing: pricing.isFreePricing,
        monthlyCostINR: monthlyExpense
      }


      const speedData = {
        tokensPerSecond: speedStats.tokensPerSecond,
        ttft: speedStats?.ttft
      }


      return {
        ...modelData,

        ...modelStatsData,

        ...pricingData,

        ...speedData
      }
    }
  ).filter((item) => item !== false);
  const mergedModelDataNormailised: MergedModelCandidateNormalised[] = mergedModelData.map(
    (models) => {
      const modelsLatency = models.ttft + avgOutputTokens / models.tokensPerSecond;
      const modelsReasoning = models.reasoningScore;
      const modelscoding = models.codingScore;

      const normalisedLatency = (MAX_LATENCY_SCORE - modelsLatency) / (MAX_LATENCY_SCORE - MIN_LATENCY_SCORE);
      const normalisedReasoningScore = (modelsReasoning - MIN_REASONING_SCORE) / (MAX_REASONING_SCORE - MIN_REASONING_SCORE);
      const normalisedCodingScore = (modelscoding - MIN_CODING_SCORE) / (MAX_CODING_SCORE - MIN_CODING_SCORE);
      const normalisedMathScore = (models.mathScore - MIN_MATH_SCORE) / (MAX_MATH_SCORE - MIN_MATH_SCORE);
      const normalisedMultimodalGroundedScore = (models.multimodalGroundedScore - MIN_MULTIMODALGROUNDEDSCORE_SCORE) / (MAX_MULTIMODALGROUNDEDSCORE_SCORE - MIN_MULTIMODALGROUNDEDSCORE_SCORE);

      return {
        ...models,
        normalisedLatency,
        normalisedReasoningScore,
        normalisedCodingScore,
        normalisedMathScore,
        normalisedMultimodalGroundedScore,

        // for ex -
        // formula  you can customise 
        // UseCaseScore = 0.75 * normalisedCodingScore + 0.15 * normalisedReasoningScore + 0.10 * normalisedLatency ;
        UseCaseScore: useCaseFormula(normalisedLatency,
          normalisedReasoningScore,
          normalisedCodingScore,
          normalisedMathScore,
          normalisedMultimodalGroundedScore),
      }
    }
  )
  mergedModelDataNormailised.sort(
    (a, b) => b.UseCaseScore - a.UseCaseScore
  )
  return mergedModelDataNormailised;
}

