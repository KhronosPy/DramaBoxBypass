const form = document.getElementById('search-form');
const apiKeyInput = document.getElementById('api-key');
const dramaIdInput = document.getElementById('drama-id');
const statusEl = document.getElementById('status');
const buttonsEl = document.getElementById('episode-buttons');
const video = document.getElementById('player');

let currentApiKey = '';
let currentDramaId = '';
let hls = null;
let totalEpisodes = 0;
let currentEpisode = 0;
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

function getRemainingPlaybackTime() {
  if (!Number.isFinite(video.duration) || !Number.isFinite(video.currentTime)) {
    return null;
  }

  const remainingMediaTime = Math.max(0, video.duration - video.currentTime);
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
      document.exitFullscreen().catch(() => {});
    }
    return;
  }

  if (target.requestFullscreen) {
    target.requestFullscreen().catch(() => {});
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
  nextCountdownValue = remainingTime === null ? 5 : Math.max(1, Math.ceil(remainingTime));
  label.textContent = String(nextCountdownValue);

  const countdown = () => {
    if (!nextPromptVisible || nextPromptDismissed) {
      return;
    }

    const remainingTimeValue = getRemainingPlaybackTime();
    nextCountdownValue = remainingTimeValue === null ? 1 : Math.max(1, Math.ceil(remainingTimeValue));
    label.textContent = String(nextCountdownValue);

    if (remainingTimeValue !== null && remainingTimeValue <= 1) {
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

    if (remainingTime !== null && remainingTime <= 5) {
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

  try {
    const url = `/api/hls?apiKey=${encodeURIComponent(currentApiKey)}&id=${encodeURIComponent(currentDramaId)}&ep=${episodeNumber}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `media request failed (${response.status})`);
    }

    const sourceUrl = data.url || data.sourceUrl || data.mp4Url || data.videoUrl;
    if (!sourceUrl) {
      throw new Error('No playable media URL returned.');
    }

    destroyHls();

    video.src = sourceUrl;
    video.load();
    video.play().catch(() => {});
    setStatus(`Playing episode ${episodeNumber}${data.quality ? ` (${data.quality})` : ''}.`);
    if (currentEpisode < totalEpisodes) {
      setupEndCountdown();
    }
  } catch (error) {
    setStatus(`Playback failed: ${error.message}`);
  }
}

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isEditable = target instanceof HTMLElement
    ? target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    : false;

  if (isEditable || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleFullscreen();
  }
});

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

    const total = Number(data.totalEpisodes || data.chapterCount || 0);
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('No episodes were returned.');
    }

    totalEpisodes = total;
    currentEpisode = 0;
    createEpisodeButtons(total);
    setStatus(`Loaded ${total} episodes.`);
  } catch (error) {
    setStatus(error.message);
  }
});