import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

const OPENROUTER_API_KEY = process.env.openRouter || process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("❌ Error: OpenRouter API key not found in .env");
  process.exit(1);
}

const IMAGE_URL = "https://assets.leetcode.com/uploads/2020/12/20/ex1.jpg";

// High-performing free multimodal model on OpenRouter
const FREE_VISION_MODEL = "dots-studio/dots-3-note-preview:free";

async function describeLeetCodeImage(imageUrl: string) {
  console.log(`🖼️  Fetching image from: ${imageUrl}`);

  // Fetch image and encode to Base64 data URL
  const imgResponse = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  if (!imgResponse.ok) {
    throw new Error(`Failed to download image: ${imgResponse.statusText}`);
  }

  const arrayBuffer = await imgResponse.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  console.log(`🤖 Querying free model [${FREE_VISION_MODEL}] via OpenRouter...`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://leetsensei.dev",
      "X-Title": "LeetSensei Evaluation"
    },
    body: JSON.stringify({
      model: FREE_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an expert algorithm coach. Describe this LeetCode problem image in detail: identify the data structure, all nodes and their connections, and what LeetCode problem or algorithmic scenario this diagram represents."
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content;

  console.log("\n=================== MODEL DESCRIPTION ===================");
  console.log(result);
  console.log("=========================================================\n");

  return result;
}

describeLeetCodeImage(IMAGE_URL).catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
