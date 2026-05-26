// proxy.js — runs locally on port 3001
// Forwards requests to the Notion API with correct headers to bypass CORS limitations
const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// Main endpoint to query Notion survey data
app.get('/notion-data', async (req, res) => {
  // Extract credentials from request headers, fallback to environment variables
  const apiKey = req.headers['x-notion-api-key'] || process.env.NOTION_API_KEY;
  const databaseId = req.headers['x-notion-database-id'] || process.env.NOTION_DATABASE_ID;

  if (!apiKey) {
    return res.status(400).json({
      error: 'Missing Notion API Key. Provide it in the request headers (x-notion-api-key) or as an environment variable (NOTION_API_KEY).'
    });
  }

  if (!databaseId) {
    return res.status(400).json({
      error: 'Missing Notion Database ID. Provide it in the request headers (x-notion-database-id) or as an environment variable (NOTION_DATABASE_ID).'
    });
  }

  console.log(`[Proxy] Fetching data for Database ID: ${databaseId.substring(0, 6)}...`);

  try {
    let allResults = [];
    let hasMore = true;
    let nextCursor = undefined;

    // Notion API pagination loop to fetch ALL records
    while (hasMore) {
      const queryData = JSON.stringify({
        start_cursor: nextCursor,
        page_size: 100
      });

      const response = await makeNotionRequest(databaseId, apiKey, queryData);
      
      if (response.results) {
        allResults = allResults.concat(response.results);
      }
      
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
      
      console.log(`[Proxy] Retrieved batch. Cumulative count: ${allResults.length}`);
    }

    console.log(`[Proxy] Successfully fetched ${allResults.length} total pages.`);
    res.json({ results: allResults });

  } catch (error) {
    console.error('[Proxy] Error calling Notion API:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve data from Notion API',
      details: error.message
    });
  }
});

// Helper function to perform HTTPS request to Notion API
function makeNotionRequest(databaseId, apiKey, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: `/v1/databases/${databaseId}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || `Notion API responded with status ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Notion response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

// Start the proxy server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`CVC Survey Data Explorer Proxy listening on port ${PORT}`);
  console.log(`Endpoint available at http://localhost:${PORT}/notion-data`);
  console.log(`====================================================`);
});
