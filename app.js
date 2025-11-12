
// HillBagger static app.js
const CSV_PATH = '/data/DoBIH_v18_3.csv';
let hills = [];
let bagged = JSON.parse(localStorage.getItem('bagged') || '[]');
const baggedSet = new Set(bagged);

const map = L.map('map').setView([54.5, -3.0], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const markers = L.markerClusterGroup();
map.addLayer(markers);

function updateStats() {
  const stats = document.getElementById('stats');
  stats.textContent = `${baggedSet.size} bagged · ${hills.length} total hills`;
}

function createHillElement(h) {
  const div = document.createElement('div');
  div.className = 'hill';
  div.innerHTML = `<div><strong>${h.name}</strong><div style="font-size:12px">${h.region || ''} · ${h.metres || ''}m</div></div>`;
  const btn = document.createElement('button');
  btn.textContent = baggedSet.has(h.id) ? 'Unbag' : 'Bag';
  if (baggedSet.has(h.id)) btn.classList.add('bagged');
  btn.onclick = () => {
    if (baggedSet.has(h.id)) {
      baggedSet.delete(h.id);
      btn.textContent = 'Bag';
      btn.classList.remove('bagged');
    } else {
      baggedSet.add(h.id);
      btn.textContent = 'Unbag';
      btn.classList.add('bagged');
    }
    const arr = Array.from(baggedSet);
    localStorage.setItem('bagged', JSON.stringify(arr));
    updateStats();
  };
  div.appendChild(btn);
  return div;
}

function addMarkers(data) {
  markers.clearLayers();
  data.forEach(h => {
    if (h.lat && h.long) {
      const m = L.marker([parseFloat(h.lat), parseFloat(h.long)]);
      m.bindPopup(`<strong>${h.name}</strong><br/>${h.region || ''} · ${h.metres || ''}m`);
      markers.addLayer(m);
    }
  });
}

function renderList(data) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  data.forEach(h => list.appendChild(createHillElement(h)));
}

function populateRegions(data) {
  const sel = document.getElementById('regionSelect');
  const regions = Array.from(new Set(data.map(d => d.region).filter(Boolean))).sort();
  regions.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    sel.appendChild(opt);
  });
}

function applyFilters() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const region = document.getElementById('regionSelect').value;
  const filtered = hills.filter(h => {
    if (region && h.region !== region) return false;
    if (!q) return true;
    return (h.name || '').toLowerCase().includes(q) || (h.classification || '').toLowerCase().includes(q);
  });
  renderList(filtered);
  addMarkers(filtered);
}

function fetchAndInit() {
  fetch(CSV_PATH).then(r => r.text()).then(txt => {
    const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
    hills = parsed.data.map((row, i) => {
      // Ensure fields exist and create an id
      return {
        id: row.name.replace(/\s+/g,'_') + '::' + i,
        name: row.name || row.Name || ('Hill ' + i),
        lat: row.lat || row.Lat || row.latitude || row.Latitude || row.Latitude_deg || row.lat_deg || '',
        long: row.long || row.Long || row.longitude || row.Longitude || row.Longitude_deg || row.long_deg || '',
        metres: row.metres || row.height_m || row.height || '',
        region: row.region || row.Region || row.area || row.Area || '',
        classification: row.classification || row.Classification || ''
      };
    });
    populateRegions(hills);
    renderList(hills);
    addMarkers(hills);
    updateStats();
  }).catch(err => {
    console.error('CSV load error', err);
    document.getElementById('list').textContent = 'Failed to load CSV.';
  });
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('regionSelect').addEventListener('change', applyFilters);

document.getElementById('exportGpx').addEventListener('click', () => {
  // Build simple GPX with waypoints for bagged hills
  const baggedIds = new Set(JSON.parse(localStorage.getItem('bagged') || '[]'));
  const points = hills.filter(h => baggedIds.has(h.id) && h.lat && h.long).map(h => ({ name: h.name, lat: h.lat, lon: h.long }));
  if (!points.length) { alert('No bagged hills with coordinates to export'); return; }
  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\\n';
  gpx += '<gpx version="1.1" creator="HillBaggerApp">\\n';
  points.forEach(p => {
    gpx += `<wpt lat="${p.lat}" lon="${p.lon}"><name>${p.name}</name></wpt>\\n`;
  });
  gpx += '</gpx>';
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bagged_hills.gpx'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('exportJson').addEventListener('click', () => {
  const arr = JSON.parse(localStorage.getItem('bagged') || '[]');
  const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'bagged.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

document.getElementById('importJson').addEventListener('click', () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader(); reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (Array.isArray(arr)) { localStorage.setItem('bagged', JSON.stringify(arr)); alert('Imported. Reloading.'); location.reload(); } else alert('JSON must be an array of bagged ids');
      } catch (err) { alert('Invalid JSON'); }
    }; reader.readAsText(f);
  };
  inp.click();
});

// Simple Firebase Google sign-in + Firestore sync (requires config)
const firebaseConfigPlaceholder = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ...
};

let firebaseApp = null;
let firestore = null;
let auth = null;
document.getElementById('signInBtn').addEventListener('click', async () => {
  try {
    if (!firebaseApp) {
      firebaseApp = firebase.initializeApp(firebaseConfigPlaceholder);
      auth = firebase.auth();
      firestore = firebase.firestore();
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    alert('Signed in as ' + result.user.displayName);
  } catch (err) {
    console.error(err); alert('Firebase sign-in failed (check config). See console.');
  }
});

document.getElementById('syncBtn').addEventListener('click', async () => {
  try {
    if (!auth || !auth.currentUser) { alert('Please sign in first.'); return; }
    const uid = auth.currentUser.uid;
    const baggedArr = JSON.parse(localStorage.getItem('bagged') || '[]');
    await firestore.collection('users').doc(uid).set({ bagged: baggedArr }, { merge: true });
    alert('Synced to Firestore (demo).');
  } catch (err) {
    console.error(err); alert('Sync failed. Check Firebase config and Firestore rules.');
  }
});

fetchAndInit();
