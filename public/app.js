const form = document.getElementById('search-form');
const apiKeyInput = document.getElementById('api-key');
const dramaIdInput = document.getElementById('drama-id');
const statusEl = document.getElementById('status');
const buttonsEl = document.getElementById('episode-buttons');
const video = document.getElementById('player');

// Initialize Plyr with default options to avoid hiding default controls.
let player = new Plyr('#player');

let currentApiKey = '';
let currentDramaId = '';
let totalEpisodes = 0;
let episodesData = [];
let currentEpisode = 0;
let currentQuality = '';
let nextCountdownTimer = null;
let nextCountdownValue = 5;
let nextPromptVisible = false;
let nextPromptDismissed = false;
let endTimer = null;

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
    if (i === currentEpisode) {
      button.classList.add('active');
    }
    fragment.appendChild(button);
  }

  buttonsEl.appendChild(fragment);
}

function getEpisodeByNumber(episodeNumber) {
  return episodesData.find((episode) => Number(episode.number) === Number(episodeNumber)) || null;
}

function getMediaSources(episode) {
  if (!episode || typeof episode !== 'object') {
    return [];
  }

  const sources = [];

  if (Array.isArray(episode.qualities)) {
    episode.qualities.forEach((item) => {
      if (item && typeof item.url === 'string' && item.url.trim()) {
        sources.push({
          label: item.quality || 'Unknown quality',
          value: item.quality || item.url,
          url: item.url,
        });
      }
    });
  }

  if (typeof episode.videoUrl === 'string' && episode.videoUrl.trim()) {
    sources.push({
      label: 'videoUrl',
      value: 'videoUrl',
      url: episode.videoUrl,
    });
  }

  if (typeof episode.mp4Url === 'string' && episode.mp4Url.trim()) {
    sources.push({
      label: 'mp4Url',
      value: 'mp4Url',
      url: episode.mp4Url,
    });
  }

  if (sources.length === 0 && typeof episode.hlsUrl === 'string' && episode.hlsUrl.trim()) {
    sources.push({
      label: 'hls',
      value: 'hls',
      url: episode.hlsUrl,
    });
  }

  return sources.filter((source, index, all) => source.url && all.findIndex((item) => item.url === source.url) === index);
}

function updateVideoSources(episode) {
  const sources = getMediaSources(episode);
  if (sources.length === 0) {
    video.innerHTML = '';
    return null;
  }

  const orderedSources = [...sources];

  const finalSources = orderedSources.map((source) => {
    const match = String(source.value).match(/(\d+)/);
    const size = match ? Number(match[1]) : undefined;
    return {
      src: source.url,
      type: 'video/mp4',
      size,
    };
  });
  /*
  video.innerHTML = '';
  orderedSources.forEach((source) => {
    const sourceEl = document.createElement('source');
    sourceEl.src = source.url;
    sourceEl.type = 'video/mp4';
    sourceEl.dataset.quality = source.value;
    video.appendChild(sourceEl);
    
  });
  currentQuality = orderedSources[0].value || '';
  
  */
  //update player sources
  return finalSources || null;
}

function getRemainingPlaybackTime() {
  // Prefer Plyr's timings when available, fallback to native video element
  const dur = (player && typeof player.duration === 'number' && Number.isFinite(player.duration))
    ? player.duration
    : (Number.isFinite(video.duration) ? video.duration : NaN);
  const cur = (player && typeof player.currentTime === 'number' && Number.isFinite(player.currentTime))
    ? player.currentTime
    : (Number.isFinite(video.currentTime) ? video.currentTime : NaN);

  if (!Number.isFinite(dur) || !Number.isFinite(cur)) {
    return null;
  }

  const remainingMediaTime = Math.max(0, dur - cur);
  const playbackRate = Number(video.playbackRate) || 1;

  if (remainingMediaTime <= 0) {
    return 0;
  }

  return remainingMediaTime / Math.max(playbackRate, 0.001);
}

function clearNextPrompt() {
  if (nextCountdownTimer) {
    clearInterval(nextCountdownTimer);
    nextCountdownTimer = null;
  }
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  nextCountdownValue = 5;
  nextPromptVisible = false;
  nextPromptDismissed = false;
  const existing = document.getElementById('next-episode-prompt');
  if (existing) {
    existing.remove();
  }
}

function toggleFullscreen() {
  const target = document.querySelector('.player-panel') || video;
  if (!target) {
    return;
  }

  if (document.fullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
    return;
  }

  if (target.requestFullscreen) {
    target.requestFullscreen().catch(() => { });
  } else if (target.mozRequestFullScreen) {
    target.mozRequestFullScreen();
  } else if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen();
  } else if (target.msRequestFullscreen) {
    target.msRequestFullscreen();
  }
}

function showNextPrompt() {
  clearNextPrompt();
  if (currentEpisode <= 0 || currentEpisode >= totalEpisodes) {
    return;
  }

  // Only show the prompt when there are last seconds remaining.
  const remainingTimeCheck = getRemainingPlaybackTime();
  if (remainingTimeCheck === null || Math.floor(remainingTimeCheck) > 5) {
    return;
  }

  nextPromptVisible = true;
  nextPromptDismissed = false;

  const prompt = document.createElement('div');
  prompt.id = 'next-episode-prompt';
  prompt.className = 'next-episode-prompt';
  prompt.innerHTML = `<span>Next in <strong>5</strong> <button type="button" class="next-episode-dismiss" id="next-episode-dismiss">x</button></span>`;

  const playerPanel = document.querySelector('.player-panel');
  if (playerPanel) {
    playerPanel.appendChild(prompt);
  } else {
    document.body.appendChild(prompt);
  }

  const label = prompt.querySelector('strong');
  const dismissButton = prompt.querySelector('#next-episode-dismiss');
  const remainingTime = getRemainingPlaybackTime();
  nextCountdownValue = remainingTime === null ? 5 : Math.max(1, Math.floor(remainingTime));
  label.textContent = String(nextCountdownValue-1);

  const countdown = () => {
    if (!nextPromptVisible || nextPromptDismissed) {
      return;
    }

    const remainingTimeValue = getRemainingPlaybackTime();
    nextCountdownValue = remainingTimeValue === null ? 1 : Math.max(1, Math.ceil(remainingTimeValue));
    label.textContent = String(nextCountdownValue-1);

    if (remainingTimeValue !== null && remainingTimeValue <= 2) {
      // Deshabilitamos la opcion de cerrar
      dismissButton.style.display = 'none';
    }
    if (remainingTimeValue !== null && remainingTimeValue <= 0) {
      clearInterval(nextCountdownTimer);
      nextCountdownTimer = null;
      nextPromptVisible = false;
      prompt.remove();
      loadEpisode(currentEpisode + 1);
    }
  };

  nextCountdownTimer = setInterval(countdown, 1000);

  dismissButton.addEventListener('click', (event) => {
    event.stopPropagation();
    nextPromptDismissed = true;
    nextPromptVisible = false;
    clearNextPrompt();
  });

  prompt.addEventListener('click', () => {
    if (!nextPromptDismissed) {
      nextPromptDismissed = true;
      nextPromptVisible = false;
      clearNextPrompt();
      loadEpisode(currentEpisode + 1);
    }
  });
}

function setupEndCountdown() {
  if (currentEpisode <= 0 || currentEpisode >= totalEpisodes) {
    return;
  }

  clearNextPrompt();

  const startCountdown = () => {
    const remainingTime = getRemainingPlaybackTime();

    if (remainingTime !== null && Math.floor(remainingTime) <= 5) {
      if (!nextPromptVisible) {
        showNextPrompt();
      }
      return;
    }

    endTimer = setTimeout(startCountdown, 250);
  };

  endTimer = setTimeout(startCountdown, 250);
}

async function loadEpisode(episodeNumber) {
  clearNextPrompt();
  currentEpisode = episodeNumber;
  setStatus(`Loading episode ${episodeNumber}...`);

  const episode = getEpisodeByNumber(episodeNumber);
  if (!episode) {
    setStatus('Episode not found in loaded data.');
    return;
  }

  const newSources = updateVideoSources(episode);

  if (!newSources || newSources.length === 0) {
    setStatus('No playable media URL available for this episode.');
    return;
  } else {

    // If we have numeric sizes, make them available to Plyr's quality menu
    try {
      const sizes = newSources.map((s) => Number.isFinite(Number(s.size)) ? Number(s.size) : null).filter((v) => v !== null);
      if (sizes.length > 0) {
        // Sort descending so the default is the highest quality
        const options = sizes.sort((a, b) => b - a);
        // Recreate the Plyr instance with quality options so the Settings menu is built correctly
        try {
          player.destroy();
        } catch (e) {}
        player = new Plyr('#player', {
          controls: ['play-large','play','progress','current-time','mute','volume','settings','fullscreen'],
          // Include both quality and speed in the settings menu
          settings: ['quality', 'speed'],
          quality: { default: options[0], options }
        });
      } else {
        player.options.quality = { options: [] };
      }
    } catch (e) {
      console.warn('Error setting player.options.quality', e);
    }

    // Update the player source with the new sources
    player.source = {
      type: 'video',
      sources: newSources
    };

    // Start the end countdown only after metadata is loaded to avoid triggering immediately
    try {
      player.once('loadedmetadata', () => {
        setupEndCountdown();
      });
    } catch (e) {
      // Fallback: if the player doesn't support the event, start countdown immediately
      setupEndCountdown();
    }
  }
  // Play via Plyr and update status
  player.play().catch(() => {});
  setStatus(`Playing episode ${episodeNumber}${currentQuality ? ` (${currentQuality})` : ''}.`);

  createEpisodeButtons(totalEpisodes);

  if (currentEpisode < totalEpisodes) {
    setupEndCountdown();
  }
}

// Plyr provides its own keyboard shortcuts and fullscreen handling.
// Removed custom F-key handler to avoid conflicts with Plyr.

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
    const response = await fetch(`/api/episodes?apiKey=${encodeURIComponent(currentApiKey)}&id=${encodeURIComponent(currentDramaId)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch episodes.');
    }

    episodesData = Array.isArray(data.episodes) ? data.episodes : [];
    const total = Number(data.totalEpisodes || data.chapterCount || episodesData.length || 0);
    if (!Number.isFinite(total) || total <= 0 || episodesData.length === 0) {
      throw new Error('No episodes were returned.');
    }

    totalEpisodes = total;
    currentEpisode = 0;
    currentQuality = '';
    createEpisodeButtons(total);
    setStatus(`Loaded ${total} episodes. Select an episode to play.`);
  } catch (error) {
    setStatus(error.message);
  }
});