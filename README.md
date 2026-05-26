# CVC Survey Data Explorer

A self-contained data visualization application for exploring survey results from the Champlain Valley Cohousing (CVC) Community Life Circle survey. Built specifically to be loaded as a **Claude artifact**, this application runs entirely in a single file (`index.html`) using CDN-loaded React, D3.js, and Tailwind CSS. It requires no npm build step and can be opened directly in any modern web browser.

---

## Features

* **Anonymization Engine:** Deterministically maps respondents to two-syllable invented names (e.g. `Rowan-01`, `Calen-04`) based on record order. It prevents individual identification while keeping cross-tab references stable.
* **Preloaded Demo Data:** Fully populated, realistic dataset preloaded directly in the React code so you can run, test, and explore all dashboard features immediately without a live Notion integration.
* **Notion Integration Proxy:** A simple local CORS proxy server (`proxy.js`) to bridge your browser securely to the Notion API.
* **Interactive Visualization Tabs:**
  1. **Tag Frequency:** A physics-based force-directed bubble chart of analytical codes, with a slide-out drawer showing anonymized comment excerpts and small-group privacy warnings.
  2. **Tenure Arc:** An animated horizontal dot plot mapping mean scores across tenure categories (`0-2 yrs`, `3-5 yrs`, etc.) for 7 critical cohousing Likert metrics.
  3. **Fulfillment vs Governance Satisfaction:** A 2D matrix comparing overall cohousing life fulfillment with governance satisfaction, programmatically highlighting off-diagonal discrepancies with secondary visual panels showing tag profile bar charts.

---

## Local Setup & Quick Start

### 1. Run the CORS Proxy Server
Because browsers block direct frontend requests to Notion due to CORS limitations, a minimal Express proxy is provided. 

In your terminal, navigate to this project folder and run:
```bash
# Install dependencies (express, cors)
npm install

# Start the proxy server
npm start
```
The proxy server will run on `http://localhost:3001/notion-data`.

### 2. Launch the Frontend Dashboard
Simply open the `index.html` file directly in any modern web browser:
* Double-click `index.html` in your file explorer.
* Or run a local HTTP server: `npx serve .` and navigate to `http://localhost:3000`.

---

## Connecting to Your Live Notion Database

1. Click the **Gear Icon** ⚙️ at the top right of the dashboard header to open the **Settings Panel**.
2. Toggle **Use Preloaded Demo Data** to **OFF**.
3. Enter your details:
   * **Notion API Integration Token:** Paste your Notion integration secret (`secret_xxxxxxxx...`).
   * **Notion Database ID:** Paste the ID of your survey database.
   * **Local Proxy URL:** Keep as `http://localhost:3001/notion-data` (running locally).
4. Click **Load Data**. Your credentials will be saved securely to browser `localStorage` and the dashboard will update in real-time.

---

## Developer Guide

### How the Data Flow Works
All survey data passes through a clean, isolated process block in `index.html`:

```javascript
fetchData(config) -> transformData(rawPages) -> React & D3 Visualizations
```

1. **`fetchData(config)`** handles raw HTTP queries (whether pulling local Demo arrays or hitting the Express proxy).
2. **`transformData(rawPages)`** normalizes the Notion DB payload defensively, runs the deterministic anonymizer, calculates means, and generates text segments.

---

### How to Add a New Derived Field
All data calculations, data type coercions, and derivations belong in the **`transformData`** function. 

To add a new derived property, find the `transformData` mapping logic:
```javascript
// Inside transformData() map loop in index.html:
const q13 = Number(getPropValue(page, 'Q13', 'number', 3));
// ...

// 1. Add your custom derivation calculation:
const overallHappiness = Number(((q13 + q14 + q24) / 3).toFixed(2));

// 2. Append the field to the returned object:
return {
  id: page.id,
  anonName,
  tenure,
  // ...
  overallHappiness, // Now accessible by any chart component!
};
```

---

### How to Add a New Visualization Tab

1. **Create a React Component** for your tab (e.g. `MyNewChartTab`):
   ```javascript
   function MyNewChartTab({ data }) {
     const summaryText = "My new cohousing chart description...";
     return (
       <div className="flex-grow bg-white rounded-2xl p-6 shadow-sm">
         <h2 className="text-xl font-bold">New Visual Insights</h2>
         <p className="bg-slate-50 p-4 border-l-4 border-emerald-500 rounded-r-xl text-slate-600 text-sm my-3">
           {summaryText}
         </p>
         {/* Render D3 component here */}
       </div>
     );
   }
   ```
2. **Add the Tab Button** in the main `App` component's navigation section:
   ```javascript
   // Inside App navigation links in index.html:
   <button
     onClick={() => setActiveTab('new-insight')}
     className={`py-4 border-b-2 text-sm font-semibold tracking-wide transition-colors focus:outline-none ${
       activeTab === 'new-insight'
         ? 'border-emerald-500 text-emerald-600'
         : 'border-transparent text-slate-500 hover:text-slate-800'
     }`}
   >
     New Insight
   </button>
   ```
3. **Register Tab Content** in `App` rendering container:
   ```javascript
   // Inside App render component in index.html:
   {activeTab === 'tag-frequency' && <BubbleChartTab data={surveyData} />}
   {activeTab === 'tenure-arc' && <TenureArcTab data={surveyData} />}
   {activeTab === 'satisfaction-grid' && <FulfillmentGridTab data={surveyData} />}
   {activeTab === 'new-insight' && <MyNewChartTab data={surveyData} />}
   ```
