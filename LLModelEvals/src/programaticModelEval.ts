import * as fs from "node:fs/promises";

import type {
  ModelBenchmarkRanking,
  ModelPricingSpec,
  ModelDetailProfile,
  ModelSpeedSpec,
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


