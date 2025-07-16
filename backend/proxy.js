import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

let redditAccessToken = null;
let tokenExpiry = 0;

async function getRedditAccessToken() {
  if (redditAccessToken && Date.now() < tokenExpiry) {
    return redditAccessToken;
  }
  const basicAuth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(
      `Failed to get Reddit token: ${response.status} ${response.statusText}`
    );
  }
  const data = await response.json();
  redditAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return redditAccessToken;
}

function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": process.env.REDDIT_USER_AGENT,
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

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

// Default subreddit route (uses OAuth)
app.get("/api/reddit", async (req, res) => {
  try {
    const token = await getRedditAccessToken();
    const defaultSubreddit = process.env.DEFAULT_SUBREDDITS.split(",")[0];
    const url = `https://oauth.reddit.com/r/${defaultSubreddit}/hot.json?limit=${
      process.env.ITEMS_PER_PAGE || 30
    }`;
    console.log(`🔎 Fetching default subreddit with OAuth: ${url}`);
    const response = await fetch(url, {
      headers: buildHeaders(token),
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

// Specific subreddit route (uses OAuth)
app.get("/api/reddit/:subreddit", async (req, res) => {
  try {
    const token = await getRedditAccessToken();
    const subreddit = req.params.subreddit.trim();
    const after = req.query.after || "";
    const limit = 50;
    const url = `https://oauth.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1${
      after ? `&after=${after}` : ""
    }`;
    console.log(`🔎 Fetching subreddit with OAuth: ${url}`);
    const response = await fetch(url, {
      headers: buildHeaders(token),
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

// Random reels endpoint
app.get("/api/reels/random", async (req, res) => {
  try {
    const defaultSubs = process.env.DEFAULT_SUBREDDITS
      ? process.env.DEFAULT_SUBREDDITS.split(",").map((s) => s.trim())
      : [];
    if (!defaultSubs.length) {
      return res.status(400).json({ error: "No default subreddits configured" });
    }
    // Randomly pick 2-3 subreddits
    const numSubs = Math.min(3, defaultSubs.length);
    const pickedSubs = [];
    const used = new Set();
    while (pickedSubs.length < numSubs) {
      const idx = Math.floor(Math.random() * defaultSubs.length);
      if (!used.has(idx)) {
        pickedSubs.push(defaultSubs[idx]);
        used.add(idx);
      }
    }
    const token = await getRedditAccessToken();
    const limitPerSub = 2;
    // Fetch in parallel
    const fetches = pickedSubs.map(async (sub) => {
      const url = `https://oauth.reddit.com/r/${sub}/hot.json?limit=${limitPerSub}&raw_json=1`;
      const response = await fetch(url, { headers: buildHeaders(token) });
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.data?.children || [])
        .map(post => post?.data)
        .filter(p => (p?.is_video && p?.media?.reddit_video?.fallback_url) || (p?.preview?.reddit_video_preview?.fallback_url))
        .map(p => ({
          id: p.id,
          title: p.title,
          url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url,
          thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
          subreddit: sub
        }));
    });
    let allVideos = (await Promise.all(fetches)).flat();
    // Shuffle and limit
    for (let i = allVideos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allVideos[i], allVideos[j]] = [allVideos[j], allVideos[i]];
    }
    const result = allVideos.slice(0, 5);
    res.json({ reels: result });
  } catch (err) {
    console.error("❌ Error fetching random reels:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Proxy image endpoint for direct Reddit image download
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || !/^https?:\/\/(i|preview)\.redd\.it\//.test(imageUrl)) {
    return res.status(400).json({ error: 'Invalid or missing image URL' });
  }
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': process.env.REDDIT_USER_AGENT || 'RedditGalleryProxy/1.0',
        'Accept': 'image/*',
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch image from Reddit' });
    }
    // Set headers for download
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    const filename = imageUrl.split('/').pop().split('?')[0];
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error: ' + err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
