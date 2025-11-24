// Global State
let scene, camera, renderer, earth, earthGroup, controls, atmosphere, activeTrail, regionMarker, previousSelectedStationMesh, selectedStationHalo, textureLoader;
let stations = [];
let regions = {};
let currentStation = null;
let currentRegion = null;
let audioElement = null;
let favorites = [];
let autoRotation = true;
let stationMeshes = [];
let animationTime = 0;
let isMobile = window.innerWidth <= 768;
let isPlaying = false;
let retryCount = 0;
let maxRetries = 3;
let rouletteHistory = [];

// Region definitions
const REGION_DEFINITIONS = {
    'North America': {
        emoji: '🌎',
        countries: ['United States', 'Canada', 'Mexico'],
        center: { lat: 45, lon: -100 },
        color: 0x4fc3f7
    },
    'Central America': {
        emoji: '🌎',
        countries: ['Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Belize'],
        center: { lat: 15, lon: -85 },
        color: 0x4dd0e1
    },
    'South America': {
        emoji: '🌎',
        countries: ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay'],
        center: { lat: -15, lon: -60 },
        color: 0x26c6da
    },
    'Western Europe': {
        emoji: '🌍',
        countries: ['United Kingdom', 'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Portugal', 'Ireland', 'Denmark', 'Norway', 'Sweden', 'Finland'],
        center: { lat: 50, lon: 10 },
        color: 0x26a69a
    },
    'Eastern Europe': {
        emoji: '🌍',
        countries: ['Russia', 'Poland', 'Ukraine', 'Romania', 'Czech Republic', 'Hungary', 'Serbia', 'Bulgaria', 'Slovakia', 'Croatia', 'Bosnia and Herzegovina', 'Slovenia', 'Latvia', 'Lithuania', 'Estonia'],
        center: { lat: 52, lon: 30 },
        color: 0x66bb6a
    },
    'Middle East': {
        emoji: '🌍',
        countries: ['Turkey', 'Iran', 'Iraq', 'Saudi Arabia', 'Israel', 'United Arab Emirates', 'Jordan', 'Lebanon', 'Syria', 'Kuwait', 'Oman', 'Qatar', 'Bahrain'],
        center: { lat: 29, lon: 47 },
        color: 0xffa726
    },
    'Africa': {
        emoji: '🌍',
        countries: ['Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'South Africa', 'Nigeria', 'Kenya', 'Ethiopia', 'Ghana', 'Tanzania', 'Uganda'],
        center: { lat: 0, lon: 20 },
        color: 0xef5350
    },
    'South Asia': {
        emoji: '🌏',
        countries: ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Afghanistan'],
        center: { lat: 23, lon: 80 },
        color: 0xec407a
    },
    'East Asia': {
        emoji: '🌏',
        countries: ['China', 'Japan', 'South Korea', 'Taiwan', 'Mongolia'],
        center: { lat: 35, lon: 115 },
        color: 0xab47bc
    },
    'Southeast Asia': {
        emoji: '🌏',
        countries: ['Thailand', 'Indonesia', 'Philippines', 'Vietnam', 'Malaysia', 'Singapore', 'Myanmar', 'Cambodia', 'Laos'],
        center: { lat: 10, lon: 105 },
        color: 0x7e57c2
    },
    'Oceania': {
        emoji: '🌏',
        countries: ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji'],
        center: { lat: -25, lon: 140 },
        color: 0x5c6bc0
    }
};

const genreColors = {
    news: 0x3498db,
    pop: 0x2ecc71,
    classical: 0x9b59b6,
    electronic: 0xe74c3c,
    alternative: 0xf39c12,
    world: 0x1abc9c,
    default: 0x4fc3f7
};

const EARTH_RADIUS = 5;
const STATION_SIZE = isMobile ? 0.08 : 0.06;

function init() {
    audioElement = document.getElementById('audio-element');
    textureLoader = new THREE.TextureLoader();
    
    // Load favorites
    const savedFavorites = localStorage.getItem('fractalradio_favorites');
    if (savedFavorites) {
        favorites = JSON.parse(savedFavorites);
        updateFavoriteCount();
    }
    
    // Load roulette history
    const savedHistory = localStorage.getItem('fractalradio_roulette_history');
    if (savedHistory) {
        rouletteHistory = JSON.parse(savedHistory);
    }
    
    setupScene();
    setupLights();
    createEarth();
    createStarfield();
    
    loadStations();
    setupUI();
    setupAudioHandlers();
    
    animate();
    
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
        }, 500);
    }, 1500);
}

function setupScene() {
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(
        isMobile ? 70 : 60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = isMobile ? 12 : 15;
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobile, 
        alpha: true,
        powerPreference: isMobile ? 'low-power' : 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1e1e1e, 1);
    document.getElementById('scene-container').appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = isMobile ? 6 : 8;
    controls.maxDistance = 30;
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    
    window.addEventListener('resize', onWindowResize);
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
    
    const rimLight = new THREE.PointLight(0x4fc3f7, 0.4, 50);
    rimLight.position.set(-8, 0, 0);
    scene.add(rimLight);
}

function createEarth() {
    earthGroup = new THREE.Group();
    
    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, isMobile ? 48 : 64, isMobile ? 48 : 64);
    const material = new THREE.MeshStandardMaterial({
        color: 0x1a4a6a, // Darker blue for oceans
        emissive: 0x05101a, // Subtle dark emissive
        roughness: 0.8, // Less reflective
        metalness: 0.1, // Slightly metallic feel
        transparent: true,
        opacity: 0.95
    });
    
    // Load and apply texture for landmasses
    textureLoader.load('https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg', (texture) => { // Placeholder URL
        material.map = texture;
        material.needsUpdate = true;
    });

    earth = new THREE.Mesh(earthGeometry, material);
    earthGroup.add(earth);

    // Add a wireframe overlay with sparser geometry
    const wireframeGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.001, isMobile ? 16 : 24, isMobile ? 16 : 24); // Slightly larger to avoid z-fighting, reduced segments
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7, // A light blue for the grid lines
        wireframe: true,
        transparent: true,
        opacity: 0.15 // Subtle opacity
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    earthGroup.add(wireframe);
    
    const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, isMobile ? 32 : 64, isMobile ? 32 : 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide
    });
    atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
	atmosphere = atmosphere;
    earthGroup.add(atmosphere);
    
    scene.add(earthGroup);
}

function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xcccccc,
        size: isMobile ? 0.1 : 0.08,
        transparent: true,
        opacity: 0.6
    });
    
    const starVertices = [];
    const starCount = isMobile ? 400 : 800;
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

function loadStations() {
    const corsProxy = 'https://corsproxy.io/?';
    const apiUrl = 'https://de1.api.radio-browser.info/json/stations/search?limit=1000&has_geo_info=true&order=votes&reverse=true';
    
    fetch(corsProxy + encodeURIComponent(apiUrl))
        .then(response => response.json())
        .then(data => {
            stations = data
                .filter(s => s.geo_lat && s.geo_long && s.url_resolved)
                .map(s => ({
                    id: s.stationuuid,
                    name: s.name,
                    country: s.country,
                    url: s.url_resolved || s.url,
                    favicon: s.favicon,
                    tags: s.tags ? s.tags.split(',') : [],
                    language: s.language || 'Unknown',
                    lat: parseFloat(s.geo_lat),
                    lon: parseFloat(s.geo_long),
                    genre: detectGenre(s.tags || ''),
                    votes: s.votes || 0,
                    bitrate: s.bitrate || 128,
                    codec: s.codec || 'MP3'
                }));
            
            groupStationsByRegion();
            createStationMeshes();
            renderRegionList();
            updateGlobalStats();
        })
        .catch(error => {
            console.error('Error loading stations:', error);
            stations = createDemoStations();
            groupStationsByRegion();
            createStationMeshes();
            renderRegionList();
            updateGlobalStats();
        });
}

function detectGenre(tags) {
    const tagStr = tags.toLowerCase();
    if (tagStr.includes('news') || tagStr.includes('talk')) return 'news';
    if (tagStr.includes('pop') || tagStr.includes('top')) return 'pop';
    if (tagStr.includes('classical') || tagStr.includes('jazz')) return 'classical';
    if (tagStr.includes('electronic') || tagStr.includes('dance')) return 'electronic';
    if (tagStr.includes('alternative') || tagStr.includes('rock')) return 'alternative';
    if (tagStr.includes('world') || tagStr.includes('folk')) return 'world';
    return 'default';
}

function createDemoStations() {
    return [
        { id: '1', name: 'BBC World Service', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, genre: 'news', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_world_service', language: 'English', bitrate: 128, codec: 'MP3' },
        { id: '2', name: 'Radio Paradise', country: 'United States', lat: 37.7749, lon: -122.4194, genre: 'alternative', url: 'https://stream.radioparadise.com/aac-320', language: 'English', bitrate: 320, codec: 'AAC' },
        { id: '3', name: 'FIP Radio', country: 'France', lat: 48.8566, lon: 2.3522, genre: 'world', url: 'https://icecast.radiofrance.fr/fip-hifi.aac', language: 'French', bitrate: 128, codec: 'AAC' },
        { id: '4', name: 'NRK P1', country: 'Norway', lat: 59.9139, lon: 10.7522, genre: 'news', url: 'https://lyd.nrk.no/nrk_radio_p1_ostlandssendingen_mp3_h', language: 'Norwegian', bitrate: 192, codec: 'MP3' },
        { id: '5', name: 'Triple J', country: 'Australia', lat: -33.8688, lon: 151.2093, genre: 'alternative', url: 'https://live-radio01.mediahubaustralia.com/2TJW/mp3/', language: 'English', bitrate: 128, codec: 'MP3' }
    ];
}

function groupStationsByRegion() {
    regions = {};
    
    Object.keys(REGION_DEFINITIONS).forEach(regionName => {
        regions[regionName] = {
            ...REGION_DEFINITIONS[regionName],
            stations: []
        };
    });
    
    stations.forEach(station => {
        let assigned = false;
        Object.keys(REGION_DEFINITIONS).forEach(regionName => {
            if (REGION_DEFINITIONS[regionName].countries.includes(station.country)) {
                regions[regionName].stations.push(station);
                assigned = true;
            }
        });
        
        if (!assigned) {
            if (!regions['Other']) {
                regions['Other'] = {
                    emoji: '🌐',
                    countries: [],
                    center: { lat: 0, lon: 0 },
                    color: 0x858585,
                    stations: []
                };
            }
            regions['Other'].stations.push(station);
        }
    });
}

function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    
    return new THREE.Vector3(x, y, z);
}

function createStationMeshes() {
    stationMeshes.forEach(mesh => earthGroup.remove(mesh));
    stationMeshes = [];
    
    stations.forEach(station => {
        const geometry = new THREE.SphereGeometry(STATION_SIZE, 8, 8);
        const color = genreColors[station.genre] || genreColors.default;
        const material = new THREE.MeshStandardMaterial({ // Changed to StandardMaterial
            color: color,
            emissive: color, // Make them glow with their genre color
            emissiveIntensity: 0.5, // Adjust glow intensity
            roughness: 0.5,
            metalness: 0.5,
            transparent: true,
            opacity: 0.85
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        const position = latLonToVector3(station.lat, station.lon, EARTH_RADIUS);
        mesh.position.copy(position);
        
        mesh.userData = { station };
        stationMeshes.push(mesh);
        earthGroup.add(mesh);
    });
    
    setupStationClicks();
}

function setupStationClicks() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleInteraction = (event) => {
        let clientX, clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(stationMeshes);
        
        if (intersects.length > 0) {
            const station = intersects[0].object.userData.station;
            selectStation(station);
        }
    };
    
    renderer.domElement.addEventListener('click', handleInteraction);
    renderer.domElement.addEventListener('touchend', handleInteraction);
}

function renderRegionList() {
    const regionList = document.getElementById('region-list');
    regionList.innerHTML = '';
    
    Object.keys(regions).forEach(regionName => {
        const region = regions[regionName];
        const stationCount = region.stations.length;
        
        if (stationCount === 0) return;
        
        const regionItem = document.createElement('div');
        regionItem.className = 'region-item';
        regionItem.innerHTML = `
            <div class="region-header">
                <span class="region-emoji">${region.emoji}</span>
                <span class="region-name">${regionName}</span>
            </div>
            <div class="region-meta">
                <span class="station-count">${stationCount} stations</span>
            </div>
        `;
        
        regionItem.addEventListener('click', () => selectRegion(regionName));
        regionList.appendChild(regionItem);
    });
}

function selectRegion(regionName) {
    currentRegion = regionName;
    const region = regions[regionName];
    
    document.getElementById('region-list').style.display = 'none';
    document.getElementById('station-list').style.display = 'block';
    document.getElementById('current-region-name').textContent = regionName;
    
    renderStationList(region.stations);
    focusOnRegion(region);
    highlightRegionStations(region.stations);

    // --- Region Marker Logic ---
    if (regionMarker) {
        scene.remove(regionMarker);
        regionMarker.geometry.dispose();
        regionMarker.material.dispose();
    }

    const markerPosition = latLonToVector3(region.center.lat, region.center.lon, EARTH_RADIUS * 1.1); // Slightly above earth
    const markerGeometry = new THREE.SphereGeometry(0.2, 16, 16); // Small sphere
    const markerMaterial = new THREE.MeshBasicMaterial({
        color: region.color, // Use region's color
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending // For a glowing effect
    });
    regionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    regionMarker.position.copy(markerPosition);
    scene.add(regionMarker);
    // --- End Region Marker Logic ---
}

function renderStationList(stationList) {
    const container = document.getElementById('stations-container');
    container.innerHTML = '';
    
    stationList.forEach(station => {
        const stationItem = document.createElement('div');
        stationItem.className = 'station-item';
        
        const genreColor = getGenreColor(station.genre);
        
        stationItem.innerHTML = `
            <div class="station-item-header">
                <div class="station-item-info">
                    <div class="station-item-name">${station.name}</div>
                    <div class="station-item-location">${station.country}</div>
                </div>
                <div class="station-item-actions">
                    <button class="station-play-btn" data-id="${station.id}">▶</button>
                </div>
            </div>
            <div class="station-item-meta">
                <span class="genre-indicator" style="background: ${genreColor}"></span>
                <span class="station-genre">${station.genre}</span>
            </div>
        `;
        
        stationItem.querySelector('.station-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            selectStation(station);
        });
        
        container.appendChild(stationItem);
    });
}

function getGenreColor(genre) {
    const colors = {
        news: '#3498db',
        pop: '#2ecc71',
        classical: '#9b59b6',
        electronic: '#e74c3c',
        alternative: '#f39c12',
        world: '#1abc9c',
        default: '#4fc3f7'
    };
    return colors[genre] || colors.default;
}

function focusOnRegion(region) {
    const centerPos = latLonToVector3(region.center.lat, region.center.lon, EARTH_RADIUS * 2.5);
    
    const startPos = camera.position.clone();
    const startTime = Date.now();
    const duration = 1000;
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        
        camera.position.lerpVectors(startPos, centerPos, eased);
        camera.lookAt(0, 0, 0);
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function highlightRegionStations(regionStations) {
    const regionIds = new Set(regionStations.map(s => s.id));
    
    stationMeshes.forEach(mesh => {
        const station = mesh.userData.station;
        mesh.material.opacity = regionIds.has(station.id) ? 1 : 0.2;
    });
}

function selectStation(station) {
    currentStation = station;
    retryCount = 0;
    
    document.getElementById('current-station').textContent = station.name;
    document.getElementById('current-location').textContent = station.country;
    document.getElementById('current-genre').textContent = station.genre.toUpperCase();
    document.getElementById('current-genre').style.background = getGenreColor(station.genre);
    document.getElementById('stream-quality').textContent = `${station.bitrate}kbps ${station.codec}`;
    
    // Update mobile player
    document.getElementById('mobile-station').textContent = station.name;
    document.getElementById('mobile-location').textContent = station.country;
    document.getElementById('mobile-genre').textContent = station.genre.toUpperCase();
    
    playStation(station.url);
    updateFavoriteButton();
    updateMobileFavoriteButton(); // Add this line

    playStation(station.url);
    updateFavoriteButton();

    // --- Station Highlight Logic ---
    if (previousSelectedStationMesh) {
        const prevStation = previousSelectedStationMesh.userData.station;
        const originalColor = new THREE.Color(genreColors[prevStation.genre] || genreColors.default);
        previousSelectedStationMesh.material.emissive.copy(originalColor);
        previousSelectedStationMesh.material.emissiveIntensity = 0.5; // Revert to default
        previousSelectedStationMesh.scale.set(1, 1, 1); // Revert scale
        previousSelectedStationMesh.material.opacity = 0.85; // Revert opacity
    }

    const stationMesh = stationMeshes.find(mesh => mesh.userData.station.id === station.id);
    if (stationMesh) {
        // Apply highlight
        stationMesh.material.emissive.setHex(0xffffff); // Bright white glow
        stationMesh.material.emissiveIntensity = 2.0; // More intense glow
        stationMesh.scale.set(1.5, 1.5, 1.5); // Make it larger
        stationMesh.material.opacity = 1.0; // Ensure full opacity

        previousSelectedStationMesh = stationMesh;

        // Create and add halo (now a group for multiple rings)
        if (selectedStationHalo) {
            earthGroup.remove(selectedStationHalo);
            selectedStationHalo.children.forEach(child => {
                child.geometry.dispose();
                child.material.dispose();
            });
            selectedStationHalo = null;
        }
        selectedStationHalo = new THREE.Group();
        selectedStationHalo.position.copy(stationMesh.position);
        selectedStationHalo.lookAt(new THREE.Vector3(0,0,0)); // Orient the group
        selectedStationHalo.rotateX(Math.PI / 2); // Make it flat on the surface
        selectedStationHalo.userData.spawnCounter = 0;
        selectedStationHalo.userData.spawnInterval = 15; // Spawn a new ring every X frames
        selectedStationHalo.userData.ringColor = new THREE.Color(genreColors[station.genre] || genreColors.default);
        earthGroup.add(selectedStationHalo);
    }
    // --- End Station Highlight Logic ---

    // --- Connection Trail Logic ---
    if (activeTrail) {
        scene.remove(activeTrail);
        activeTrail.children.forEach(child => {
            child.geometry.dispose();
            child.material.dispose();
        });
        activeTrail = null;
    }

    if (stationMesh) { // Use the found stationMesh for trail origin
        activeTrail = new THREE.Group();
        scene.add(activeTrail);
        activeTrail.userData.origin = stationMesh.position.clone();
        activeTrail.userData.direction = new THREE.Vector3(0, 0, 0).sub(activeTrail.userData.origin).normalize();
        activeTrail.userData.particles = []; // Array to hold trail particles
        activeTrail.userData.particleCount = 0;
        activeTrail.userData.maxParticles = 100;
        activeTrail.userData.particleSpeed = 0.08;
        activeTrail.userData.particleSize = 0.1; // Increased for debugging
        activeTrail.userData.spawnInterval = 3;
        activeTrail.userData.maxLength = 5; // Increased for debugging
    }
    // --- End Connection Trail Logic ---
}

function playStation(url) {
    setStatus('Connecting...', 'connecting');
    showLoading(true);
    
    audioElement.src = url;
    audioElement.load();
    
    const playPromise = audioElement.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                isPlaying = true;
                updatePlayButtons(true);
                setStatus('Playing', 'playing');
                showLoading(false);
                retryCount = 0;
            })
            .catch(error => {
                console.error('Playback error:', error);
                handlePlaybackError();
            });
    }
}

function handlePlaybackError() {
    if (retryCount < maxRetries) {
        retryCount++;
        setStatus(`Retrying (${retryCount}/${maxRetries})...`, 'connecting');
        setTimeout(() => {
            if (currentStation) {
                playStation(currentStation.url);
            }
        }, 1000);
    } else {
        setStatus('Stream unavailable', 'error');
        showLoading(false);
        isPlaying = false;
        updatePlayButtons(false);
    }
}

function setStatus(text, state) {
    const statusEl = document.getElementById('status-indicator');
    const statusText = statusEl.querySelector('.status-text');
    const statusDot = statusEl.querySelector('.status-dot');
    
    statusText.textContent = text;
    statusDot.className = 'status-dot status-' + state;
}

function showLoading(show) {
    document.getElementById('loading-spinner').style.display = show ? 'flex' : 'none';
}

function updatePlayButtons(playing) {
    const playSvg = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z"/><path d="M0 0h24v24H0z" fill="none"/></svg>';
    const pauseSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';

    document.querySelector('#play-btn .play-icon').innerHTML = playing ? pauseSvg : playSvg;
    document.getElementById('mobile-play-btn').innerHTML = playing ? pauseSvg : playSvg;
}

function setupAudioHandlers() {
    audioElement.addEventListener('loadstart', () => {
        setStatus('Loading...', 'connecting');
        showLoading(true);
    });
    
    audioElement.addEventListener('canplay', () => {
        showLoading(false);
    });
    
    audioElement.addEventListener('playing', () => {
        isPlaying = true;
        setStatus('Playing', 'playing');
        showLoading(false);
        updatePlayButtons(true); // Add this line
    });
    
    audioElement.addEventListener('pause', () => {
        isPlaying = false;
        setStatus('Paused', 'paused');
        updatePlayButtons(false); // Add this line
    });
    
    audioElement.addEventListener('error', () => {
        handlePlaybackError();
    });
    
    audioElement.addEventListener('stalled', () => {
        setStatus('Buffering...', 'connecting');
    });
    
    audioElement.addEventListener('waiting', () => {
        setStatus('Buffering...', 'connecting');
    });
}

function setupUI() {
    // Play/Pause
    document.getElementById('play-btn').addEventListener('click', togglePlayPause);
    document.getElementById('mobile-play-btn').addEventListener('click', togglePlayPause);
    
    // Volume
    document.getElementById('volume').addEventListener('input', (e) => {
        const value = e.target.value;
        audioElement.volume = value / 100;
        document.getElementById('volume-value').textContent = value + '%';
    });
    
    // Mute
    document.getElementById('mute-btn').addEventListener('click', () => {
        audioElement.muted = !audioElement.muted;
        document.getElementById('mute-btn').textContent = audioElement.muted ? '🔇' : '🔊';
    });
    
    // Back to regions
    document.getElementById('back-to-regions').addEventListener('click', () => {
        document.getElementById('station-list').style.display = 'none';
        document.getElementById('region-list').style.display = 'block';
        currentRegion = null;
        stationMeshes.forEach(mesh => mesh.material.opacity = 0.85); // This resets opacity for all

        // Clear previous selected station highlight
        previousSelectedStationMesh = null;

        // Remove selected station halo
        if (selectedStationHalo) {
            earthGroup.remove(selectedStationHalo);
            selectedStationHalo.geometry.dispose();
            selectedStationHalo.material.dispose();
            selectedStationHalo = null;
        }

        // Remove region marker
        if (regionMarker) {
            scene.remove(regionMarker);
            regionMarker.geometry.dispose();
            regionMarker.material.dispose();
            regionMarker = null;
        }
    });
    
    // Favorites
    document.getElementById('add-favorite-btn').addEventListener('click', toggleFavorite);
    
    // Share
    document.getElementById('share-btn').addEventListener('click', () => {
        if (currentStation) {
            const text = `Listening to ${currentStation.name} on Fractal Radio!`;
            if (navigator.share) {
                navigator.share({ title: 'Fractal Radio', text, url: window.location.href });
            } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Station link copied!');
            }
        }
    });
    
    // Auto-rotate
    document.getElementById('auto-rotate-btn').addEventListener('click', () => {
        autoRotation = !autoRotation;
        document.getElementById('auto-rotate-btn').style.opacity = autoRotation ? '1' : '0.5';
    });
    
    // Reset view
    document.getElementById('reset-view-btn').addEventListener('click', () => {
        camera.position.set(0, 0, isMobile ? 12 : 15);
        controls.reset();
    });
    
    // Fullscreen
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });
    
    // Favorites Panel Toggle
    document.getElementById('favorites-btn').addEventListener('click', toggleFavoritesPanel);
    document.getElementById('close-favorites-btn').addEventListener('click', toggleFavoritesPanel);
    
    // Search
    document.getElementById('global-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterStations(query);
    });

    document.getElementById('station-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterRegionStations(query);
    });
    
    // Radio Roulette
    document.getElementById('roulette-btn').addEventListener('click', spinRoulette);
    
    // Mobile menu
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleMobileMenu);
    
    // Mobile favorite button
    document.getElementById('mobile-favorite-btn').addEventListener('click', toggleFavorite);

    // Mobile player info click to expand now playing
    document.getElementById('mobile-player-info').addEventListener('click', () => {
        document.getElementById('right-panel').classList.add('mobile-expanded');
    });
    
    // Mobile close player
    document.getElementById('mobile-close-player').addEventListener('click', () => {
        document.getElementById('right-panel').classList.remove('mobile-expanded');
    });
}

function togglePlayPause() {
    if (!currentStation) return;
    
    if (audioElement.paused) {
        audioElement.play();
    } else {
        audioElement.pause();
    }
}

function toggleMobileMenu() {
    const leftPanel = document.getElementById('left-panel');
    leftPanel.classList.toggle('mobile-open');
}

function filterStations(query) {
    if (!query) {
        stationMeshes.forEach(mesh => mesh.visible = true);
        return;
    }
    
    stationMeshes.forEach(mesh => {
        const station = mesh.userData.station;
        const matches = station.name.toLowerCase().includes(query) ||
                       station.country.toLowerCase().includes(query);
        mesh.visible = matches;
    });
}

function filterRegionStations(query) {
    if (!currentRegion) return;

    const regionStations = regions[currentRegion].stations;
    let filteredStations = regionStations;

    if (query) {
        filteredStations = regionStations.filter(station => 
            station.name.toLowerCase().includes(query) ||
            station.country.toLowerCase().includes(query) ||
            station.language.toLowerCase().includes(query) ||
            station.tags.some(tag => tag.toLowerCase().includes(query))
        );
    }
    renderStationList(filteredStations);
}

function toggleFavorite() {
    if (!currentStation) return;
    
    const index = favorites.findIndex(f => f.id === currentStation.id);
    if (index >= 0) {
        favorites.splice(index, 1);
    } else {
        favorites.push(currentStation);
    }
    
    localStorage.setItem('fractalradio_favorites', JSON.stringify(favorites));
    updateFavoriteButton();
    updateFavoriteCount();
    updateMobileFavoriteButton(); // Add this line
}

function updateFavoriteButton() {
    if (!currentStation) return;
    const isFavorite = favorites.some(f => f.id === currentStation.id);
    const btn = document.getElementById('add-favorite-btn');
    const iconSpan = btn.querySelector('.icon'); // Get the icon span
    const filledHeartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 8 3.05c1.74 0 3.41.81 4.5 2.09C13.09 3.86 14.76 3.05 16.5 3.05A5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.43L12 21.35z"/></svg>';
    const outlineHeartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 8 3.05c1.74 0 3.41.81 4.5 2.09C13.09 3.86 14.76 3.05 16.5 3.05A5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.43L12 21.35z"/></svg>';

    if (iconSpan) { // Check if icon span exists
        iconSpan.innerHTML = isFavorite ? filledHeartSvg : outlineHeartSvg;
    }
    if (btn) {
        btn.style.background = isFavorite ? 'rgba(236, 64, 122, 0.2)' : '';
    }
}

function updateMobileFavoriteButton() {
    if (!currentStation) return;
    const isFavorite = favorites.some(f => f.id === currentStation.id);
    const btn = document.getElementById('mobile-favorite-btn');
    const filledHeartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 8 3.05c1.74 0 3.41.81 4.5 2.09C13.09 3.86 14.76 3.05 16.5 3.05A5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.43L12 21.35z"/></svg>';
    const outlineHeartSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 8 3.05c1.74 0 3.41.81 4.5 2.09C13.09 3.86 14.76 3.05 16.5 3.05A5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.43L12 21.35z"/></svg>';

    if (btn) { // Check if button exists (only on mobile)
        btn.innerHTML = isFavorite ? filledHeartSvg : outlineHeartSvg;
        if (isFavorite) {
            btn.style.background = '#ec407a'; // Fully pinkish-red
            btn.style.color = '#ffffff';
        } else {
            btn.style.background = '#2d2d30'; // Dull color
            btn.style.color = '#cccccc';
        }
    }
}

function updateFavoriteCount() {
    document.getElementById('fav-count').textContent = favorites.length;
}

function toggleFavoritesPanel() {
    const favoritesPanel = document.getElementById('favorites-panel');
    favoritesPanel.classList.toggle('open');

    if (favoritesPanel.classList.contains('open')) {
        renderFavoritesList();
    }
}

function renderFavoritesList() {
    const container = document.getElementById('favorites-container');
    container.innerHTML = ''; // Clear previous list

    const noFavoritesMessage = document.getElementById('no-favorites-message');

    if (favorites.length === 0) {
        noFavoritesMessage.style.display = 'block';
        return;
    } else {
        noFavoritesMessage.style.display = 'none';
    }

    favorites.forEach(station => {
        const stationItem = document.createElement('div');
        stationItem.className = 'station-item'; // Re-use existing station-item style

        const genreColor = getGenreColor(station.genre);

        stationItem.innerHTML = `
            <div class="station-item-header">
                <div class="station-item-info">
                    <div class="station-item-name">${station.name}</div>
                    <div class="station-item-location">${station.country}</div>
                </div>
                <div class="station-item-actions">
                    <button class="station-play-btn" data-id="${station.id}">▶</button>
                </div>
            </div>
            <div class="station-item-meta">
                <span class="genre-indicator" style="background: ${genreColor}"></span>
                <span class="station-genre">${station.genre}</span>
            </div>
        `;
        
        stationItem.querySelector('.station-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            selectStation(station);
            toggleFavoritesPanel(); // Close panel after selection
        });

        container.appendChild(stationItem);
    });
}

function updateGlobalStats() {
    document.getElementById('total-stations').textContent = stations.length.toLocaleString();
    document.getElementById('regions-covered').textContent = Object.keys(regions).filter(r => regions[r].stations.length > 0).length;
}

function spinRoulette() {
    if (stations.length === 0) return;
    
    // Show overlay
    const overlay = document.getElementById('roulette-overlay');
    overlay.style.display = 'flex';
    
    // Countdown animation
    let count = 3;
    const countdownEl = document.getElementById('roulette-countdown');
    
    const countInterval = setInterval(() => {
        count--;
        countdownEl.textContent = count > 0 ? count : 'GO!';
        
        if (count <= 0) {
            clearInterval(countInterval);
            
            // Select random station
            const randomStation = stations[Math.floor(Math.random() * stations.length)];
            
            // Add to history
            rouletteHistory.unshift(randomStation);
            if (rouletteHistory.length > 10) {
                rouletteHistory = rouletteHistory.slice(0, 10);
            }
            localStorage.setItem('fractalradio_roulette_history', JSON.stringify(rouletteHistory));
            
            // Hide overlay
            setTimeout(() => {
                overlay.style.display = 'none';
                countdownEl.textContent = '3';
                selectStation(randomStation);
            }, 500);
        }
    }, 1000);
    
    // Spin globe
    const startRotation = earthGroup.rotation.y;
    const targetRotation = startRotation + Math.PI * 4;
    const spinDuration = 3000;
    const spinStart = Date.now();
    
    function spinAnimation() {
        const elapsed = Date.now() - spinStart;
        const progress = Math.min(elapsed / spinDuration, 1);
        const eased = easeInOutCubic(progress);
        
        earthGroup.rotation.y = startRotation + (targetRotation - startRotation) * eased;
        
        if (progress < 1) {
            requestAnimationFrame(spinAnimation);
        }
    }
    
    spinAnimation();
}

function animate() {
    requestAnimationFrame(animate);
    
    animationTime += 0.016;
    
    if (autoRotation && !currentRegion) {
        earthGroup.rotation.y += 0.001;
    }
    
    // Pulsating atmosphere
    if (atmosphere) {
        atmosphere.material.opacity = 0.1 + Math.sin(animationTime * 2) * 0.05; // Base opacity + pulse
    }

    // Animate active trail (particle system)
    if (activeTrail) {
        activeTrail.userData.frameCounter++;
        if (activeTrail.userData.frameCounter >= activeTrail.userData.spawnInterval) {
            const particleGeometry = new THREE.SphereGeometry(activeTrail.userData.particleSize, 4, 4);
            const particleMaterial = new THREE.MeshStandardMaterial({ // Changed to StandardMaterial
                color: 0x4fc3f7,
                emissive: 0x4fc3f7, // Make them glow
                emissiveIntensity: 5.0, // Very bright for debugging
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            // Offset initial position slightly outwards from the station sphere
            const offsetDirection = activeTrail.userData.direction.clone().negate(); // Opposite direction of trail movement
            particle.position.copy(activeTrail.userData.origin).add(offsetDirection.multiplyScalar(STATION_SIZE * 1.2)); // Start slightly outside the station sphere
            particle.userData.distance = 0; // Distance traveled by particle
            activeTrail.add(particle);
            activeTrail.userData.particles.push(particle);
            activeTrail.userData.frameCounter = 0;
        }

        const particlesToRemove = [];
        activeTrail.userData.particles.forEach((particle, index) => {
            particle.position.add(activeTrail.userData.direction.clone().multiplyScalar(activeTrail.userData.particleSpeed));
            particle.userData.distance += activeTrail.userData.particleSpeed;

            // Fade out based on distance
            const maxDistance = activeTrail.userData.maxLength;
            particle.material.opacity = 1 - (particle.userData.distance / maxDistance);
            particle.scale.setScalar(1 - (particle.userData.distance / maxDistance)); // Shrink as it fades

            if (particle.material.opacity <= 0 || particle.userData.distance >= maxDistance) {
                particlesToRemove.push(index);
            }
        });

        // Remove particles
        for (let i = particlesToRemove.length - 1; i >= 0; i--) {
            const index = particlesToRemove[i];
            const particle = activeTrail.userData.particles[index];
            activeTrail.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
            activeTrail.userData.particles.splice(index, 1);
        }
    }

    // Animate region marker
    if (regionMarker) {
        const scale = 1 + Math.sin(animationTime * 3) * 0.2; // Pulsating scale
        regionMarker.scale.set(scale, scale, scale);
        regionMarker.material.opacity = 0.6 + Math.sin(animationTime * 3) * 0.2; // Pulsating opacity
    }

    // Animate selected station halo (multiple rings)
    if (selectedStationHalo) {
        selectedStationHalo.userData.spawnCounter++;
        if (selectedStationHalo.userData.spawnCounter >= selectedStationHalo.userData.spawnInterval) {
            const ringInnerRadius = STATION_SIZE * 1.5;
            const ringOuterRadius = STATION_SIZE * 1.6; // Initial small ring
            const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: selectedStationHalo.userData.ringColor,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.userData.startTime = animationTime; // Use animationTime for consistent timing
            selectedStationHalo.add(ring);
            selectedStationHalo.userData.spawnCounter = 0;
        }

        const ringsToRemove = [];
        selectedStationHalo.children.forEach((ring, index) => {
            const elapsedTime = animationTime - ring.userData.startTime;
            const duration = 1.5; // Duration for ring expansion and fade

            if (elapsedTime > duration) {
                ringsToRemove.push(index);
                return;
            }

            const progress = elapsedTime / duration;
            const easedProgress = easeOutCubic(progress); // Use an easing function for smoother animation

            // Expand ring
            const currentInnerRadius = STATION_SIZE * 1.5 + (STATION_SIZE * 2 * easedProgress);
            const currentOuterRadius = STATION_SIZE * 1.6 + (STATION_SIZE * 2.5 * easedProgress);
            ring.geometry.dispose(); // Dispose old geometry
            ring.geometry = new THREE.RingGeometry(currentInnerRadius, currentOuterRadius, 32);
            ring.geometry.needsUpdate = true;

            // Fade opacity
            ring.material.opacity = 1.0 - easedProgress;
        });

        // Remove rings
        for (let i = ringsToRemove.length - 1; i >= 0; i--) {
            const index = ringsToRemove[i];
            const ring = selectedStationHalo.children[index];
            selectedStationHalo.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
    }

    // Dynamic scaling of station spheres based on zoom
    const cameraDistance = camera.position.distanceTo(controls.target);
    let dynamicScale = 1.0;

    const MIN_STATION_SCALE = 0.3; // Minimum scale for stations when zoomed in
    const MAX_STATION_SCALE = 1.0; // Maximum scale for stations when zoomed out (original size)
    const CAMERA_MIN_DISTANCE_FOR_SCALE = 8; // Camera distance at which stations start scaling down
    const CAMERA_MAX_DISTANCE_FOR_SCALE = 20; // Camera distance at which stations are at max scale

    if (cameraDistance < CAMERA_MIN_DISTANCE_FOR_SCALE) {
        dynamicScale = MIN_STATION_SCALE;
    } else if (cameraDistance > CAMERA_MAX_DISTANCE_FOR_SCALE) {
        dynamicScale = MAX_STATION_SCALE;
    } else {
        // Interpolate scale between min and max based on camera distance
        const scaleRange = MAX_STATION_SCALE - MIN_STATION_SCALE;
        const distanceRange = CAMERA_MAX_DISTANCE_FOR_SCALE - CAMERA_MIN_DISTANCE_FOR_SCALE;
        const normalizedDistance = (cameraDistance - CAMERA_MIN_DISTANCE_FOR_SCALE) / distanceRange;
        dynamicScale = MIN_STATION_SCALE + (normalizedDistance * scaleRange);
    }

    stationMeshes.forEach((mesh, i) => {
        // Apply dynamic scale, but also consider the existing pulse
        const pulseScale = 1 + Math.sin(animationTime * (1.5 + (i % 10) * 0.1)) * 0.15;
        let finalScale = dynamicScale * pulseScale;

        // Ensure selected station highlight scale is maintained
        if (mesh === previousSelectedStationMesh) {
            finalScale = dynamicScale * 1.5; // Maintain larger scale for selected station
        }
        
        mesh.scale.set(finalScale, finalScale, finalScale);
    });
    
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    isMobile = window.innerWidth <= 768;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
