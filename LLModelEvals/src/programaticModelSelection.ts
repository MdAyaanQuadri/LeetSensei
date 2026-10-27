import * as fs from "node:fs/promises";


import type {
  ModelBenchmarkRanking,
  ModelPricingSpec,
  ModelDetailProfile,
  ModelSpeedSpec,
  MergedModelCandidate,
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




export const modelSelectionPrice= async (budget: number, avgInputTokens: number, avgOutputTokens: number, avgReqPerday: number)
  : Promise<MergedModelCandidate[]> => {
  const usdToInr = await getUsdToInrRate();
  const mergedModelData = codingLeaderboard.map(
    (model) => {
      const pricing = pricingMap.get(model.canonicalModelKey);
      if (!pricing || pricing.inputPrice == null || pricing.outputPrice == null) {
        return false;
      }
      const monthlyExpense = ((pricing.inputPrice * avgInputTokens + pricing.outputPrice * avgOutputTokens) * avgReqPerday * usdToInr * 30) / 1000000;
      if (budget < monthlyExpense) return false;


      const modelStats = modelsMap.get(model.canonicalModelKey);
      const speedStats = speedMap.get(model.canonicalModelKey) ;

      const modelData = {
        rank: model.rank,
        canonicalModelKey: model.canonicalModelKey,
        creator: model.creator,
        sourceType: model.sourceType,
        contextWindowTokens: model.contextWindowTokens,
      }


      const modelStatsData = {
        overAllScore: modelStats?.scores.overallScore,
        codingScore: modelStats?.scores.displayCategoryScores.coding,
        reasoningScore: modelStats?.scores.displayCategoryScores.reasoning,
        mathScore: modelStats?.scores.displayCategoryScores.math,
      }


      const pricingData = {
        inputPrice: pricing.inputPrice,
        outputPrice: pricing.outputPrice,
        isFreePricing: pricing.isFreePricing,
        monthlyCostINR: monthlyExpense
      }

      
      const speedData = {
        tokensPerSecond : speedStats?.tokensPerSecond ,
        ttft : speedStats?.ttft
      }

      
      return {
        ...modelData,

        ...modelStatsData,

        ...pricingData,

        ...speedData
      }
    }
  )  .filter((item)=> item !== false);

  return mergedModelData
}

