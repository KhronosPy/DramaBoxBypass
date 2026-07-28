const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

function pickBestMediaUrl(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (typeof data.videoUrl === 'string' && data.videoUrl.trim()) {
    return { url: data.videoUrl, quality: 'videoUrl' };
  }

  if (typeof data.mp4Url === 'string' && data.mp4Url.trim()) {
    return { url: data.mp4Url, quality: 'mp4Url' };
  }

  if (Array.isArray(data.qualities)) {
    const ranked = data.qualities
      .filter((item) => item && typeof item.url === 'string' && item.url.trim())
      .map((item) => {
        const match = String(item.quality || '').match(/(\d+)p/i);
        const numericQuality = match ? Number(match[1]) : null;
        return { ...item, numericQuality };
      })
      .filter((item) => Number.isFinite(item.numericQuality))
      .sort((a, b) => (b.numericQuality || 0) - (a.numericQuality || 0));

    if (ranked.length > 0) {
      return { url: ranked[0].url, quality: ranked[0].quality || 'unknown' };
    }
  }

  return null;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/episodes', async (req, res) => {
  const apiKey = req.query.apiKey;
  const id = req.query.id;

  if (!apiKey || !id) {
    return res.status(400).json({ error: 'apiKey and id are required' });
  }

  try {
    const episodesUrl = `https://api.hoshiyomi.my.id/api/dramaboxv2/allepisode?id=${encodeURIComponent(id)}&lang=es&q=${Date.now()}`;
    
    console.log(`Fetching episodes from: ${episodesUrl}`);
    const response = await fetch(
      episodesUrl,
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
    //actualmente hay un problema con el lenguaje español, por lo que se usara el default "en"
    const remoteUrl = `https://api.hoshiyomi.my.id/api/dramaboxv2/episode?id=${encodeURIComponent(id)}&ep=${encodeURIComponent(ep)}&q=${Date.now()}&lang=es`;
    console.log(`Fetching episode media from: ${remoteUrl}`);
    const response = await fetch(remoteUrl, {
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).type('text/plain').send(text);
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      return res.status(502).type('text/plain').send(text);
    }

    const media = pickBestMediaUrl(payload);

    if (!media) {
      return res.status(502).json({ error: 'No playable media URL returned by upstream episode endpoint' });
    }

    return res.json({
      url: media.url,
      quality: media.quality,
      title: payload.title || '',
      caption: payload.caption || null,
      qualities: payload.qualities || [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch episode media', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`DramaBox UI is running at http://localhost:${port}`);
});
