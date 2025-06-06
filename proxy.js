import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors());

app.get('/api/reddit', async (req, res) => {
  try {
    const response = await fetch('https://www.reddit.com/r/NSFW_GIF/hot.json?limit=10', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server running at http://localhost:${PORT}`);
});
