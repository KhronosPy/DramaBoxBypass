const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/episodes', async (req, res) => {
  const apiKey = req.query.apiKey;
  const id = req.query.id;
  const lang = req.query.lang || 'es';

  if (!apiKey || !id) {
    return res.status(400).json({ error: 'apiKey and id are required' });
  }

  try {
    const response = await fetch(
      `https://api.hoshiyomi.my.id/api/dramabox/allepisode?id=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`,
      {
        headers: {
          'X-API-Key': apiKey,
          Accept: 'application/json',
        },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).type('text/plain').send(text);
    }

    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch {
      return res.type('text/plain').send(text);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch episodes', details: error.message });
  }
});

app.get('/api/hls', async (req, res) => {
  const apiKey = req.query.apiKey;
  const id = req.query.id;
  const ep = req.query.ep;

  if (!apiKey || !id || !ep) {
    return res.status(400).json({ error: 'apiKey, id, and ep are required' });
  }

  try {
    const remoteUrl = `https://api.hoshiyomi.my.id/api/dramabox/hls?id=${encodeURIComponent(id)}&ep=${encodeURIComponent(ep)}`;
    const response = await fetch(remoteUrl, {
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/vnd.apple.mpegurl, text/plain, */*',
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).type('text/plain').send(text);
    }

    let playlist = text;
    if (typeof text === 'string' && text.trim().startsWith('"') && text.trim().endsWith('"')) {
      try {
        playlist = JSON.parse(text);
      } catch {
        playlist = text;
      }
    }

    res.type('application/vnd.apple.mpegurl').send(playlist);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch HLS playlist', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`DramaBox UI is running at http://localhost:${port}`);
});
