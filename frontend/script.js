const API_BASE_URL = ''; 

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const sectionTitle = document.getElementById('section-title');

const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const volumeBar = document.getElementById('volumeBar');
const playerImage = document.getElementById('player-image');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');

const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const mobileOverlay = document.getElementById('mobileOverlay');

const newAlbumInput = document.getElementById('newAlbumInput');
const createAlbumBtn = document.getElementById('createAlbumBtn');
const userAlbumsList = document.getElementById('userAlbumsList');
const albumModal = document.getElementById('albumModal');
const modalAlbumList = document.getElementById('modalAlbumList');
const closeModal = document.querySelector('.close-modal');

// Global State
const audioPlayer = new Audio();
let isPlaying = false;
let songToAdd = null; 
let currentPlaylist = [];
let currentIndex = -1;
let activeViewContext = null;

// Mobile Menu
function openMobileMenu() { sidebar.classList.add('active'); mobileOverlay.classList.add('active'); }
function closeMobileMenu() { sidebar.classList.remove('active'); mobileOverlay.classList.remove('active'); }
menuToggle.addEventListener('click', openMobileMenu);
closeMenuBtn.addEventListener('click', closeMobileMenu);
mobileOverlay.addEventListener('click', closeMobileMenu);

// Local Storage & Albums
let userAlbums = JSON.parse(localStorage.getItem('spoticlone_albums')) || {};

function saveAlbums() {
    localStorage.setItem('spoticlone_albums', JSON.stringify(userAlbums));
    renderSidebarAlbums();
}

function renderSidebarAlbums() {
    userAlbumsList.innerHTML = '';
    const albumNames = Object.keys(userAlbums);
    
    if (albumNames.length === 0) {
        userAlbumsList.innerHTML = '<li style="color: #555; padding-left: 10px;">No albums yet</li>';
        return;
    }

    albumNames.forEach(name => {
        const li = document.createElement('li');
        li.className = 'album-list-item';
        
        const textSpan = document.createElement('span');
        textSpan.innerHTML = `<i class="fas fa-music"></i> ${name}`;
        textSpan.style.cursor = 'pointer';
        textSpan.onclick = () => loadAlbumView(name);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-album-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = "Delete Album";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm(`Delete the album "${name}"?`)) {
                delete userAlbums[name];
                saveAlbums();
                if(activeViewContext === name) clearSearch();
            }
        };

        li.appendChild(textSpan);
        li.appendChild(deleteBtn);
        userAlbumsList.appendChild(li);
    });
}

createAlbumBtn.addEventListener('click', () => {
    const name = newAlbumInput.value.trim();
    if (!name) return;
    if (!userAlbums[name]) {
        userAlbums[name] = []; 
        saveAlbums();
        newAlbumInput.value = '';
    } else {
        alert("Album already exists!");
    }
});

function loadAlbumView(albumName) {
    activeViewContext = albumName;
    sectionTitle.innerText = `Album: ${albumName}`;
    closeMobileMenu();
    displayResults(userAlbums[albumName], albumName);
}

function clearSearch() {
    activeViewContext = null;
    sectionTitle.innerText = "Results";
    resultsGrid.innerHTML = '<p class="placeholder-text">Search for a song to start listening.</p>';
    searchInput.value = '';
    closeMobileMenu();
}

// Render Results Grid
function displayResults(songs, viewingAlbumName = null) {
    resultsGrid.innerHTML = '';
    if (songs.length === 0) {
        resultsGrid.innerHTML = '<p class="placeholder-text">No songs here.</p>';
        return;
    }
    
    songs.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        
        let actionButtonHTML = viewingAlbumName 
            ? `<button class="remove-song-btn" title="Remove from Album"><i class="fas fa-trash"></i></button>`
            : `<button class="add-btn" title="Add to Album"><i class="fas fa-plus"></i></button>`;

        card.innerHTML = `
            ${actionButtonHTML}
            <img src="${song.image}" alt="${song.title}">
            <h3>${song.title}</h3>
            <p>${song.singers}</p>
        `;
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            currentPlaylist = songs;
            currentIndex = index;
            playCurrentIndex();
        });

        const actionBtn = card.querySelector('button');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (viewingAlbumName) {
                userAlbums[viewingAlbumName] = userAlbums[viewingAlbumName].filter(s => s.id !== song.id);
                saveAlbums();
                loadAlbumView(viewingAlbumName);
            } else {
                openModal(song);
            }
        });
        resultsGrid.appendChild(card);
    });
}

// Modal Logic
function openModal(song) {
    songToAdd = song;
    modalAlbumList.innerHTML = '';
    const albumNames = Object.keys(userAlbums);
    
    if (albumNames.length === 0) {
        modalAlbumList.innerHTML = '<p style="color: #b3b3b3; text-align:center;">Create an album in the sidebar first!</p>';
    } else {
        albumNames.forEach(name => {
            const li = document.createElement('li');
            li.innerText = name;
            li.onclick = () => {
                const exists = userAlbums[name].some(s => s.id === song.id);
                if (!exists) {
                    userAlbums[name].push(songToAdd);
                    saveAlbums();
                    alert(`Added to ${name}`);
                } else {
                    alert('Song already in this album!');
                }
                albumModal.style.display = "none";
            };
            modalAlbumList.appendChild(li);
        });
    }
    albumModal.style.display = "block";
}
closeModal.onclick = () => albumModal.style.display = "none";
window.onclick = (e) => { if (e.target === albumModal) albumModal.style.display = "none"; }

// Search & Playback
async function searchSongs() {
    activeViewContext = null;
    const query = searchInput.value.trim();
    if (!query) return;
    
    sectionTitle.innerText = `Search: ${query}`;
    resultsGrid.innerHTML = '<p class="placeholder-text">Searching...</p>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        displayResults(data.results, null); 
    } catch (error) {
        resultsGrid.innerHTML = '<p style="color:red; grid-column: 1/-1;">Failed to connect to backend.</p>';
    }
}

async function playCurrentIndex() {
    if (currentIndex < 0 || currentIndex >= currentPlaylist.length) return;
    const songToPlay = currentPlaylist[currentIndex];
    
    try {
        playerTitle.innerText = "Loading...";
        playerArtist.innerText = "";
        
        const response = await fetch(`${API_BASE_URL}/song/${songToPlay.id}`);
        if (!response.ok) throw new Error('Failed to fetch stream');
        const songData = await response.json();
        
        playerImage.style.display = 'block';
        playerImage.src = songData.image;
        playerTitle.innerText = songData.title;
        playerArtist.innerText = songData.singers;
        
        audioPlayer.src = songData.download_url;
        audioPlayer.play();
        
        isPlaying = true;
        updatePlayPauseIcon();
    } catch (error) {
        playerTitle.innerText = "Error loading song. Skipping...";
        setTimeout(playNextSong, 2000); 
    }
}

function playNextSong() {
    if (currentIndex < currentPlaylist.length - 1) {
        currentIndex++;
        playCurrentIndex();
    } else {
        isPlaying = false;
        updatePlayPauseIcon();
    }
}

function playPrevSong() {
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
    } else if (currentIndex > 0) {
        currentIndex--;
        playCurrentIndex();
    }
}

nextBtn.addEventListener('click', playNextSong);
prevBtn.addEventListener('click', playPrevSong);
audioPlayer.addEventListener('ended', playNextSong);

playPauseBtn.addEventListener('click', () => {
    if (!audioPlayer.src) return;
    isPlaying ? audioPlayer.pause() : audioPlayer.play();
    isPlaying = !isPlaying;
    updatePlayPauseIcon();
});

function updatePlayPauseIcon() {
    playPauseBtn.innerHTML = isPlaying ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>';
}

searchBtn.addEventListener('click', searchSongs);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchSongs(); });

audioPlayer.addEventListener('timeupdate', () => {
    if (!isNaN(audioPlayer.duration)) {
        progressBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        currentTimeEl.innerText = formatTime(audioPlayer.currentTime);
        totalTimeEl.innerText = formatTime(audioPlayer.duration);
    }
});

progressBar.addEventListener('input', () => {
    if (!isNaN(audioPlayer.duration)) { audioPlayer.currentTime = (progressBar.value / 100) * audioPlayer.duration; }
});
volumeBar.addEventListener('input', () => { audioPlayer.volume = volumeBar.value / 100; });

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

renderSidebarAlbums();