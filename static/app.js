const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
const statusText = document.getElementById('statusText');
const searchResultsContainer = document.getElementById('searchResultsContainer');
const resultsList = document.getElementById('resultsList');
const emptyState = document.getElementById('emptyState');
const playerSection = document.getElementById('playerSection');
const npCover = document.getElementById('npCover');
const npTitle = document.getElementById('npTitle');
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const repeatBadge = document.getElementById('repeatBadge');
const addQueueBtn = document.getElementById('addQueueBtn');
const likeBtn = document.getElementById('likeBtn');
const progressBarWrapper = document.getElementById('progressBarWrapper');
const progressFill = document.getElementById('progressFill');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const durationDisplay = document.getElementById('durationDisplay');
const queueSection = document.getElementById('queueSection');
const queueList = document.getElementById('queueList');
const playlistList = document.getElementById('playlistList');
const customPlaylistsContainer = document.getElementById('customPlaylistsContainer');

// Overlays variables
const toggleDspBtn = document.getElementById('toggleDspBtn');
const closeDspBtn = document.getElementById('closeDspBtn');
const dspOverlay = document.getElementById('dspOverlay');
const toggleEqBtn = document.getElementById('toggleEqBtn');
const closeEqBtn = document.getElementById('closeEqBtn');
const eqOverlay = document.getElementById('eqOverlay');
const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
const closeLyricsBtn = document.getElementById('closeLyricsBtn');
const lyricsOverlay = document.getElementById('lyricsOverlay');

const eqPreset = document.getElementById('eqPreset');
const eqSliders = {
  60: document.getElementById('eq-60'),
  230: document.getElementById('eq-230'),
  910: document.getElementById('eq-910'),
  '3k': document.getElementById('eq-3k'),
  '14k': document.getElementById('eq-14k'),
};

const lyricsContainer = document.getElementById('lyricsContainer');
const openPlaylistModalBtn = document.getElementById('openPlaylistModalBtn');
const closePlaylistModalBtn = document.getElementById('closePlaylistModalBtn');
const playlistModal = document.getElementById('playlistModal');
const existingFoldersList = document.getElementById('existingFoldersList');
const playlistStatusText = document.getElementById('playlistStatusText');
const newSidebarFolderName = document.getElementById('newSidebarFolderName');
const createSidebarFolderBtn = document.getElementById('createSidebarFolderBtn');
const sidebarPlaylistStatus = document.getElementById('sidebarPlaylistStatus');
const modalNewFolderName = document.getElementById('modalNewFolderName');
const modalCreateFolderBtn = document.getElementById('modalCreateFolderBtn');
const spatialEngine = document.getElementById('spatialEngine');
const dolbyOptions = document.getElementById('dolbyOptions');
const dtsOptions = document.getElementById('dtsOptions');
const dolbyProfile = document.getElementById('dolbyProfile');
const dtsProfile = document.getElementById('dtsProfile');
const sonicRadar = document.getElementById('sonicRadar');
const iceSound = document.getElementById('iceSound');

let audioContext,
  sourceNode,
  analyser,
  filters = {},
  isAudioInitialized = false;
let dspNodes = {
  panner: null,
  compressor: null,
  iceFilter: null,
  radarFilter: null,
  outputGain: null,
};
let visualizerColor = 'rgb(29, 185, 84)';
let visualizerRunning = false;
let syncedLyricsData = [];
let playQueue = [],
  previousQueue = [];
let isSeeking = false,
  currentTrackObj = null,
  trackToAddToPlaylist = null;
let isShuffle = false,
  repeatMode = 0,
  currentRepeatCount = 0;
const LYRICS_OFFSET = -0.4;
let suggestTimeout;

toggleSidebarBtn.addEventListener('click', () => sidebar.classList.toggle('closed'));
function autoCollapseSidebar() {
  if (window.innerWidth < 992) sidebar.classList.add('closed');
}
document.addEventListener('click', (e) => {
  if (!sidebar.classList.contains('closed')) {
    if (!sidebar.contains(e.target) && !toggleSidebarBtn.contains(e.target)) {
      if (!playlistModal.classList.contains('d-none') && playlistModal.contains(e.target)) return;
      if (!searchSuggestions.contains(e.target) && e.target !== searchInput) {
        searchSuggestions.classList.add('d-none');
      }
      sidebar.classList.add('closed');
    }
  } else {
    if (!searchSuggestions.contains(e.target) && e.target !== searchInput) {
      searchSuggestions.classList.add('d-none');
    }
  }
});

function bindAccordion(element) {
  if (!element || element.dataset.bound === 'true') return;
  element.dataset.bound = 'true';
  element.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    const targetId = element.getAttribute('data-target');
    const iconId = element.getAttribute('data-icon');
    const targetEl = document.getElementById(targetId);
    const iconEl = document.getElementById(iconId);
    if (targetEl) targetEl.classList.toggle('d-none');
    if (iconEl) iconEl.classList.toggle('rotate-180');
  });
}
document.querySelectorAll('.folder-header').forEach((header) => bindAccordion(header));

// Logic Toggles for 3 Overlays
function closeAllOverlays() {
  lyricsOverlay.classList.add('d-none');
  eqOverlay.classList.add('d-none');
  dspOverlay.classList.add('d-none');
}

toggleLyricsBtn.addEventListener('click', () => {
  closeAllOverlays();
  lyricsOverlay.classList.remove('d-none');
});
closeLyricsBtn.addEventListener('click', closeAllOverlays);

toggleEqBtn.addEventListener('click', () => {
  closeAllOverlays();
  eqOverlay.classList.remove('d-none');
});
closeEqBtn.addEventListener('click', closeAllOverlays);

toggleDspBtn.addEventListener('click', () => {
  closeAllOverlays();
  dspOverlay.classList.remove('d-none');
});
closeDspBtn.addEventListener('click', closeAllOverlays);

const canvas = document.getElementById('visualizerCanvas');
const canvasCtx = canvas.getContext('2d');
function resizeCanvas() {
  const container = canvas.parentElement;
  if (container) {
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
  }
}
window.addEventListener('resize', resizeCanvas);

function createListItem(
  track,
  isQueue = false,
  showAddBtn = true,
  timeStr = null,
  deleteCallback = null,
) {
  const div = document.createElement('div');
  div.className = `list-item shadow-sm ${isQueue ? 'list-item-queued' : ''}`;
  if (isQueue) div.style.borderLeftColor = visualizerColor;
  let btnHtml = '';
  if (showAddBtn) {
    btnHtml = `<button class="add-playlist-icon-btn" title="Simpan ke Folder Playlist"><i class="bi bi-folder-plus"></i></button>
               <button class="add-queue-icon-btn" title="Tambahkan ke Antrean"><i class="bi bi-plus-lg"></i></button>`;
  }
  let extraHtml = '';
  if (timeStr) extraHtml += `<div class="time-badge ms-1">${timeStr}</div>`;
  if (deleteCallback) {
    extraHtml += `<button class="btn btn-link text-danger p-0 ms-2 delete-track-btn" title="Hapus"><i class="bi bi-x-lg"></i></button>`;
  } else if (!isQueue) {
    extraHtml += `<i class="bi bi-play-fill item-play-icon"></i>`;
  }
  div.innerHTML = `<img src="${track.thumbnail}" class="item-thumb"><div class="item-title">${track.title}</div>${btnHtml}${extraHtml}`;

  if (showAddBtn) {
    const qBtn = div.querySelector('.add-queue-icon-btn');
    qBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playQueue.push(track);
      renderQueue();
      qBtn.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
      setTimeout(() => {
        qBtn.innerHTML = '<i class="bi bi-plus-lg"></i>';
      }, 1000);
    });
    const pBtn = div.querySelector('.add-playlist-icon-btn');
    pBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      trackToAddToPlaylist = track;
      playlistModal.classList.remove('d-none');
      renderExistingFoldersInModal();
    });
  }
  if (deleteCallback) {
    div.querySelector('.delete-track-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCallback();
    });
  }
  return div;
}

function playFolderTracks(tracks, shuffle = false) {
  if (!tracks || tracks.length === 0) {
    statusText.innerHTML = `<i class="bi bi-x-circle text-danger fs-5"></i> Folder Kosong`;
    setTimeout(() => {
      statusText.innerHTML = '';
    }, 1500);
    return;
  }
  let queue = [...tracks];
  if (shuffle) {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    isShuffle = true;
    shuffleBtn.classList.add('active');
  } else {
    isShuffle = false;
    shuffleBtn.classList.remove('active');
  }
  const firstTrack = queue.shift();
  playQueue = queue;
  playSelectedTrack(firstTrack, false);
}

document
  .getElementById('playAllLikedBtn')
  .addEventListener('click', () => playFolderTracks(getLikedSongs(), false));
document
  .getElementById('shuffleAllLikedBtn')
  .addEventListener('click', () => playFolderTracks(getLikedSongs(), true));
document
  .getElementById('playAllQueueBtn')
  .addEventListener('click', () => playFolderTracks(playQueue, false));
document
  .getElementById('shuffleAllQueueBtn')
  .addEventListener('click', () => playFolderTracks(playQueue, true));

function renderQueue() {
  queueList.innerHTML = '';
  if (playQueue.length === 0) {
    queueList.innerHTML = '<div class="text-white-50 small px-2">Antrean kosong</div>';
    nextTrackBtn.style.opacity = '0.4';
    return;
  }
  nextTrackBtn.style.opacity = '1';
  playQueue.forEach((track, index) => {
    const item = createListItem(track, true, false, null, () => {
      playQueue.splice(index, 1);
      renderQueue();
    });
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      playQueue = playQueue.slice(index + 1);
      playSelectedTrack(track, false);
    });
    queueList.appendChild(item);
  });
}

function playNextInQueue() {
  if (playQueue.length > 0) {
    let nextTrack;
    if (isShuffle) {
      const randIdx = Math.floor(Math.random() * playQueue.length);
      nextTrack = playQueue.splice(randIdx, 1)[0];
    } else {
      nextTrack = playQueue.shift();
    }
    if (repeatMode === 4 && currentTrackObj) playQueue.push(currentTrackObj);
    playSelectedTrack(nextTrack, false);
  } else {
    if (repeatMode === 4 && currentTrackObj) {
      playSelectedTrack(currentTrackObj, false);
    } else {
      statusText.innerHTML = '';
      playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
    }
  }
}

function getCustomPlaylists() {
  return JSON.parse(localStorage.getItem('dazo_custom_playlists')) || {};
}
function saveCustomPlaylists(data) {
  localStorage.setItem('dazo_custom_playlists', JSON.stringify(data));
}

function renderSidebarCustomPlaylists() {
  customPlaylistsContainer.innerHTML = '';
  const playlists = getCustomPlaylists();
  for (let folderName in playlists) {
    const folderId =
      'folder-' +
      folderName.replace(/\s+/g, '-').toLowerCase() +
      '-' +
      Math.random().toString(36).substr(2, 5);
    const folderHtml = `
      <div class="sidebar-folder mb-3 border border-secondary border-opacity-25 rounded p-2">
        <div class="folder-header d-flex justify-content-between align-items-center mb-2" data-target="${folderId}" data-icon="icon-${folderId}">
          <h6 class="section-title mb-0 text-warning"><i class="bi bi-folder-fill me-2"></i> <span class="folder-title-text">${folderName}</span></h6>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-link p-0 text-info rename-folder-btn" data-folder="${folderName}" title="Ganti Nama"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-link p-0 text-danger delete-folder-btn" data-folder="${folderName}" title="Hapus Folder"><i class="bi bi-trash"></i></button>
            <i id="icon-${folderId}" class="bi bi-chevron-down text-white-50 transition-icon"></i>
          </div>
        </div>
        <div id="${folderId}" class="folder-content d-none">
          <div class="d-flex gap-2 mb-3">
            <button class="btn folder-action-btn play-folder-btn flex-grow-1"><i class="bi bi-play-fill me-1"></i> Urut</button>
            <button class="btn folder-action-btn shuffle-folder-btn flex-grow-1"><i class="bi bi-shuffle me-1"></i> Acak</button>
          </div>
          <div class="d-flex flex-column gap-2 folder-list-container"></div>
        </div>
      </div>
    `;
    customPlaylistsContainer.insertAdjacentHTML('beforeend', folderHtml);
    const wrapperElement = customPlaylistsContainer.lastElementChild;
    bindAccordion(wrapperElement.querySelector('.folder-header'));

    wrapperElement.querySelector('.play-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playFolderTracks(playlists[folderName], false);
    });
    wrapperElement.querySelector('.shuffle-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playFolderTracks(playlists[folderName], true);
    });

    wrapperElement.querySelector('.rename-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = prompt('Masukkan nama folder baru:', folderName);
      if (newName && newName.trim() !== '' && newName !== folderName) {
        let p = getCustomPlaylists();
        if (p[newName]) {
          alert('Nama folder sudah ada!');
          return;
        }
        p[newName] = p[folderName];
        delete p[folderName];
        saveCustomPlaylists(p);
        renderSidebarCustomPlaylists();
      }
    });

    wrapperElement.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Hapus folder "${folderName}" beserta isinya?`)) {
        let p = getCustomPlaylists();
        delete p[folderName];
        saveCustomPlaylists(p);
        renderSidebarCustomPlaylists();
      }
    });

    const listContainer = wrapperElement.querySelector('.folder-list-container');
    if (playlists[folderName].length === 0) {
      listContainer.innerHTML = '<div class="text-white-50 small px-2">Folder kosong</div>';
    } else {
      playlists[folderName].forEach((track, index) => {
        const item = createListItem(track, false, true, null, () => {
          playlists[folderName].splice(index, 1);
          saveCustomPlaylists(playlists);
          renderSidebarCustomPlaylists();
        });
        item.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          playSelectedTrack(track, false);
        });
        listContainer.appendChild(item);
      });
    }
  }
}

createSidebarFolderBtn.addEventListener('click', () => {
  const name = newSidebarFolderName.value.trim();
  if (!name) return;
  let p = getCustomPlaylists();
  if (p[name]) {
    sidebarPlaylistStatus.textContent = 'Nama folder sudah ada!';
    return;
  }
  p[name] = [];
  saveCustomPlaylists(p);
  newSidebarFolderName.value = '';
  sidebarPlaylistStatus.innerHTML = `<span class="text-success"><i class="bi bi-check-lg"></i> Dibuat</span>`;
  setTimeout(() => {
    sidebarPlaylistStatus.textContent = '';
  }, 2000);
  renderSidebarCustomPlaylists();
});

modalCreateFolderBtn.addEventListener('click', () => {
  const name = modalNewFolderName.value.trim();
  if (!name) return;
  let p = getCustomPlaylists();
  if (p[name]) {
    playlistStatusText.textContent = 'Folder sudah ada!';
    return;
  }
  p[name] = [];
  saveCustomPlaylists(p);
  modalNewFolderName.value = '';
  playlistStatusText.innerHTML = `<span class="text-success"><i class="bi bi-check-lg"></i> Folder ${name} dibuat</span>`;
  setTimeout(() => {
    playlistStatusText.textContent = '';
  }, 2000);
  renderSidebarCustomPlaylists();
  renderExistingFoldersInModal();
});

openPlaylistModalBtn.addEventListener('click', () => {
  if (!currentTrackObj) return;
  trackToAddToPlaylist = currentTrackObj;
  playlistModal.classList.remove('d-none');
  renderExistingFoldersInModal();
});
closePlaylistModalBtn.addEventListener('click', () => {
  playlistModal.classList.add('d-none');
  playlistStatusText.textContent = '';
  trackToAddToPlaylist = null;
});

function renderExistingFoldersInModal() {
  existingFoldersList.innerHTML = '';
  const playlists = getCustomPlaylists();
  if (Object.keys(playlists).length === 0) {
    existingFoldersList.innerHTML =
      '<div class="text-white-50 small text-center my-3">Belum ada folder.</div>';
    return;
  }
  for (let folderName in playlists) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary w-100 text-start text-white border-secondary mb-1';
    btn.innerHTML = `<i class="bi bi-folder me-2"></i> ${folderName}`;
    btn.addEventListener('click', () => {
      addTrackToFolder(folderName);
    });
    existingFoldersList.appendChild(btn);
  }
}

function addTrackToFolder(folderName) {
  if (!trackToAddToPlaylist) return;
  let p = getCustomPlaylists();
  if (p[folderName]) {
    const exists = p[folderName].some((t) => t.webpage_url === trackToAddToPlaylist.webpage_url);
    if (!exists) {
      p[folderName].unshift(trackToAddToPlaylist);
      saveCustomPlaylists(p);
      renderSidebarCustomPlaylists();
      playlistStatusText.innerHTML = `<span class="text-success"><i class="bi bi-check-lg"></i> Tersimpan di ${folderName}</span>`;
      setTimeout(() => {
        playlistModal.classList.add('d-none');
        playlistStatusText.textContent = '';
        trackToAddToPlaylist = null;
      }, 1500);
    } else {
      playlistStatusText.innerHTML = `Lagu sudah ada di folder ini`;
    }
  }
}

addQueueBtn.addEventListener('click', () => {
  if (currentTrackObj) {
    playQueue.push(currentTrackObj);
    renderQueue();
    const origText = addQueueBtn.innerHTML;
    addQueueBtn.innerHTML = '<i class="bi bi-check-lg"></i> Ditambahkan';
    setTimeout(() => {
      addQueueBtn.innerHTML = origText;
    }, 1500);
  }
});

function getLikedSongs() {
  return JSON.parse(localStorage.getItem('dazo_liked')) || [];
}
function renderPlaylist() {
  const liked = getLikedSongs();
  playlistList.innerHTML = '';
  if (liked.length === 0) {
    playlistList.innerHTML = '<div class="text-white-50 small px-2">Belum ada lagu disukai</div>';
    return;
  }
  liked.forEach((track, index) => {
    const item = createListItem(track, false, true, null, () => {
      liked.splice(index, 1);
      localStorage.setItem('dazo_liked', JSON.stringify(liked));
      checkLikedStatus();
      renderPlaylist();
    });
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      playSelectedTrack(track, false);
    });
    playlistList.appendChild(item);
  });
}
function toggleLike() {
  if (!currentTrackObj) return;
  let liked = getLikedSongs();
  const exists = liked.findIndex((t) => t.webpage_url === currentTrackObj.webpage_url);
  if (exists >= 0) {
    liked.splice(exists, 1);
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = '<i class="bi bi-heart"></i>';
  } else {
    liked.unshift(currentTrackObj);
    likeBtn.classList.add('liked');
    likeBtn.innerHTML = '<i class="bi bi-heart-fill"></i>';
  }
  localStorage.setItem('dazo_liked', JSON.stringify(liked));
  renderPlaylist();
}
function checkLikedStatus() {
  if (!currentTrackObj) return;
  const isLiked = getLikedSongs().some((t) => t.webpage_url === currentTrackObj.webpage_url);
  if (isLiked) {
    likeBtn.classList.add('liked');
    likeBtn.innerHTML = '<i class="bi bi-heart-fill"></i>';
  } else {
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = '<i class="bi bi-heart"></i>';
  }
}
likeBtn.addEventListener('click', toggleLike);

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
});
repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 5;
  currentRepeatCount = 0;
  repeatBtn.classList.toggle('active', repeatMode > 0);
  if (repeatMode === 0) {
    repeatBadge.classList.add('d-none');
    repeatBtn.innerHTML = '<i class="bi bi-repeat"></i>';
  } else if (repeatMode >= 1 && repeatMode <= 3) {
    repeatBadge.classList.remove('d-none');
    repeatBadge.textContent = repeatMode;
    repeatBtn.innerHTML =
      '<i class="bi bi-repeat-1"></i><span id="repeatBadge" class="repeat-badge">' +
      repeatMode +
      '</span>';
  } else if (repeatMode === 4) {
    repeatBadge.classList.add('d-none');
    repeatBtn.innerHTML = '<i class="bi bi-repeat"></i>';
  }
});

audioPlayer.addEventListener('ended', () => {
  if (repeatMode >= 1 && repeatMode <= 3) {
    if (currentRepeatCount < repeatMode) {
      currentRepeatCount++;
      audioPlayer.currentTime = 0;
      audioPlayer.play();
      return;
    } else {
      currentRepeatCount = 0;
    }
  }
  playNextInQueue();
});
nextTrackBtn.addEventListener('click', () => {
  currentRepeatCount = 0;
  if (playQueue.length > 0) playNextInQueue();
});
prevTrackBtn.addEventListener('click', () => {
  if (audioPlayer.currentTime > 4 || previousQueue.length === 0) {
    audioPlayer.currentTime = 0;
  } else {
    const prev = previousQueue.pop();
    if (currentTrackObj) playQueue.unshift(currentTrackObj);
    playSelectedTrack(prev, false, true);
  }
});

function formatTime(s) {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}
playPauseBtn.addEventListener('click', async () => {
  try {
    initAudioContext();
    if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
    if (audioPlayer.paused) {
      await audioPlayer.play();
    } else {
      audioPlayer.pause();
    }
  } catch (error) {
    console.error('Gagal menginisialisasi audio:', error);
    if (statusText) statusText.textContent = 'Audio tidak dapat dimulai. Coba tekan putar lagi.';
  }
});
audioPlayer.addEventListener(
  'play',
  () => (playPauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>'),
);
audioPlayer.addEventListener(
  'pause',
  () => (playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>'),
);
audioPlayer.addEventListener('loadedmetadata', () => {
  durationDisplay.textContent = formatTime(audioPlayer.duration);
});

progressBarWrapper.addEventListener('mousedown', (e) => {
  isSeeking = true;
  updateProgress(e);
});
window.addEventListener('mouseup', () => {
  isSeeking = false;
});
window.addEventListener('mousemove', (e) => {
  if (isSeeking) updateProgress(e);
});
function updateProgress(e) {
  const rect = progressBarWrapper.getBoundingClientRect();
  let perc = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (audioPlayer.duration) {
    audioPlayer.currentTime = perc * audioPlayer.duration;
    progressFill.style.width = `${perc * 100}%`;
  }
}

function initAudioContext() {
  if (isAudioInitialized) return;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Browser ini tidak mendukung Web Audio API.');
  }

  audioContext = new AudioContextCtor();
  sourceNode = audioContext.createMediaElementSource(audioPlayer);

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -18;

  let prevNode = sourceNode;

  [60, 230, 910, 3000, 14000].forEach((freq, i) => {
    const filter = audioContext.createBiquadFilter();
    filter.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
    filter.frequency.value = Math.min(freq, audioContext.sampleRate * 0.45);
    filter.gain.value = Number(
      eqSliders[freq === 3000 ? '3k' : freq === 14000 ? '14k' : freq]?.value || 0,
    );
    if (filter.type === 'peaking') filter.Q.value = 1.0;
    prevNode.connect(filter);
    prevNode = filter;
    filters[freq] = filter;
  });

  dspNodes.panner = audioContext.createStereoPanner();
  dspNodes.panner.pan.value = 0;
  prevNode.connect(dspNodes.panner);
  prevNode = dspNodes.panner;

  dspNodes.iceFilter = audioContext.createBiquadFilter();
  dspNodes.iceFilter.type = 'highshelf';
  dspNodes.iceFilter.frequency.value = Math.min(10000, audioContext.sampleRate * 0.45);
  dspNodes.iceFilter.gain.value = 0;
  prevNode.connect(dspNodes.iceFilter);
  prevNode = dspNodes.iceFilter;

  dspNodes.radarFilter = audioContext.createBiquadFilter();
  dspNodes.radarFilter.type = 'peaking';
  dspNodes.radarFilter.frequency.value = Math.min(2500, audioContext.sampleRate * 0.4);
  dspNodes.radarFilter.Q.value = 1.2;
  dspNodes.radarFilter.gain.value = 0;
  prevNode.connect(dspNodes.radarFilter);
  prevNode = dspNodes.radarFilter;

  dspNodes.compressor = audioContext.createDynamicsCompressor();
  dspNodes.compressor.threshold.value = -6;
  dspNodes.compressor.knee.value = 8;
  dspNodes.compressor.ratio.value = 2;
  dspNodes.compressor.attack.value = 0.006;
  dspNodes.compressor.release.value = 0.18;
  prevNode.connect(dspNodes.compressor);
  prevNode = dspNodes.compressor;

  dspNodes.outputGain = audioContext.createGain();
  dspNodes.outputGain.gain.value = 0.82;
  prevNode.connect(dspNodes.outputGain);
  dspNodes.outputGain.connect(analyser);
  analyser.connect(audioContext.destination);

  isAudioInitialized = true;
  applyAdvancedDSP();
  resizeCanvas();
  if (!visualizerRunning) {
    visualizerRunning = true;
    requestAnimationFrame(drawVisualizer);
  }
}

function setAudioParam(param, value, timeConstant = 0.025) {
  if (!param || !audioContext) return;
  const now = audioContext.currentTime;
  try {
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, timeConstant);
  } catch (_) {
    param.value = value;
  }
}

function applyAdvancedDSP() {
  if (!isAudioInitialized || !dspNodes.compressor) return;

  const engine = spatialEngine?.value || 'off';
  const now = audioContext.currentTime;

  setAudioParam(dspNodes.panner.pan, 0);
  setAudioParam(dspNodes.iceFilter.gain, iceSound?.checked ? 2.5 : 0);
  setAudioParam(dspNodes.radarFilter.gain, sonicRadar?.checked ? 2.0 : 0);

  let threshold = -6;
  let ratio = 2;
  let knee = 8;
  let attack = 0.006;
  let release = 0.18;

  if (engine === 'dolby') {
    const profile = dolbyProfile?.value || 'premium';
    threshold = -9;
    ratio = profile === 'cinema5' || profile === 'xfi5' ? 3.2 : 2.2;
    knee = 12;
    attack = 0.012;
    release = 0.24;
  } else if (engine === 'dts') {
    const profile = dtsProfile?.value || 'studio';
    threshold = -8;
    ratio = profile === 'dtsx' || profile === 'unbound' ? 3.5 : 2.6;
    knee = 8;
    attack = 0.004;
    release = 0.16;
  }

  setAudioParam(dspNodes.compressor.threshold, threshold);
  setAudioParam(dspNodes.compressor.ratio, ratio);
  setAudioParam(dspNodes.compressor.knee, knee);
  setAudioParam(dspNodes.compressor.attack, attack);
  setAudioParam(dspNodes.compressor.release, release);
  void now;
}

function resizeCanvas() {
  if (!canvas || !canvasCtx) return;
  const container = canvas.parentElement;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas, { passive: true });

function drawVisualizer() {
  if (!visualizerRunning || !canvas || !canvasCtx) return;
  requestAnimationFrame(drawVisualizer);

  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvasCtx.clearRect(0, 0, width, height);
  if (!analyser || !width || !height) return;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  const barCount = Math.max(20, Math.min(72, Math.floor(width / 7)));
  const gap = Math.max(1, Math.min(3, width / (barCount * 12)));
  const barWidth = Math.max(1, (width - gap * (barCount - 1)) / barCount);
  const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, visualizerColor);
  gradient.addColorStop(0.65, '#8be9a5');
  gradient.addColorStop(1, '#e7fff0');
  canvasCtx.fillStyle = gradient;

  for (let i = 0; i < barCount; i++) {
    const start = Math.floor(Math.pow(i / barCount, 2.15) * (data.length - 1));
    const end = Math.max(
      start + 1,
      Math.floor(Math.pow((i + 1) / barCount, 2.15) * (data.length - 1)),
    );
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    const magnitude = sum / (end - start) / 255;
    const barHeight = Math.max(2, Math.pow(magnitude, 1.25) * height * 0.96);
    const x = i * (barWidth + gap);
    const radius = Math.min(3, barWidth / 2, barHeight / 2);
    canvasCtx.beginPath();
    if (canvasCtx.roundRect) {
      canvasCtx.roundRect(x, height - barHeight, barWidth, barHeight, radius);
      canvasCtx.fill();
    } else {
      canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
    }
  }
}

const presets = {
  flat: { 60: 0, 230: 0, 910: 0, 3000: 0, 14000: 0 },
  bass: { 60: 8, 230: 4, 910: 0, 3000: 0, 14000: -2 },
  vocal: { 60: -2, 230: -1, 910: 5, 3000: 4, 14000: 1 },
  vshape: { 60: 6, 230: -2, 910: -3, 3000: 4, 14000: 7 },
};
eqPreset.addEventListener('change', (e) => {
  const p = presets[e.target.value];
  if (!p) return;
  [60, 230, 910, 3000, 14000].forEach((freq) => {
    const id = freq === 3000 ? '3k' : freq === 14000 ? '14k' : freq;
    const slider = eqSliders[id];
    if (!slider) return;
    slider.value = p[freq];
    if (filters[freq]) setAudioParam(filters[freq].gain, Number(p[freq]));
  });
});
Object.keys(eqSliders).forEach((key) => {
  const slider = eqSliders[key];
  if (!slider) return;
  slider.addEventListener('input', (e) => {
    const freq = key === '3k' ? 3000 : key === '14k' ? 14000 : parseInt(key, 10);
    if (filters[freq]) setAudioParam(filters[freq].gain, Number(e.target.value));
    eqPreset.value = 'custom';
  });
});

spatialEngine.addEventListener('change', (e) => {
  dolbyOptions.classList.toggle('d-none', e.target.value !== 'dolby');
  dtsOptions.classList.toggle('d-none', e.target.value !== 'dts');
  applyAdvancedDSP();
});
[dolbyProfile, dtsProfile, sonicRadar, iceSound].forEach((el) => {
  if (el) el.addEventListener('change', applyAdvancedDSP);
});

async function fetchLyrics(rawTitle, durationSec) {
  lyricsContainer.innerHTML = `<div class="h-100 d-flex align-items-center justify-content-center"><p class="text-white-50 fs-5 mb-0">Mencari sinkronisasi lyric...</p></div>`;
  syncedLyricsData = [];
  try {
    const clean = rawTitle
      .replace(/.*?|⟨.*?⟩|［.*?］|【.*?】|ft\.?|feat\.?.*/gi, '')
      .replace(/official|music video|lyric video|HD|HQ|4K|audio/gi, '')
      .trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      let bestMatch = data[0];
      if (durationSec > 0) {
        let minDiff = Infinity;
        data.forEach((item) => {
          if (item.syncedLyrics && item.duration) {
            const diff = Math.abs(item.duration - durationSec);
            if (diff < minDiff) {
              minDiff = diff;
              bestMatch = item;
            }
          }
        });
      }
      if (bestMatch.syncedLyrics) {
        let html = '';
        bestMatch.syncedLyrics.split('\n').forEach((line, idx) => {
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
        lyricsContainer.innerHTML = `<div style="height: 35vh;"></div>${html}<div style="height: 35vh;"></div>`;
      } else if (bestMatch.plainLyrics) {
        lyricsContainer.innerHTML = `<div class="py-5 text-white-50" style="white-space: pre-line; font-size: 1.1rem; line-height: 2;">${bestMatch.plainLyrics}</div>`;
      } else {
        lyricsContainer.innerHTML = `<div class="h-100 d-flex align-items-center justify-content-center"><p class="text-white-50 fs-5 mb-0">Lyric tidak tersedia.</p></div>`;
      }
    } else
      lyricsContainer.innerHTML = `<div class="h-100 d-flex align-items-center justify-content-center"><p class="text-white-50 fs-5 mb-0">Lyric tidak ditemukan.</p></div>`;
  } catch (err) {
    lyricsContainer.innerHTML = `<div class="h-100 d-flex align-items-center justify-content-center"><p class="text-danger fs-5 mb-0">Gagal memuat Lyric.</p></div>`;
  }
}

audioPlayer.addEventListener('timeupdate', () => {
  if (isSeeking) return;
  const c = audioPlayer.currentTime,
    d = audioPlayer.duration;
  currentTimeDisplay.textContent = formatTime(c);
  if (d && isFinite(d)) progressFill.style.width = `${(c / d) * 100}%`;

  if (syncedLyricsData.length > 0 && !lyricsOverlay.classList.contains('d-none')) {
    let act = -1;
    for (let i = 0; i < syncedLyricsData.length; i++) {
      if (c >= syncedLyricsData[i].time + LYRICS_OFFSET) act = i;
      else break;
    }
    const lines = lyricsContainer.querySelectorAll('.lyric-line');
    lines.forEach((line, idx) => {
      if (idx === act) {
        if (!line.classList.contains('active')) {
          line.classList.add('active');
          line.style.color = '#ffffff';
          line.style.textShadow = `0 0 15px ${visualizerColor}`;
          const offsetTop =
            line.offsetTop - lyricsContainer.clientHeight / 2 + line.clientHeight / 2;
          lyricsContainer.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      } else {
        line.classList.remove('active');
        line.style.color = 'rgba(255, 255, 255, 0.4)';
        line.style.textShadow = 'none';
      }
    });
  }
});

const colorThief = new ColorThief();
npCover.addEventListener('load', () => {
  document.getElementById('appBg').style.backgroundImage = `url(${npCover.src})`;
  try {
    const color = colorThief.getColor(npCover);
    if (color) {
      visualizerColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      playPauseBtn.style.backgroundColor = progressFill.style.backgroundColor = visualizerColor;
      renderQueue();
    }
  } catch (e) {}
});

function getHistory() {
  return JSON.parse(localStorage.getItem('dazo_history')) || [];
}
function addToHistory(track) {
  let history = getHistory().filter((item) => item.webpage_url !== track.webpage_url);
  const newRecord = { ...track, timestamp: Date.now() };
  history.unshift(newRecord);
  if (history.length > 1000) history.pop();
  localStorage.setItem('dazo_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = '<div class="text-white-50 small px-2">Riwayat kosong</div>';
    return;
  }
  const grouped = {};
  history.forEach((track) => {
    const d = new Date(track.timestamp || Date.now());
    const dayKey = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeKey = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push({ ...track, timePlayed: timeKey });
  });

  let isFirstDay = true;
  for (let day in grouped) {
    const dayId = 'history-day-' + Math.random().toString(36).substr(2, 5);
    const dayDiv = document.createElement('div');
    dayDiv.className = 'sidebar-folder mb-2 border border-secondary border-opacity-25 rounded p-2';
    dayDiv.innerHTML = `
      <div class="folder-header d-flex justify-content-between align-items-center" data-target="${dayId}" data-icon="icon-${dayId}">
        <h6 class="section-title mb-0 text-white-50" style="text-transform:none; font-size:0.8rem;"><i class="bi bi-calendar-event me-2"></i>${day}</h6>
        <i id="icon-${dayId}" class="bi bi-chevron-down text-white-50 transition-icon ${isFirstDay ? 'rotate-180' : ''}"></i>
      </div>
      <div id="${dayId}" class="folder-content d-flex flex-column gap-2 mt-2 ${isFirstDay ? '' : 'd-none'}"></div>
    `;
    const tracksContainer = dayDiv.querySelector(`#${dayId}`);
    bindAccordion(dayDiv.querySelector('.folder-header'));

    grouped[day].forEach((track) => {
      const item = createListItem(track, false, true, track.timePlayed, null);

      item.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        playSelectedTrack(track, true);
      });
      tracksContainer.appendChild(item);
    });
    historyList.appendChild(dayDiv);
    isFirstDay = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  renderPlaylist();
  renderSidebarCustomPlaylists();
});

// --- SISTEM AUTOCOMPLETE PENCARIAN (VIA YOUTUBE API JSONP) ---
searchInput.addEventListener('input', (e) => {
  clearTimeout(suggestTimeout);
  const query = e.target.value.trim();
  if (!query) {
    searchSuggestions.classList.add('d-none');
    return;
  }
  suggestTimeout = setTimeout(() => {
    fetchSuggestions(query);
  }, 250);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchSuggestions.classList.add('d-none');
    searchBtn.click();
  }
});

function fetchSuggestions(query) {
  const script = document.createElement('script');
  window.ytSuggestCallback = function (data) {
    renderSuggestions(data[1]);
    document.head.removeChild(script);
    delete window.ytSuggestCallback;
  };
  script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&callback=ytSuggestCallback`;
  document.head.appendChild(script);
}

function renderSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    searchSuggestions.classList.add('d-none');
    return;
  }
  searchSuggestions.innerHTML = '';
  suggestions.forEach((s) => {
    const text = s[0];
    const div = document.createElement('div');
    div.className = 'suggestion-item fw-bold';
    div.innerHTML = `<i class="bi bi-search me-3 text-white-50"></i> ${text}`;
    div.addEventListener('click', () => {
      searchInput.value = text;
      searchSuggestions.classList.add('d-none');
      searchBtn.click();
    });
    searchSuggestions.appendChild(div);
  });
  searchSuggestions.classList.remove('d-none');
}

searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  statusText.innerHTML = `<div class="spinner-border spinner-border-sm text-success" role="status"></div>`;
  searchBtn.disabled = true;
  searchResultsContainer.classList.add('d-none');
  resultsList.innerHTML = '';
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.error || data.length === 0) {
      statusText.innerHTML = `<i class="bi bi-exclamation-circle text-warning fs-5"></i>`;
      return;
    }
    statusText.innerHTML = ``;
    data.forEach((item) => {
      const div = createListItem(item, false, true);
      div.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        playSelectedTrack(item, false);
      });
      resultsList.appendChild(div);
    });
    searchResultsContainer.classList.remove('d-none');
  } catch (e) {
    statusText.innerHTML = `<i class="bi bi-x-circle text-danger fs-5"></i>`;
  } finally {
    searchBtn.disabled = false;
  }
});

async function playSelectedTrack(track, isHistoryClick = false, isPrevClick = false) {
  statusText.innerHTML = `<div class="spinner-grow spinner-grow-sm text-primary" role="status"></div>`;
  emptyState.classList.add('d-none');
  playerSection.classList.remove('d-none');
  autoCollapseSidebar();

  if (!isPrevClick && currentTrackObj) {
    if (
      previousQueue.length === 0 ||
      previousQueue[previousQueue.length - 1].webpage_url !== currentTrackObj.webpage_url
    ) {
      previousQueue.push(currentTrackObj);
    }
  }

  currentTrackObj = track;
  checkLikedStatus();
  currentRepeatCount = 0;

  autoQueueRelatedTracks(track.title);

  progressFill.style.width = '0%';
  currentTimeDisplay.textContent = '0:00';
  playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';

  try {
    const res = await fetch(`/api/stream?url=${encodeURIComponent(track.webpage_url)}`);
    const data = await res.json();
    npCover.src = track.thumbnail;
    npTitle.textContent = track.title;

    audioPlayer.pause();
    audioPlayer.src = data.stream_url;
    audioPlayer.load();
    addToHistory(track);
    renderQueue();

    try {
      initAudioContext();
      if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
      await audioPlayer.play();
      statusText.innerHTML = '';
      setTimeout(resizeCanvas, 300);
      fetchLyrics(track.title, track.duration || 0);
    } catch (e) {
      console.error('Audio start gagal:', e);
      statusText.textContent = 'Gagal memulai audio. Periksa koneksi lalu tekan putar kembali.';
      fetchLyrics(track.title, track.duration || 0);
    }
  } catch (e) {
    statusText.innerHTML = `<i class="bi bi-dash-circle text-danger fs-5" title="Gagal"></i>`;
    setTimeout(playNextInQueue, 2000);
  }
}

audioPlayer.addEventListener('error', () => {
  setTimeout(playNextInQueue, 2500);
});

// --- SMART DSP PRESET MANAGER DENGAN CARD LAYOUT ---
const dspCardBtns = document.querySelectorAll('.dsp-card-btn');

dspCardBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    dspCardBtns.forEach((b) => b.classList.remove('active'));
    const targetBtn = e.currentTarget;
    targetBtn.classList.add('active');

    applySmartDSP(targetBtn.getAttribute('data-mode'));
  });
});

function applySmartDSP(mode) {
  if (mode === 'pure') {
    spatialEngine.value = 'off';
    eqPreset.value = 'flat';
    sonicRadar.checked = false;
    iceSound.checked = false;
  } else if (mode === 'gaming') {
    spatialEngine.value = 'dts';
    dtsProfile.value = 'dtsx';
    eqPreset.value = 'vshape';
    sonicRadar.checked = true;
    iceSound.checked = false;
  } else if (mode === 'movie') {
    spatialEngine.value = 'dolby';
    dolbyProfile.value = 'atmos';
    eqPreset.value = 'bass';
    sonicRadar.checked = false;
    iceSound.checked = true;
  }

  eqPreset.dispatchEvent(new Event('change'));
  spatialEngine.dispatchEvent(new Event('change'));

  statusText.innerHTML = `<i class="bi bi-check2-circle text-success fs-5"></i> <span class="ms-2">Profil Diterapkan</span>`;
  setTimeout(() => {
    statusText.innerHTML = '';
  }, 1500);
}

// --- LOGIKA AUTO-QUEUE BERDASARKAN ARTIS/GENRE ---
async function autoQueueRelatedTracks(title) {
  if (playQueue.length >= 3) return;

  try {
    let keyword = title
      .split('-')[0]
      .replace(/official|music video|lyric video|audio|hd/gi, '')
      .trim();
    if (!keyword || keyword.length < 3) keyword = title.split(' ').slice(0, 2).join(' ');

    const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();

    if (data && !data.error && data.length > 0) {
      let related = data.filter((t) => t.webpage_url !== currentTrackObj.webpage_url);
      let toAdd = related.slice(0, 4);
      toAdd.forEach((t) => {
        if (!playQueue.some((q) => q.webpage_url === t.webpage_url)) {
          playQueue.push(t);
        }
      });
      renderQueue();
    }
  } catch (err) {
    console.error('Gagal memuat auto-queue:', err);
  }
}
