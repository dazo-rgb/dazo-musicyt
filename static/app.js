const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const statusText = document.getElementById('statusText');
const searchResultsContainer = document.getElementById('searchResultsContainer');
const resultsList = document.getElementById('resultsList');
const playerSection = document.getElementById('playerSection');
const npCover = document.getElementById('npCover');
const npTitle = document.getElementById('npTitle');
const audioPlayer = document.getElementById('audioPlayer');
const lyricsContainer = document.getElementById('lyricsContainer');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const volumeSlider = document.getElementById('volumeSlider');
const progressBarWrapper = document.getElementById('progressBarWrapper');
const progressFill = document.getElementById('progressFill');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const durationDisplay = document.getElementById('durationDisplay');
const queueSection = document.getElementById('queueSection');
const queueList = document.getElementById('queueList');
const toggleEqBtn = document.getElementById('toggleEqBtn');
const eqPanel = document.getElementById('eqPanel');
const eqPreset = document.getElementById('eqPreset');
const eqSliders = {
  60: document.getElementById('eq-60'),
  230: document.getElementById('eq-230'),
  910: document.getElementById('eq-910'),
  '3k': document.getElementById('eq-3k'),
  '14k': document.getElementById('eq-14k'),
};

let audioContext,
  sourceNode,
  analyser,
  filters = {},
  isAudioInitialized = false;
let visualizerColor = 'rgb(29, 185, 84)';
let syncedLyricsData = [];
let playQueue = [];

const canvas = document.getElementById('visualizerCanvas');
const canvasCtx = canvas.getContext('2d');
window.addEventListener('resize', () => {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
});

function renderQueue() {
  queueList.innerHTML = '';
  if (playQueue.length === 0) {
    queueSection.style.display = 'none';
    nextTrackBtn.style.opacity = '0.3';
    return;
  }
  queueSection.style.display = 'block';
  nextTrackBtn.style.opacity = '1';

  playQueue.slice(0, 3).forEach((track) => {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.style.borderLeftColor = visualizerColor;
    div.innerHTML = `<img src="${track.thumbnail || 'https://via.placeholder.com/90x50/333/ccc?text=No+Cover'}" class="queue-thumb"><div class="text-truncate">${track.title}</div>`;
    queueList.appendChild(div);
  });
}

function playNextInQueue() {
  if (playQueue.length > 0) {
    playSelectedTrack(playQueue.shift(), false);
  } else {
    statusText.innerHTML = `<span class="text-white-50">🎵 Antrean habis.</span>`;
    playPauseBtn.textContent = '▶';
  }
}

audioPlayer.addEventListener('ended', playNextInQueue);
nextTrackBtn.addEventListener('click', () => {
  if (playQueue.length > 0) playNextInQueue();
});

function formatTime(s) {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

playPauseBtn.addEventListener('click', async () => {
  if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
  audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause();
  initAudioContext();
});

audioPlayer.addEventListener('play', () => (playPauseBtn.textContent = '⏸'));
audioPlayer.addEventListener('pause', () => (playPauseBtn.textContent = '▶'));
audioPlayer.addEventListener('loadedmetadata', () => {
  durationDisplay.textContent = formatTime(audioPlayer.duration);
});

progressBarWrapper.addEventListener('click', (e) => {
  const rect = progressBarWrapper.getBoundingClientRect();
  if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
    audioPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * audioPlayer.duration;
  }
});
volumeSlider.addEventListener('input', (e) => {
  audioPlayer.volume = e.target.value;
});

function initAudioContext() {
  if (isAudioInitialized) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 192000 });
  } catch (e) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Fallback otomatis
  }
  sourceNode = audioContext.createMediaElementSource(audioPlayer);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  let prevNode = sourceNode;
  [60, 230, 910, 3000, 14000].forEach((freq, i) => {
    const filter = audioContext.createBiquadFilter();
    filter.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
    filter.frequency.value = freq;
    filter.gain.value = eqSliders[freq === 3000 ? '3k' : freq === 14000 ? '14k' : freq].value;
    if (filter.type === 'peaking') filter.Q.value = 1.0;
    prevNode.connect(filter);
    prevNode = filter;
    filters[freq] = filter;
  });
  prevNode.connect(analyser);
  analyser.connect(audioContext.destination);
  isAudioInitialized = true;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  drawVisualizer();
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  const bw = (canvas.width / analyser.frequencyBinCount) * 2.5;
  let x = 0;
  for (let i = 0; i < analyser.frequencyBinCount; i++) {
    const bh = data[i] / 2;
    canvasCtx.fillStyle = visualizerColor;
    canvasCtx.fillRect(x, canvas.height - bh, bw, bh);
    x += bw + 2;
  }
}

async function fetchLyrics(rawTitle) {
  lyricsContainer.innerHTML = `<p class="text-white-50 mt-5 small">Mencari lirik otomatis...</p>`;
  syncedLyricsData = [];
  try {
    const clean = rawTitle
      .replace(/.*?|⟨.*?⟩|［.*?］|【.*?】|ft\.?|feat\.?.*/gi, '')
      .replace(/official|music video|lyric video|HD|HQ|4K|audio/gi, '')
      .trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      const match = data.find((i) => i.syncedLyrics) || data[0];
      if (match.syncedLyrics) {
        let html = '';
        match.syncedLyrics.split('\n').forEach((line, idx) => {
          const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
          if (m && m[4].trim()) {
            const sec =
              parseInt(m[1]) * 60 +
              parseInt(m[2]) +
              parseInt(m[3].length === 2 ? m[3] + '0' : m[3]) / 1000;
            syncedLyricsData.push({ time: sec, text: m[4].trim() });
            html += `<div class="lyric-line" id="line-${idx}">${m[4].trim()}</div>`;
          }
        });
        lyricsContainer.innerHTML = html;
      } else if (match.plainLyrics) {
        lyricsContainer.innerHTML = `<div class="text-white-50 small" style="white-space: pre-line;">${match.plainLyrics}</div>`;
      } else {
        lyricsContainer.innerHTML = `<p class="text-white-50 mt-5 small">Lirik tidak tersedia.</p>`;
      }
    } else
      lyricsContainer.innerHTML = `<p class="text-white-50 mt-5 small">Lirik tidak ditemukan.</p>`;
  } catch (err) {
    lyricsContainer.innerHTML = `<p class="text-danger mt-5 small">Gagal memuat lirik.</p>`;
  }
}

audioPlayer.addEventListener('timeupdate', () => {
  const c = audioPlayer.currentTime,
    d = audioPlayer.duration;
  currentTimeDisplay.textContent = formatTime(c);
  if (d && isFinite(d)) progressFill.style.width = `${(c / d) * 100}%`;

  if (syncedLyricsData.length > 0) {
    let act = 0;
    for (let i = 0; i < syncedLyricsData.length; i++) {
      if (c >= syncedLyricsData[i].time) act = i;
      else break;
    }
    const lines = lyricsContainer.querySelectorAll('.lyric-line');
    lines.forEach((line, idx) => {
      if (idx === act) {
        if (!line.classList.contains('active')) {
          line.classList.add('active');
          line.style.color = visualizerColor;
          line.style.textShadow = `0 0 10px ${visualizerColor}`;
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        line.classList.remove('active');
        line.style.color = '';
        line.style.textShadow = '';
      }
    });
  }
});

const presets = {
  flat: { 60: 0, 230: 0, 910: 0, 3000: 0, 14000: 0 },
  bass: { 60: 8, 230: 4, 910: 0, 3000: 0, 14000: -2 },
  vocal: { 60: -2, 230: -1, 910: 5, 3000: 4, 14000: 1 },
  vshape: { 60: 6, 230: -2, 910: -3, 3000: 4, 14000: 7 },
};
eqPreset.addEventListener('change', (e) => {
  const p = presets[e.target.value];
  if (p) {
    [60, 230, 910, 3000, 14000].forEach((f) => {
      const id = f === 3000 ? '3k' : f === 14000 ? '14k' : f;
      eqSliders[id].value = p[f];
      if (isAudioInitialized) filters[f].gain.value = p[f];
    });
  }
});

Object.keys(eqSliders).forEach((key) => {
  eqSliders[key].addEventListener('input', (e) => {
    const freq = key === '3k' ? 3000 : key === '14k' ? 14000 : parseInt(key);
    if (filters[freq]) filters[freq].gain.value = parseFloat(e.target.value);
    eqPreset.value = 'custom';
  });
});

toggleEqBtn.addEventListener('click', () => {
  const hidden = eqPanel.style.display === 'none' || !eqPanel.style.display;
  eqPanel.style.display = hidden ? 'block' : 'none';
  toggleEqBtn.textContent = hidden ? '❌ Tutup EQ' : '🎛️ DSP Equalizer';
});

const colorThief = new ColorThief();
npCover.addEventListener('load', () => {
  try {
    const color = colorThief.getColor(npCover);
    if (color) {
      document.body.style.backgroundColor = `rgb(${Math.max(0, color[0] - 60)}, ${Math.max(0, color[1] - 60)}, ${Math.max(0, color[2] - 60)})`;
      visualizerColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      playPauseBtn.style.backgroundColor =
        progressFill.style.backgroundColor =
        volumeSlider.style.accentColor =
          visualizerColor;
      renderQueue();
    }
  } catch (e) {}
});

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchBtn.click();
});

searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  statusText.innerHTML = `<span class="text-warning">⏳ Mencari...</span>`;
  searchBtn.disabled = true;
  searchResultsContainer.style.display = 'none';
  resultsList.innerHTML = '';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.error || data.length === 0) {
      statusText.innerHTML = `<span class="text-danger">❌ ${data.error || 'Lagu tidak ditemukan.'}</span>`;
      return;
    }
    statusText.textContent = `Hasil untuk: ${query}`;
    data.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `<img src="${item.thumbnail}" class="result-thumb"><div class="result-info"><div class="result-title">${item.title}</div></div>`;
      div.addEventListener('click', () => {
        playQueue = data.filter((t) => t.webpage_url !== item.webpage_url);
        playSelectedTrack(item, false);
      });
      resultsList.appendChild(div);
    });
    searchResultsContainer.style.display = 'block';
    playQueue = data.slice(1);
    playSelectedTrack(data[0], false);
  } catch (e) {
    statusText.innerHTML = `<span class="text-danger">❌ Server mati.</span>`;
  } finally {
    searchBtn.disabled = false;
  }
});

async function playSelectedTrack(track) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  statusText.innerHTML = `<span class="text-info">⏳ Menghubungkan ke Audio Server...</span>`;
  searchResultsContainer.style.display = 'none';
  progressFill.style.width = '0%';
  currentTimeDisplay.textContent = '0:00';
  playPauseBtn.textContent = '▶';

  try {
    const res = await fetch(`/api/stream?url=${encodeURIComponent(track.webpage_url)}`);
    const data = await res.json();
    npCover.src = track.thumbnail;
    npTitle.textContent = track.title;

    audioPlayer.pause();
    audioPlayer.src = data.stream_url;
    audioPlayer.load();
    playerSection.style.display = 'flex';
    renderQueue();

    try {
      initAudioContext();
      if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
      await audioPlayer.play();
      statusText.textContent = 'Sedang memutar.';
    } catch (e) {
      statusText.textContent = 'Tekan tombol Play untuk memulai.';
    }
    fetchLyrics(track.title);
  } catch (e) {
    statusText.innerHTML = `<span class="text-danger">❌ Gagal terhubung ke stream.</span>`;
    setTimeout(playNextInQueue, 2000);
  }
}

// Auto-skip yang sangat berguna jika proxy stream patah/403
audioPlayer.addEventListener('error', () => {
  statusText.innerHTML = `<span class="text-danger">⚠️ Stream terputus, mengalihkan lagu...</span>`;
  setTimeout(playNextInQueue, 2500);
});
audioPlayer.addEventListener('waiting', () => {
  statusText.textContent = 'Memuat audio...';
});
audioPlayer.addEventListener('playing', () => {
  statusText.textContent = 'Sedang memutar.';
});
