import * as fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://benchlm.ai/data";

const DATASETS = [
  "leaderboard",
  "models",
  "pricing",
  "speed",
] as const;

async function downloadDatasets(): Promise<void> {
  const outputDir = path.resolve("LLMdata");

  await fs.mkdir(outputDir, { recursive: true });

  for (const dataset of DATASETS) {
    const url = `${BASE_URL}/${dataset}.json`;

    console.log(`Downloading ${dataset}.json...`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to download ${dataset}.json: HTTP ${response.status}`
      );
    }

    const data: unknown = await response.json();

    await fs.writeFile(
      path.join(outputDir, `${dataset}.json`),
      JSON.stringify(data, null, 2),
      "utf8"
    );

    console.log(`Saved ${dataset}.json`);
  }

  console.log("All datasets downloaded.");
}

downloadDatasets().catch((error: unknown) => {
  console.error("Download failed:", error);
  process.exitCode = 1;
});