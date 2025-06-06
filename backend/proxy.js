import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup (allow multiple origins)
const allowedOrigins = process.env.FRONTEND_URL.split(',').map(url => url.trim());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.send("🟢 Reddit Proxy is up");
});

// Subreddits list
app.get("/api/subreddits", (req, res) => {
  const subreddits = process.env.DEFAULT_SUBREDDITS.split(",");
  res.json({ subreddits });
});

// Default subreddit route
app.get("/api/reddit", async (req, res) => {
  try {
    const defaultSubreddit = process.env.DEFAULT_SUBREDDITS.split(",")[0];
    const url = `${process.env.REDDIT_BASE_URL}${defaultSubreddit}/hot.json?limit=${process.env.ITEMS_PER_PAGE || 30}`;
    console.log(`🔎 Fetching default subreddit: ${url}`);

    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching default subreddit:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Specific subreddit route
app.get("/api/reddit/:subreddit", async (req, res) => {
  try {
    const subreddit = req.params.subreddit;
    const after = req.query.after || "";
    const limit = 50;
    const url = `${process.env.REDDIT_BASE_URL}${subreddit}/hot.json?limit=${limit}&raw_json=1${after ? `&after=${after}` : ""}`;
    console.log(`🔎 Fetching subreddit: ${url}`);

    const response = await fetch(url, {
      headers: { "User-Agent": process.env.USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(`Error fetching subreddit: ${req.params.subreddit}`);
    console.error(err);
    res.status(500).json({ error: err.message || err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
