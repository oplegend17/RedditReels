import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import { DEFAULT_SUBREDDITS, SUBREDDIT_CATEGORIES } from "./subreddits.js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from both backend directory and root directory
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
app.use(express.json());

// Express Request Logger Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`📡 [${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});
const PORT = process.env.PORT || 3001;

// Flatten all known subreddits for prompt context + validation
const ALL_KNOWN_SUBS = [...new Set(Object.values(SUBREDDIT_CATEGORIES).flat())];

// Simple in-memory cache: vibe string -> subreddits array
const vibeCache = new Map();

let redditAccessToken = null;
let tokenExpiry = 0;

let redgifsAccessToken = null;
let redgifsTokenExpiry = 0;

const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getRedgifsAccessToken() {
  if (redgifsAccessToken && Date.now() < redgifsTokenExpiry) {
    return redgifsAccessToken;
  }
  try {
    const response = await fetch("https://api.redgifs.com/v2/auth/temporary", {
      headers: {
        'User-Agent': browserUA,
        'Accept': 'application/json',
      }
    });
    if (!response.ok) throw new Error(`Auth failed with status: ${response.status}`);
    const data = await response.json();
    if (!data.token) throw new Error('No token in RedGifs response');
    redgifsAccessToken = data.token;
    redgifsTokenExpiry = Date.now() + 30 * 60 * 1000;
    return redgifsAccessToken;
  } catch (err) {
    console.error("❌ RedGifs Auth Failure:", err.message);
    return null;
  }
}

async function getRedditAccessToken() {
  if (redditAccessToken && Date.now() < tokenExpiry) {
    return redditAccessToken;
  }
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": process.env.REDDIT_USER_AGENT || browserUA,
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    redditAccessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return redditAccessToken;
  } catch (e) {
    console.warn("⚠️ Reddit OAuth token request error:", e.message);
    return null;
  }
}

function buildHeaders(token) {
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT || browserUA,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    };
  }
  return {
    "User-Agent": browserUA,
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
  res.json({ subreddits: DEFAULT_SUBREDDITS });
});

// Subreddit categories endpoint
app.get("/api/subreddits/categories", (req, res) => {
  res.json({ categories: SUBREDDIT_CATEGORIES });
});

// Round-Robin Groq API Keys Manager (dynamically split from comma-separated process.env.GROQ_API_KEYS)
const rawGroqEnv = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "";
const GROQ_API_KEYS = rawGroqEnv
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

let groqKeyIndex = 0;

function getNextGroqKey() {
  if (GROQ_API_KEYS.length === 0) return null;
  const key = GROQ_API_KEYS[groqKeyIndex];
  groqKeyIndex = (groqKeyIndex + 1) % GROQ_API_KEYS.length;
  return key;
}

async function callGroqCompletion(messages, model = "openai/gpt-oss-120b") {
  let attempts = 0;
  while (attempts < GROQ_API_KEYS.length) {
    const key = getNextGroqKey();
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 150,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        console.log(`⚡ [Groq API Key #${groqKeyIndex}] Success with model ${model}`);
        return content;
      }
      console.warn(`⚠️ Groq API key (${key.slice(0, 15)}...) status ${response.status}`);
    } catch (err) {
      console.warn(`⚠️ Groq API key (${key.slice(0, 15)}...) failed:`, err.message);
    }
    attempts++;
  }
  throw new Error("All Groq API keys failed");
}

// AI smart search endpoint — decides intent then acts using Groq API round-robin
app.post("/api/ai/mood", async (req, res) => {
  const vibe = (req.body?.vibe || "").trim().slice(0, 200);
  if (!vibe) return res.status(400).json({ error: "Missing vibe" });

  const cacheKey = vibe.toLowerCase();
  if (vibeCache.has(cacheKey)) {
    return res.json({ ...vibeCache.get(cacheKey), cached: true });
  }

  const subList = ALL_KNOWN_SUBS.join(", ");

  try {
    const raw = await callGroqCompletion([
      {
        role: "system",
        content: `You are a smart search router for an adult content platform.

Given a user query, decide if it is:
- "search": a specific keyword, name, pornstar, term, or short phrase the user wants to search for directly
- "mood": a vibe, feeling, or descriptive natural language mood where you should pick matching subreddits

If "search": return { "intent": "search", "query": "<the search term to use>" }
If "mood": return { "intent": "mood", "subreddits": [5-8 names from this list: ${subList}] }

Return ONLY valid JSON. No explanation, no markdown.`,
      },
      {
        role: "user",
        content: vibe,
      },
    ]);

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");

    const parsed = JSON.parse(match[0]);
    console.log(`✨ AI Groq intent [${vibe}] →`, parsed);

    if (parsed.intent === "search" && parsed.query) {
      const result = { intent: "search", query: parsed.query };
      vibeCache.set(cacheKey, result);
      return res.json(result);
    }

    if (parsed.intent === "mood" && Array.isArray(parsed.subreddits)) {
      const knownLower = new Set(ALL_KNOWN_SUBS.map((s) => s.toLowerCase()));
      const validated = parsed.subreddits
        .filter((s) => typeof s === "string" && knownLower.has(s.toLowerCase()))
        .slice(0, 8);

      if (validated.length > 0) {
        const result = { intent: "mood", subreddits: validated };
        vibeCache.set(cacheKey, result);
        return res.json(result);
      }
    }

    return res.json({ intent: "search", query: vibe });
  } catch (err) {
    console.warn("⚠️ Groq AI smart search fallback to direct query:", err.message);
    return res.json({ intent: "search", query: vibe });
  }
});

// Default subreddit route (uses OAuth with public fallback)
app.get("/api/reddit", async (req, res) => {
  try {
    const token = await getRedditAccessToken();
    const defaultSubreddit = DEFAULT_SUBREDDITS[0];
    let url = token
      ? `https://oauth.reddit.com/r/${defaultSubreddit}/hot.json?limit=${process.env.ITEMS_PER_PAGE || 30}&raw_json=1`
      : `https://www.reddit.com/r/${defaultSubreddit}/hot.json?limit=${process.env.ITEMS_PER_PAGE || 30}&raw_json=1`;

    console.log(`🔎 Fetching default subreddit (${token ? "OAuth" : "Public"}): ${url}`);
    let response = await fetch(url, { headers: buildHeaders(token) });

    if (!response.ok && token) {
      url = `https://www.reddit.com/r/${defaultSubreddit}/hot.json?limit=${process.env.ITEMS_PER_PAGE || 30}&raw_json=1`;
      response = await fetch(url, { headers: buildHeaders(null) });
    }

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

// Specific subreddit route (uses OAuth with public fallback)
app.get("/api/reddit/:subreddit", async (req, res) => {
  try {
    const token = await getRedditAccessToken();
    const subreddit = req.params.subreddit.trim();
    const sort = req.query.sort || "hot";
    const t = req.query.t || "all";
    const after = req.query.after || "";
    const limit = 50;

    let url = token
      ? `https://oauth.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`
      : `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`;

    if (sort === "top" && t) url += `&t=${t}`;
    if (after) url += `&after=${after}`;

    console.log(`🔎 Fetching subreddit (${token ? "OAuth" : "Public"}): ${url}`);
    let response = await fetch(url, { headers: buildHeaders(token) });

    // Fallback to public endpoint if OAuth failed
    if (!response.ok && token) {
      console.warn(`⚠️ OAuth request for r/${subreddit} returned ${response.status}. Retrying via public endpoint...`);
      url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1` +
        (sort === "top" && t ? `&t=${t}` : "") +
        (after ? `&after=${after}` : "");
      response = await fetch(url, { headers: buildHeaders(null) });
    }

    if (!response.ok) {
      const status = response.status;
      const message =
        status === 404 ? "Subreddit not found" :
        status === 403 ? "Subreddit is private or banned" :
        status === 451 ? "Subreddit is quarantined" :
        `Reddit error ${status}`;
      console.warn(`⚠️ r/${subreddit}: ${message}`);
      return res.status(status).json({ error: message, status });
    }

    const data = await response.json();
    if (data?.error) {
      console.warn(`⚠️ r/${subreddit}: Reddit returned error ${data.error}`);
      return res.status(data.error).json({ error: "Subreddit unavailable", status: data.error });
    }

    res.json(data);
  } catch (err) {
    console.error(`❌ Error fetching subreddit: ${req.params.subreddit}`, err);
    res.status(500).json({ error: err.toString() });
  }
});


// Single post route (uses OAuth with public fallback)
app.get("/api/post/:subreddit/:id", async (req, res) => {
  try {
    const { subreddit, id } = req.params;
    const token = await getRedditAccessToken();

    let url = token
      ? `https://oauth.reddit.com/r/${subreddit}/comments/${id}.json?raw_json=1`
      : `https://www.reddit.com/r/${subreddit}/comments/${id}.json?raw_json=1`;

    console.log(`🔎 Fetching single post (${token ? "OAuth" : "Public"}): ${url}`);
    let response = await fetch(url, { headers: buildHeaders(token) });

    if (!response.ok && token) {
      url = `https://www.reddit.com/r/${subreddit}/comments/${id}.json?raw_json=1`;
      response = await fetch(url, { headers: buildHeaders(null) });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: "Post not found" });
    }

    const data = await response.json();
    const post = data?.[0]?.data?.children?.[0]?.data;

    if (!post) {
      return res.status(404).json({ error: "Post data missing" });
    }

    res.json({ post });
  } catch (err) {
    console.error(`❌ Error fetching post ${req.params.id}:`, err);
    res.status(500).json({ error: err.toString() });
  }
});

// Random reels endpoint

app.get("/api/reels/random", async (req, res) => {
  try {
    const defaultSubs = DEFAULT_SUBREDDITS;
    
    // Check for specific subreddits requested via query param
    let targetSubs = [];
    if (req.query.subreddits) {
      targetSubs = req.query.subreddits.split(',').map(s => s.trim());
    }

    if (!targetSubs.length && !defaultSubs.length) {
      return res.status(400).json({ error: "No default subreddits configured" });
    }

    // If no specific subs requested, pick random ones from defaults
    if (targetSubs.length === 0) {
      const numSubs = Math.min(6, defaultSubs.length);
      const used = new Set();
      while (targetSubs.length < numSubs) {
        const idx = Math.floor(Math.random() * defaultSubs.length);
        if (!used.has(idx)) {
          targetSubs.push(defaultSubs[idx]);
          used.add(idx);
        }
      }
    }
    
    if (targetSubs.length > 8) {
      const picked = [];
      const used = new Set();
      while (picked.length < 8) {
        const idx = Math.floor(Math.random() * targetSubs.length);
        if (!used.has(idx)) {
          picked.push(targetSubs[idx]);
          used.add(idx);
        }
      }
      targetSubs = picked;
    }

    const token = await getRedditAccessToken();
    const limitPerSub = 25; // fetch more to ensure enough videos after filtering
    // Fetch in parallel
    const fetches = targetSubs.map(async (sub) => {
      try {
        // Try 'hot' first, fall back to 'new' for more variety
        const url = `https://oauth.reddit.com/r/${sub}/hot.json?limit=${limitPerSub}&raw_json=1`;
        const response = await fetch(url, { headers: buildHeaders(token) });
        if (!response.ok) return [];
        const data = await response.json();
        return (data?.data?.children || [])
            .map(post => post?.data)
            .filter(p => {
              if (!p) return false;
              const u = p.url_overridden_by_dest || p.url || '';
              return (
                (p.is_video && p.media?.reddit_video?.fallback_url) ||
                p.preview?.reddit_video_preview?.fallback_url ||
                u.includes('redgifs.com') ||
                u.includes('v.redd.it')
              );
            })
            .map(p => ({
              id: p.id,
              title: p.title,
              url: p?.media?.reddit_video?.fallback_url || p?.preview?.reddit_video_preview?.fallback_url || '',
              thumbnail: p?.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || '',
              subreddit: sub,
              ups: p.ups || 0,
              originalUrl: p.url_overridden_by_dest || p.url,
              isRedgifs: (p.url_overridden_by_dest || p.url || '').includes('redgifs.com')
            }))
            .filter(p => p.url || p.isRedgifs);
      } catch (e) {
          console.error(`Failed to fetch from r/${sub}`, e);
          return [];
      }
    });
    
    let allVideos = (await Promise.all(fetches)).flat();
    
    // Shuffle
    for (let i = allVideos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allVideos[i], allVideos[j]] = [allVideos[j], allVideos[i]];
    }
    
    const result = allVideos.slice(0, 40);
    res.json({ reels: result });
  } catch (err) {
    console.error("❌ Error fetching random reels:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Global search route (uses OAuth)
app.get("/api/search", async (req, res) => {
  try {
    const token = await getRedditAccessToken();
    const query = req.query.q || "";
    const after = req.query.after || "";
    const limit = 50;
    
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    // Search globally across Reddit — keep query clean, filter media type on the frontend
    const url = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(query)}&include_over_18=on&type=link&limit=${limit}&sort=relevance&t=all&raw_json=1${
      after ? `&after=${after}` : ""
    }`;
    
    console.log(`🔎 Searching Reddit with OAuth: ${url}`);
    const response = await fetch(url, {
      headers: buildHeaders(token),
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(`❌ Error searching Reddit: ${req.query.q}`);
    console.error(err);
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

// Generic video streaming proxy (strips browser referrer & forwards range headers)
app.get('/api/proxy-video', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Missing video URL' });

  try {
    const headers = {
      'User-Agent': browserUA,
      'Accept': '*/*',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const videoRes = await fetch(videoUrl, { headers });
    
    res.status(videoRes.status);
    if (videoRes.headers.get('content-type')) {
      res.setHeader('Content-Type', videoRes.headers.get('content-type'));
    }
    if (videoRes.headers.get('content-length')) {
      res.setHeader('Content-Length', videoRes.headers.get('content-length'));
    }
    if (videoRes.headers.get('content-range')) {
      res.setHeader('Content-Range', videoRes.headers.get('content-range'));
    }
    if (videoRes.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', videoRes.headers.get('accept-ranges'));
    }

    videoRes.body.pipe(res);
  } catch (err) {
    console.error('Video proxy error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Endpoint to merge video and audio tracks for Reddit video downloads
app.get('/api/merge-video', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing video URL' });
  }

  const userAgent = process.env.REDDIT_USER_AGENT || browserUA;

  try {
    const baseUrlMatch = videoUrl.match(/^(https?:\/\/v\.redd\.it\/[^\/]+\/)/);
    if (!baseUrlMatch) {
      console.log(`[Proxy] Direct proxying non-reddit video: ${videoUrl}`);
      const videoRes = await fetch(videoUrl, {
        headers: { 'User-Agent': userAgent }
      });
      res.setHeader('Content-Type', videoRes.headers.get('content-type') || 'video/mp4');
      videoRes.body.pipe(res);
      return;
    }

    const baseUrl = baseUrlMatch[1];
    
    // Candidates for both CMAF and DASH audio tracks
    const audioCandidates = [
      `${baseUrl}CMAF_AUDIO_128.mp4`,
      `${baseUrl}CMAF_audio.mp4`,
      `${baseUrl}DASH_AUDIO_128.mp4`,
      `${baseUrl}DASH_audio.mp4`,
      `${baseUrl}DASH_AUDIO_64.mp4`,
      `${baseUrl}DASH_AUDIO_96.mp4`,
      `${baseUrl}audio`
    ];

    let audioUrl = null;
    for (const candidate of audioCandidates) {
      try {
        const headRes = await fetch(candidate, {
          method: 'HEAD',
          headers: { 'User-Agent': userAgent }
        });
        if (headRes.ok) {
          audioUrl = candidate;
          break;
        }
      } catch (_) {}
    }

    if (!audioUrl) {
      console.log(`[Proxy] No audio stream found for ${videoUrl}. Streaming video directly.`);
      const videoRes = await fetch(videoUrl, {
        headers: { 'User-Agent': userAgent }
      });
      res.setHeader('Content-Type', videoRes.headers.get('content-type') || 'video/mp4');
      videoRes.body.pipe(res);
      return;
    }

    console.log(`[FFmpeg] Merging video: ${videoUrl} with audio: ${audioUrl}`);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');

    const command = ffmpeg()
      .input(videoUrl)
      .inputOptions([
        '-user_agent', userAgent
      ])
      .input(audioUrl)
      .inputOptions([
        '-user_agent', userAgent
      ])
      .outputOptions('-c:v copy')      // copy video track directly (blazing fast, 0 CPU!)
      .outputOptions('-c:a aac')       // transcode audio track to standard AAC
      .outputOptions('-map 0:v:0')     // map video from input 0
      .outputOptions('-map 1:a:0')     // map audio from input 1
      .outputOptions('-shortest')      // end when the shortest input ends
      .format('mp4')
      .on('error', (err) => {
        console.error('[FFmpeg] Error merging tracks:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'FFmpeg merging failed' });
        }
      })
      .on('end', () => {
        console.log('[FFmpeg] Merged successfully!');
      });

    command.pipe(res, { end: true });

  } catch (err) {
    console.error('Merge proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.toString() });
    }
  }
});

function normalizeRedgifsItem(gif) {
  const videoUrl = gif.urls?.hd || gif.urls?.sd || gif.urls?.vposter || gif.urls?.gif;
  const posterUrl = gif.urls?.poster || gif.urls?.thumbnail;
  const tagList = Array.isArray(gif.tags) ? gif.tags : [];
  return {
    id: `rg_${gif.id}`,
    rawId: gif.id,
    title: tagList.length > 0 ? tagList.slice(0, 4).join(" • ") : (gif.userName ? `Clip by ${gif.userName}` : `RedGIFs Clip #${gif.id}`),
    url: videoUrl,
    fallbackUrl: gif.urls?.sd || videoUrl,
    thumbnail: posterUrl || videoUrl,
    is_video: true,
    domain: 'redgifs.com',
    subreddit: gif.userName ? `rg/${gif.userName}` : 'redgifs',
    author: gif.userName || 'redgifs',
    permalink: `https://www.redgifs.com/watch/${gif.id}`,
    source: 'redgifs',
    created_utc: gif.createDate || Math.floor(Date.now() / 1000),
    ups: gif.likes || gif.views || 0,
    num_comments: 0,
    tags: tagList,
    duration: gif.duration || 0,
  };
}

const redgifsCache = new Map();
let lastSuccessfulGifs = [
  {
    id: "UnpleasantShockingConure",
    userName: "redgifs",
    tags: ["Hot", "Trending"],
    urls: {
      hd: "https://thumbs2.redgifs.com/UnpleasantShockingConure-mobile.mp4",
      sd: "https://thumbs2.redgifs.com/UnpleasantShockingConure-mobile.mp4",
      poster: "https://thumbs2.redgifs.com/UnpleasantShockingConure-mobile.jpg"
    }
  },
  {
    id: "EmotionalNaiveFly",
    userName: "redgifs",
    tags: ["Hot", "Trending"],
    urls: {
      hd: "https://thumbs2.redgifs.com/EmotionalNaiveFly-mobile.mp4",
      sd: "https://thumbs2.redgifs.com/EmotionalNaiveFly-mobile.mp4",
      poster: "https://thumbs2.redgifs.com/EmotionalNaiveFly-mobile.jpg"
    }
  }
];

async function seedRedgifsFallback() {
  try {
    let token = await getRedgifsAccessToken();
    if (!token) return;
    const res = await fetch("https://api.redgifs.com/v2/gifs/search?search_text=hot&count=30", {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': browserUA, Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.gifs?.length) {
        lastSuccessfulGifs = data.gifs;
        console.log(`✅ Seeded RedGIFs fallback buffer with ${lastSuccessfulGifs.length} items`);
      }
    }
  } catch (err) {
    console.warn("⚠️ RedGIFs seed buffer warning:", err.message);
  }
}
seedRedgifsFallback();

// Endpoint: Search or browse RedGifs media by tag/keyword/creator
app.get("/api/redgifs/search", async (req, res) => {
  try {
    const { query = 'hot', count = '30', page = '1' } = req.query;
    let token = await getRedgifsAccessToken();
    const q = (query && query.trim()) ? query.trim() : 'hot';
    const cacheKey = `search_${q.toLowerCase()}_${page}_${count}`;

    if (redgifsCache.has(cacheKey)) {
      const cached = redgifsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        return res.json(cached.data);
      }
    }

    console.log(`🎬 [RedGIFs API Search] Query: "${q}" | Page: ${page}`);

    const authHeaders = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'User-Agent': browserUA,
      Accept: 'application/json',
    };

    // 1. Try Tag Search (tags=q)
    let searchUrl = `https://api.redgifs.com/v2/gifs/search?tags=${encodeURIComponent(q)}&count=${encodeURIComponent(count)}&page=${encodeURIComponent(page)}`;
    let response = await fetch(searchUrl, { headers: authHeaders });

    if (response.status === 401 || response.status === 403) {
      redgifsAccessToken = null;
      token = await getRedgifsAccessToken();
      response = await fetch(searchUrl, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'User-Agent': browserUA, Accept: 'application/json' },
      });
    }

    let data = response.ok ? await response.json() : {};
    let rawGifs = data.gifs || [];

    // 2. If tag search returned 0 items, check if q is a Creator / Username
    if (rawGifs.length === 0 && response.status !== 429) {
      const userUrl = `https://api.redgifs.com/v2/users/${encodeURIComponent(q)}/search?count=${encodeURIComponent(count)}&page=${encodeURIComponent(page)}`;
      const userRes = await fetch(userUrl, { headers: authHeaders });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.gifs && userData.gifs.length > 0) {
          data = userData;
          rawGifs = userData.gifs;
          console.log(`  👤 Matched Creator [${q}] -> ${rawGifs.length} clips`);
        }
      }
    }

    // 3. Try search_text=q with order=latest
    if (rawGifs.length === 0 && response.status !== 429) {
      const latestUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(q)}&order=latest&count=${encodeURIComponent(count)}&page=${encodeURIComponent(page)}`;
      const latestRes = await fetch(latestUrl, { headers: authHeaders });
      if (latestRes.ok) {
        const latestData = await latestRes.json();
        if (latestData.gifs && latestData.gifs.length > 0) {
          data = latestData;
          rawGifs = latestData.gifs;
        }
      }
    }

    // 4. Try generic search_text=q if still 0
    if (rawGifs.length === 0 && response.status !== 429) {
      const fallbackUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(q)}&count=${encodeURIComponent(count)}&page=${encodeURIComponent(page)}`;
      const fbRes = await fetch(fallbackUrl, { headers: authHeaders });
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        if (fbData.gifs && fbData.gifs.length > 0) {
          data = fbData;
          rawGifs = fbData.gifs;
        }
      }
    }

    // 5. High-availability buffer fallback on rate-limit (429) or empty responses
    if (rawGifs.length > 0) {
      lastSuccessfulGifs = rawGifs;
    } else {
      if (lastSuccessfulGifs.length === 0) {
        await seedRedgifsFallback();
      }
      if (lastSuccessfulGifs.length > 0) {
        console.log(`  🛡️ RedGIFs High-Availability Guard -> Serving ${lastSuccessfulGifs.length} fallback clips for "${q}"`);
        rawGifs = lastSuccessfulGifs;
      }
    }

    const posts = rawGifs.map(normalizeRedgifsItem).filter(p => p.url);

    const result = {
      posts,
      page: data.page || Number(page),
      pages: data.pages || 1,
      total: data.total || posts.length,
      hasMore: posts.length > 0,
      nextPage: (data.page || Number(page)) + 1
    };

    if (posts.length > 0) {
      redgifsCache.set(cacheKey, { timestamp: Date.now(), data: result });
    }

    res.json(result);
  } catch (err) {
    console.error("❌ RedGifs Search Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Trending RedGIFs clips
app.get("/api/redgifs/trending", async (req, res) => {
  try {
    const { count = '30', page = '1', order = 'trending' } = req.query;
    let token = await getRedgifsAccessToken();

    console.log(`🔥 [RedGIFs API Trending] Order: "${order}" | Page: ${page}`);

    const trendingUrl = `https://api.redgifs.com/v2/gifs/search?search_text=hot&order=${encodeURIComponent(order)}&count=${encodeURIComponent(count)}&page=${encodeURIComponent(page)}`;
    
    let response = await fetch(trendingUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'User-Agent': browserUA,
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      redgifsAccessToken = null;
      token = await getRedgifsAccessToken();
      response = await fetch(trendingUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': browserUA,
          Accept: 'application/json',
        },
      });
    }

    let data = response.ok ? await response.json() : {};
    let rawGifs = data.gifs || [];

    if (rawGifs.length > 0) {
      lastSuccessfulGifs = rawGifs;
    } else if (lastSuccessfulGifs.length > 0) {
      console.log(`  🛡️ RedGIFs Trending Rate-Limit Guard (429) -> Serving ${lastSuccessfulGifs.length} fallback clips`);
      rawGifs = lastSuccessfulGifs;
    }

    const posts = rawGifs.map(normalizeRedgifsItem).filter(p => p.url);

    res.json({
      posts,
      page: data.page || Number(page),
      pages: data.pages || 1,
      total: data.total || posts.length,
      hasMore: posts.length > 0,
      nextPage: (data.page || Number(page)) + 1
    });
  } catch (err) {
    console.error("❌ RedGifs Trending Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Females RedGIFs feed (female-focused tags/niches only)
app.get("/api/redgifs/females", async (req, res) => {
  try {
    const { mood = 'all', count = '30', page = '1', order = 'trending' } = req.query;
    let token = await getRedgifsAccessToken();

    const moodTagMap = {
      'hot-guys': 'male solo',
      'big-dick': 'male',
      'fit-body': 'fitness amateur',
      'romantic': 'romantic couple',
      'gentle-dom': 'bdsm female',
      'couples': 'passionate couple',
      'pov': 'female pov',
      'audio': 'female voice',
      'all': 'female solo'
    };

    const tagToSearch = moodTagMap[mood] || 'female solo';
    console.log(`🌸 [RedGIFs API Females] Mood: "${mood}" -> Tag: "${tagToSearch}" | Page: ${page}`);

    const searchUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(tagToSearch)}&order=${encodeURIComponent(order)}&count=${encodeURIComponent(count)}&page=${encodeURIComponent(page)}`;

    let response = await fetch(searchUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'User-Agent': browserUA,
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      redgifsAccessToken = null;
      token = await getRedgifsAccessToken();
      response = await fetch(searchUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': browserUA,
          Accept: 'application/json',
        },
      });
    }

    let data = response.ok ? await response.json() : {};
    let rawGifs = data.gifs || [];

    if (rawGifs.length > 0) {
      lastSuccessfulGifs = rawGifs;
    } else if (lastSuccessfulGifs.length > 0) {
      console.log(`  🛡️ RedGIFs Females Rate-Limit Guard (429) -> Serving ${lastSuccessfulGifs.length} fallback clips`);
      rawGifs = lastSuccessfulGifs;
    }

    const posts = rawGifs.map(normalizeRedgifsItem).filter(p => p.url);

    res.json({
      posts,
      page: data.page || Number(page),
      pages: data.pages || 1,
      total: data.total || posts.length,
      hasMore: posts.length > 0,
      nextPage: (data.page || Number(page)) + 1
    });
  } catch (err) {
    console.error("❌ RedGifs Females Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Get list of popular RedGIFs Niches / Categories
app.get("/api/redgifs/niches", async (req, res) => {
  try {
    let token = await getRedgifsAccessToken();
    const response = await fetch("https://api.redgifs.com/v2/niches", {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'User-Agent': browserUA,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    res.json({
      niches: [
        { name: 'Amateur', id: 'amateur' },
        { name: 'Cosplay', id: 'cosplay' },
        { name: 'Solo Female', id: 'solo-female' },
        { name: 'Fitness', id: 'fitness' },
        { name: 'Sensual', id: 'sensual' }
      ]
    });
  } catch (err) {
    res.json({
      niches: [
        { name: 'Amateur', id: 'amateur' },
        { name: 'Cosplay', id: 'cosplay' },
        { name: 'Solo Female', id: 'solo-female' },
        { name: 'Fitness', id: 'fitness' }
      ]
    });
  }
});

// Endpoint: Fetch RedGifs media direct video stream URL
app.get("/api/redgifs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing RedGifs ID" });

    const cleanId = id.toLowerCase();
    let token = await getRedgifsAccessToken();

    let response = await fetch(`https://api.redgifs.com/v2/gifs/${cleanId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'User-Agent': browserUA,
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      // Refresh token & retry once
      redgifsAccessToken = null;
      token = await getRedgifsAccessToken();
      response = await fetch(`https://api.redgifs.com/v2/gifs/${cleanId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': browserUA,
          Accept: 'application/json',
        },
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: `RedGifs API returned ${response.status}` });
    }

    const data = await response.json();
    const gifUrls = data?.gif?.urls || {};
    const videoUrl = gifUrls.hd || gifUrls.sd || gifUrls.gif || gifUrls.vposter;

    if (!videoUrl) {
      return res.status(404).json({ error: "No video URL found for RedGifs item" });
    }

    res.json({ success: true, url: videoUrl, gif: data.gif });
  } catch (err) {
    console.error("❌ RedGifs Proxy Endpoint Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});

