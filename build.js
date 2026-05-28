#!/usr/bin/env node
// build.js — Fetches Notion survey data and bakes it into docs/index.html
const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Load .env file if present ───────────────────────────────────
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error(
    "Missing NOTION_API_KEY or NOTION_DATABASE_ID.\n" +
      "Set them in .env or as environment variables.",
  );
  process.exit(1);
}

// ── Notion API request helper ───────────────────────────────────
function makeNotionRequest(databaseId, apiKey, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.notion.com",
      port: 443,
      path: `/v1/databases/${databaseId}/query`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(
              new Error(
                parsed.message ||
                  `Notion API responded with status ${res.statusCode}`,
              ),
            );
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Notion response: ${e.message}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

// ── Main build routine ──────────────────────────────────────────
async function build() {
  console.log("[build] Fetching data from Notion...");

  // Paginate through all records
  let allResults = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const queryData = JSON.stringify({
      start_cursor: nextCursor,
      page_size: 100,
    });

    const response = await makeNotionRequest(
      NOTION_DATABASE_ID,
      NOTION_API_KEY,
      queryData,
    );

    if (response.results) {
      allResults = allResults.concat(response.results);
    }

    hasMore = response.has_more;
    nextCursor = response.next_cursor;

    console.log(
      `[build] Retrieved batch. Cumulative count: ${allResults.length}`,
    );
  }

  console.log(`[build] Total pages fetched: ${allResults.length}`);

  // Read source index.html
  const srcPath = path.join(__dirname, "index.html");
  let html = fs.readFileSync(srcPath, "utf-8");

  // Replace DEMO_PAGES array
  const demoStart = html.indexOf("const DEMO_PAGES = [");
  if (demoStart === -1) {
    console.error("[build] Could not find 'const DEMO_PAGES = [' in index.html");
    process.exit(1);
  }

  // Find the matching closing '];' — track bracket depth
  let depth = 0;
  let demoEnd = -1;
  for (let i = demoStart + "const DEMO_PAGES = ".length; i < html.length; i++) {
    if (html[i] === "[") depth++;
    if (html[i] === "]") {
      depth--;
      if (depth === 0) {
        demoEnd = i + 1; // include the ']'
        // Skip trailing semicolon
        if (html[demoEnd] === ";") demoEnd++;
        break;
      }
    }
  }

  if (demoEnd === -1) {
    console.error("[build] Could not find end of DEMO_PAGES array");
    process.exit(1);
  }

  const jsonStr = JSON.stringify(allResults, null, 2);
  html =
    html.slice(0, demoStart) +
    `const DEMO_PAGES = ${jsonStr};` +
    html.slice(demoEnd);

  // Replace DATA_FETCHED_AT timestamp
  const timestamp = new Date().toISOString();
  html = html.replace(
    /const DATA_FETCHED_AT = null;/,
    `const DATA_FETCHED_AT = "${timestamp}";`,
  );

  // Write to dist/index.html
  const distDir = path.join(__dirname, "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  const outPath = path.join(distDir, "index.html");
  fs.writeFileSync(outPath, html, "utf-8");

  console.log(`[build] Data fetched at: ${timestamp}`);
  console.log(`[build] Written to: ${outPath}`);
  console.log("[build] Done.");
}

build().catch((err) => {
  console.error("[build] Fatal error:", err.message);
  process.exit(1);
});
