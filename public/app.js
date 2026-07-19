const form = document.getElementById('search-form');
const apiKeyInput = document.getElementById('api-key');
const dramaIdInput = document.getElementById('drama-id');
const statusEl = document.getElementById('status');
const buttonsEl = document.getElementById('episode-buttons');
const video = document.getElementById('player');

let currentApiKey = '';
let currentDramaId = '';
let hls = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function createEpisodeButtons(totalEpisodes) {
  buttonsEl.innerHTML = '';
  const fragment = document.createDocumentFragment();

  for (let i = 1; i <= totalEpisodes; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = i;
    button.addEventListener('click', () => loadEpisode(i));
    fragment.appendChild(button);
  }

  buttonsEl.appendChild(fragment);
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
}

async function loadEpisode(episodeNumber) {
  setStatus(`Loading episode ${episodeNumber}...`);

  try {
    const url = `/api/hls?apiKey=${encodeURIComponent(currentApiKey)}&id=${encodeURIComponent(currentDramaId)}&ep=${episodeNumber}`;
    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`playlist request failed (${response.status}): ${text.slice(0, 180)}`);
    }

    if (!text.trim().startsWith('#EXTM3U')) {
      throw new Error(`received invalid playlist data: ${text.slice(0, 180)}`);
    }

    destroyHls();

    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls();
      hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStatus(`Playback error: ${data.type} - ${data.details}`);
        }
      });

      const blob = new Blob([text], { type: 'application/vnd.apple.mpegurl' });
      const objectUrl = URL.createObjectURL(blob);
      hls.loadSource(objectUrl);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setStatus(`Playing episode ${episodeNumber}.`);
      });
    } else {
      const blob = new Blob([text], { type: 'application/vnd.apple.mpegurl' });
      const objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      video.load();
      video.play().catch(() => {});
      setStatus(`Playing episode ${episodeNumber}.`);
    }
  } catch (error) {
    setStatus(`Playback failed: ${error.message}`);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  currentApiKey = apiKeyInput.value.trim();
  currentDramaId = dramaIdInput.value.trim();

  if (!currentApiKey || !currentDramaId) {
    setStatus('Please enter both an API key and a drama ID.');
    return;
  }

  setStatus('Fetching episode list...');

  try {
    const response = await fetch(`/api/episodes?apiKey=${encodeURIComponent(currentApiKey)}&id=${encodeURIComponent(currentDramaId)}&lang=es`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch episodes.');
    }

    const total = Number(data.totalEpisodes || data.chapterCount || 0);
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('No episodes were returned.');
    }

    createEpisodeButtons(total);
    setStatus(`Loaded ${total} episodes.`);
  } catch (error) {
    setStatus(error.message);
  }
});
