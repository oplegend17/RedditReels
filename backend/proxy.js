import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { DEFAULT_SUBREDDITS, SUBREDDIT_CATEGORIES } from "./subreddits.js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Init Cerebras if API key exists
const cerebras = process.env.CEREBRAS_API_KEY ? new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY }) : null;


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
      method: 'POST',
      headers: {
        'User-Agent': browserUA,
        'Accept': 'application/json',
        'Referer': 'https://www.redgifs.com/',
        'Origin': 'https://www.redgifs.com'
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
  res.json({ subreddits: DEFAULT_SUBREDDITS });
});

// Subreddit categories endpoint
app.get("/api/subreddits/categories", (req, res) => {
  res.json({ categories: SUBREDDIT_CATEGORIES });
});

// AI smart search endpoint — decides intent then acts
app.post("/api/ai/mood", async (req, res) => {
  const vibe = (req.body?.vibe || "").trim().slice(0, 200);
  if (!vibe) return res.status(400).json({ error: "Missing vibe" });

  const cacheKey = vibe.toLowerCase();
  if (vibeCache.has(cacheKey)) {
    return res.json({ ...vibeCache.get(cacheKey), cached: true });
  }

  const subList = ALL_KNOWN_SUBS.join(", ");

  try {
    const response = await cerebras.chat.completions.create({
      model: "llama3.1-8b",
      max_completion_tokens: 150,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are a smart search router for an adult content platform.

Given a user query, decide if it is:
- "search": a specific keyword, name, pornstar, term, or short phrase the user wants to search Reddit for directly
- "mood": a vibe, feeling, or descriptive natural language mood where you should pick matching subreddits

If "search": return { "intent": "search", "query": "<the search term to use>" }
If "mood": return { "intent": "mood", "subreddits": [5-8 names from this list: ${subList}] }

Return ONLY valid JSON. No explanation, no markdown.`,
        },
        {
          role: "user",
          content: vibe,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");

    const parsed = JSON.parse(match[0]);
    console.log(`✨ AI intent [${vibe}] →`, parsed);

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

      if (validated.length === 0) throw new Error("No valid subreddits");
      const result = { intent: "mood", subreddits: validated };
      vibeCache.set(cacheKey, result);
      return res.json(result);
    }

    throw new Error("Unexpected response shape");
  } catch (err) {
    console.error("❌ AI smart search error:", err.message);
    const fallback = DEFAULT_SUBREDDITS.sort(() => 0.5 - Math.random()).slice(0, 6);
    res.json({ intent: "mood", subreddits: fallback, fallback: true });
  }
});

// Default subreddit route (uses OAuth)
app.get("/api/reddit", async (req, res) => {
  try {
    const token = await getRedditAccessToken();
    const defaultSubreddit = DEFAULT_SUBREDDITS[0];
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
    const sort = req.query.sort || "hot";
    const t = req.query.t || "all";
    const after = req.query.after || "";
    const limit = 50;
    let url = `https://oauth.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`;
    if (sort === "top" && t) {
      url += `&t=${t}`;
    }
    if (after) {
      url += `&after=${after}`;
    }
    console.log(`🔎 Fetching subreddit with OAuth: ${url}`);
    const response = await fetch(url, { headers: buildHeaders(token) });

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
    console.error(`❌ Error fetching subreddit: ${req.params.subreddit}`);
    console.error(err);
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

// RedGifs metadata proxy
app.get("/api/redgifs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const token = await getRedgifsAccessToken();
    if (!token) throw new Error('Unauthorized - RedGifs token missing');
    
    // Exact official URL pattern
    const url = `https://api.redgifs.com/v2/gifs/${id}?views=yes&users=yes&niches=yes`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': browserUA,
        'Accept': 'application/json',
        'Referer': 'https://www.redgifs.com/',
        'Origin': 'https://www.redgifs.com'
      },
    });

    if (!response.ok) {
       console.log(`⚠️ RedGifs API Error: ${response.status} for ID: ${id}`);
       throw new Error(`RedGifs API returned ${response.status}`);
    }

    const data = await response.json();
    const gif = data.gif || data;
    
    if (!gif?.urls) {
        console.error("Malformed RedGifs response:", JSON.stringify(data).slice(0, 200));
        throw new Error('Invalid RedGifs metadata structure');
    }

    res.json({ 
      url: gif.urls.hd || gif.urls.sd || gif.urls.hls || gif.urls.vtt,
      poster: gif.urls.poster || gif.urls.thumbnail 
    });
  } catch (err) {
    console.error(`❌ RedGifs Proxy Error: ${id} ->`, err.message);
    res.status(500).json({ error: err.message });
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
