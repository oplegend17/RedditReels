import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3001 || process.env.PORT;

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Get available subreddits
app.get('/api/subreddits', (req, res) => {
  const subreddits = process.env.DEFAULT_SUBREDDITS.split(',');
  res.json({ subreddits });
});

// Get default subreddit content
app.get('/api/reddit', async (req, res) => {
  try {
    const defaultSubreddit = process.env.DEFAULT_SUBREDDITS.split(',')[0];
    const url = `${process.env.REDDIT_BASE_URL}${defaultSubreddit}/hot.json?limit=${process.env.ITEMS_PER_PAGE || 30}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': process.env.USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// Get specific subreddit content
app.get('/api/reddit/:subreddit', async (req, res) => {
  try {    const subreddit = req.params.subreddit;
    const after = req.query.after || '';
    const limit = 50; // Increased limit for better pagination
    const url = `${process.env.REDDIT_BASE_URL}${subreddit}/hot.json?limit=${limit}&raw_json=1${after ? `&after=${after}` : ''}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': process.env.USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
