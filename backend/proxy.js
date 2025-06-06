import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Parse allowed origins from env and trim
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.send("🟢 Reddit Proxy is up");
});

// Subreddits list endpoint
app.get("/api/subreddits", (req, res) => {
  const defaultSubs = process.env.DEFAULT_SUBREDDITS
    ? process.env.DEFAULT_SUBREDDITS.split(",").map((s) => s.trim())
    : [];
  res.json({ subreddits: defaultSubs });
});

// Helper function to build fetch headers with required info
function buildHeaders() {
  return {
    "User-Agent": process.env.USER_AGENT || "web:reddit.reels:v1.0.0 (by /u/yourusername)",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

// Default subreddit route
app.get("/api/reddit", async (req, res) => {
  try {
    const defaultSubreddit = process.env.DEFAULT_SUBREDDITS
      ? process.env.DEFAULT_SUBREDDITS.split(",")[0].trim()
      : "pics"; // fallback safe subreddit
    const limit = process.env.ITEMS_PER_PAGE || 30;
    const url = `${process.env.REDDIT_BASE_URL || "https://www.reddit.com/r/"}${defaultSubreddit}/hot.json?limit=${limit}`;
    console.log(`🔎 Fetching default subreddit: ${url}`);

    const response = await fetch(url, {
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status} ${response.statusText}`);
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
    const subreddit = req.params.subreddit.trim();
    const after = req.query.after || "";
    const limit = 50;
    const url = `${process.env.REDDIT_BASE_URL || "https://www.reddit.com/r/"}${subreddit}/hot.json?limit=${limit}&raw_json=1${after ? `&after=${after}` : ""}`;
    console.log(`🔎 Fetching subreddit: ${url}`);

    const response = await fetch(url, {
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(`❌ Error fetching subreddit: ${req.params.subreddit}`);
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
