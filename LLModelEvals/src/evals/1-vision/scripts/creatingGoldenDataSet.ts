import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import type { RawQuestion } from "../../../core/types.js";
import { cleanLeetCodeHtml } from "../../../core/cleanLeetCodeHtml.js";
import type { GoldenVisionItem } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDatasetPath = path.resolve(__dirname, "../data/dataset.json");
const outputGoldenPath = path.resolve(__dirname, "../data/goldenDataset.json");

/**
 * Downloads an image from a URL and converts it into a base64 data URI
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${imageUrl}: HTTP ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = res.headers.get("content-type") || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function createGoldenDataset(): Promise<void> {
  console.log("🚀 Starting Vision Golden Dataset Creation...");
  console.log(`📖 Reading raw questions from: ${inputDatasetPath}`);

  const rawData = await fs.readFile(inputDatasetPath, "utf-8");
  const questions = JSON.parse(rawData) as RawQuestion[];

  const goldenData: GoldenVisionItem[] = [];

  for (const question of questions) {
    const cleaned = cleanLeetCodeHtml(question.content);
    const topics = Array.isArray(question.topicTags)
      ? question.topicTags.map((t) => t.name)
      : [];

    console.log(`\n📌 Processing Q#${question.questionId}: ${question.title}`);

    for (const example of cleaned.examples) {
      if (!example.image) {
        continue;
      }

      console.log(`   ⏳ Fetching & encoding image for Example ${example.exampleNumber}...`);
      const base64Image = await fetchImageAsBase64(example.image);

      const goldenItem: GoldenVisionItem = {
        id: crypto.randomUUID(),
        questionId: question.questionId,
        questionName: question.title,
        topics,
        exampleNumber: example.exampleNumber,
        input: example.input,
        output: example.output,
        ...(example.explanation ? { explanation: example.explanation } : {}),
        image: base64Image,
      };

      goldenData.push(goldenItem);
      console.log(`   ✅ Example ${example.exampleNumber} saved [ID: ${goldenItem.id.slice(0, 8)}..., Base64 len: ${base64Image.length}]`);
    }
  }

  // Ensure data directory exists
  await fs.mkdir(path.dirname(outputGoldenPath), { recursive: true });

  // Write golden dataset JSON
  await fs.writeFile(outputGoldenPath, JSON.stringify(goldenData, null, 2), "utf-8");

  console.log("\n==========================================");
  console.log(`🎉 Golden Dataset successfully created!`);
  console.log(`📁 File saved to: ${outputGoldenPath}`);
  console.log(`📊 Total Golden Vision Cases: ${goldenData.length}`);
  console.log("==========================================\n");
}

createGoldenDataset().catch((err) => {
  console.error("❌ Error creating golden dataset:", err);
  process.exit(1);
});
