import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 3000;
const DEFAULT_DATA_PATH = path.join(__dirname, "..", "data", "mcchicken_prices.csv");
const DATA_PATH = process.env.MCCHICKEN_CSV_PATH;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        scriptSrcElem: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    }
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

if (ALLOWED_ORIGINS.length > 0) {
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      methods: ["GET"],
      allowedHeaders: ["Content-Type"]
    })
  );
}

const normalizeBoolean = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }

  return null;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const loadPriceData = async () => {
  const candidatePaths = [
    DATA_PATH,
    DEFAULT_DATA_PATH,
    path.join(process.cwd(), "data", "mcchicken_prices.csv")
  ].filter(Boolean);

  let raw;
  let usedPath;

  for (const candidate of candidatePaths) {
    try {
      raw = await fs.readFile(candidate, "utf-8");
      usedPath = candidate;
      break;
    } catch (error) {
      console.warn(`Unable to read CSV at ${candidate}`, error);
    }
  }

  if (!raw) {
    throw new Error(`Unable to read CSV from any known path: ${candidatePaths.join(", ")}`);
  }

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const normalized = records.map((record) => ({
    year: normalizeNumber(record.year ?? record.Year),
    available: normalizeBoolean(record.available ?? record.Available ?? record.Availability),
    minPrice: normalizeNumber(
      record.min_price ?? record.Min_Price ?? record["Minimum Price"] ?? record.Price_Low_USD
    ),
    maxPrice: normalizeNumber(
      record.max_price ?? record.Max_Price ?? record["Maximum Price"] ?? record.Price_High_USD
    ),
    notes: record.notes ?? record.Notes ?? null,
    sourceHistory: record.source_history ?? record.Source_History ?? null,
    sourceCpiContext: record.source_cpi_context ?? record.Source_CPI_Context ?? null,
    sourceValueMenuAnchors: record.source_value_menu_anchors ?? record.Source_ValueMenu_Anchors ?? null,
    sourceRecentPricingAnchors: record.source_recent_pricing_anchors ?? record.Source_RecentPricing_Anchors ?? null
  }));

  if (usedPath && usedPath !== DEFAULT_DATA_PATH) {
    console.info(`Loaded CSV data from ${usedPath}`);
  }

  return normalized;
};

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  "/vendor",
  express.static(path.join(__dirname, "..", "node_modules", "chart.js", "dist"))
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/prices", async (_req, res) => {
  try {
    const data = await loadPriceData();

    res.json({
      data,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Unable to load CSV data", error);
    res.status(500).json({
      error: "Unable to load CSV data"
    });
  }
});

app.get("/about", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "about.html"));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`McChickenflation API listening on http://localhost:${PORT}`);
  });
}

export { app };
export default app;
