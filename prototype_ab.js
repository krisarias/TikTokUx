// ------------ Simple A/B assignment --------------
const VAR_KEY = 'tt_variant';
const COUNTS_KEY = 'tt_counts_v2';
const EVENTS_KEY = 'tt_events_v1';

function assignVariant() {
  let v = localStorage.getItem(VAR_KEY);
  if (!v) {
    v = (Math.random() < 0.5) ? 'A' : 'B';
    localStorage.setItem(VAR_KEY, v);
  }
  return v;
}

function setVariant(v) {
  localStorage.setItem(VAR_KEY, v);
  const el = document.getElementById('variant-label');
  if (el) el.textContent = v;
  try {
    const variantToggle = document.getElementById('variantToggle');
    if (variantToggle) {
      const buttons = variantToggle.querySelectorAll('.ab-btn');
      buttons.forEach(b => {
        const bv = b.getAttribute('data-variant');
        const active = bv === v;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  } catch(e) {}
}

function readCounts() {
  const raw = localStorage.getItem(COUNTS_KEY);
  try { return raw ? JSON.parse(raw) : { A: {}, B: {} }; } catch(e) { return { A: {}, B: {} }; }
}

function saveCounts(obj) { localStorage.setItem(COUNTS_KEY, JSON.stringify(obj)); }

function incrementCount(areaId) {
  const v = localStorage.getItem(VAR_KEY) || assignVariant();
  const counts = readCounts();
  if (!counts[v]) counts[v] = {};
  counts[v][areaId] = (counts[v][areaId] || 0) + 1;
  saveCounts(counts);
  return counts;
}

// Record an event to the events log (keeps recent history); also used for export
function recordEvent(areaId, target, isMiss, coords) {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    const ev = {
      id: areaId,
      target: target || null,
      variant: localStorage.getItem(VAR_KEY) || assignVariant(),
      miss: !!isMiss,
      ts: new Date().toISOString(),
      ...(coords ? { x: coords.x, y: coords.y, w: coords.w, h: coords.h } : {})
    };
    events.push(ev);
    while (events.length > 500) events.shift();
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    return ev;
  } catch { return null; }
}

function resetCounts() {
  const obj = { A: {}, B: {} };
  saveCounts(obj);
  return obj;
}

function exportCounts() {
  const data = readCounts();
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), variant: localStorage.getItem(VAR_KEY), counts: data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prototype-clicks-' + (new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------ Navigation + tracking --------------
function setScreen(path) {
  const img = document.getElementById('screen');
  if (img) img.src = path;
}

// Track click and navigate. targetKey may be a path or 'VARIANT_MIDDLE'.
function trackAndSet(areaId, targetKey) {
  window.__lastAreaClicked = true;
  incrementCount(areaId);
  const variant = localStorage.getItem(VAR_KEY) || assignVariant();
  const middleMap = { A: 'images/screen2.svg', B: 'images/screen3.svg' };
  if (targetKey === 'VARIANT_MIDDLE') {
    const target = (middleMap[variant] || middleMap.A);
    recordEvent(areaId, target, false);
    setScreen(target);
  } else {
    recordEvent(areaId, targetKey, false);
    setScreen(targetKey);
  }
}

// ------------ Heatmap helpers --------------
function getHeatmapCanvas() { return document.getElementById('heatmap'); }
function getScreenImg() { return document.getElementById('screen'); }

function sizeHeatmapToImage() {
  const canvas = getHeatmapCanvas();
  const img = getScreenImg();
  if (!canvas || !img) return;
  const rect = img.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
}

function scalePoint(ev, curW, curH) {
  if (ev && Number.isFinite(ev.x) && Number.isFinite(ev.y) && ev.w > 0 && ev.h > 0) {
    return { x: ev.x * (curW / ev.w), y: ev.y * (curH / ev.h) };
  }
  return { x: ev?.x ?? 0, y: ev?.y ?? 0 };
}

function drawHeatmap() {
  const canvas = getHeatmapCanvas();
  const img = getScreenImg();
  if (!canvas || !img || canvas.style.display === 'none') return;

  sizeHeatmapToImage();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let events = [];
  try { events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); } catch(e) {}
  const misses = events.filter(e => e.miss && Number.isFinite(e.x) && Number.isFinite(e.y)).slice(-2000);
  if (!misses.length) return;

  const curW = canvas.width, curH = canvas.height;
  const baseR = Math.max(12, Math.floor(Math.min(curW, curH) * 0.04));

  misses.forEach(ev => {
    const { x, y } = scalePoint(ev, curW, curH);
    const r = baseR;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0.0, 'rgba(255,0,0,0.35)');
    g.addColorStop(1.0, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Count misclicks and draw heatmap point
(function attachMissHandler(){
  const img = document.getElementById('screen');
  if (!img) return;
  img.addEventListener('click', (e) => {
    if (e.target && e.target.id !== 'screen') return;
    setTimeout(() => {
      if (!window.__lastAreaClicked) {
        incrementCount('miss');
        const rect = img.getBoundingClientRect();
        recordEvent('miss', null, true, {
          x: Math.round(e.clientX - rect.left),
          y: Math.round(e.clientY - rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        });
        drawHeatmap();
      }
      window.__lastAreaClicked = false;
    }, 0);
  });
})();

// ------------ UI update helpers --------------
function readEvents() { try { const r = localStorage.getItem(EVENTS_KEY); return r ? JSON.parse(r) : []; } catch(e){return[]} }

function updateCountsUI() {
  const counts = readCounts();
  const variant = localStorage.getItem(VAR_KEY) || assignVariant();
  const sv = document.getElementById('summary-variant'); if (sv) sv.textContent = variant;
  const vCounts = counts[variant] || {};
  let total = 0, miss = vCounts['miss'] || 0;
  Object.keys(vCounts).forEach(k => { total += vCounts[k] || 0; });
  const st = document.getElementById('summary-total'); if (st) st.textContent = total;
  const sm = document.getElementById('summary-miss'); if (sm) sm.textContent = miss;
  const cj = document.getElementById('counts-json'); if (cj) cj.textContent = JSON.stringify(counts, null, 2);

  const events = readEvents().slice(-50).reverse();
  const el = document.getElementById('events-list');
  if (el) {
    el.innerHTML = '';
    if (events.length === 0) el.innerHTML = '<div class="muted">No events recorded yet.</div>';
    events.forEach(ev => {
      const d = document.createElement('div');
      d.style.padding = '6px 8px';
      d.style.borderBottom = '1px solid #f1f5f9';
      d.style.fontSize = '13px';
      d.innerHTML = `<strong>${ev.id}</strong> <span class="muted">(${ev.variant})</span><div class="muted">${ev.ts} ${ev.miss?'<span style="color:#c00">miss</span>':''}</div>`;
      el.appendChild(d);
    });
  }
}

// ------------ Modal wiring --------------
function openCountsModal() { const b = document.getElementById('counts-backdrop'); if (b) { b.style.display = 'flex'; updateCountsUI(); } }
function closeCountsModal() { const b = document.getElementById('counts-backdrop'); if (b) b.style.display = 'none'; }

(function wireUI(){
  const showBtn = document.getElementById('showCounts');
  if (showBtn) {
    try { showBtn.removeEventListener('click', ()=>{}); } catch(e) {}
    showBtn.addEventListener('click', openCountsModal);
  }
  const closeBtn = document.getElementById('closeCounts'); if (closeBtn) closeBtn.addEventListener('click', closeCountsModal);

  const exportJSON = document.getElementById('exportCountsJSON');
  if (exportJSON) exportJSON.addEventListener('click', () => {
    const data = { exportedAt: new Date().toISOString(), variant: localStorage.getItem(VAR_KEY), counts: readCounts(), events: readEvents() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'prototype-data-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  const exportCSV = document.getElementById('exportEventsCSV');
  if (exportCSV) exportCSV.addEventListener('click', () => {
    const events = readEvents();
    if (!events.length) { alert('No events to export'); return; }
    const rows = [['ts','variant','id','target','miss','x','y','w','h']];
    events.forEach(ev => rows.push([
      ev.ts, ev.variant, ev.id, ev.target || '',
      ev.miss ? '1' : '0',
      (ev.x ?? ''), (ev.y ?? ''), (ev.w ?? ''), (ev.h ?? '')
    ]));
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'prototype-events-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  const clearBtn = document.getElementById('clearEvents');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all stored counts and events?')) return;
    // Clear counts and events, update UI and remove heatmap overlay
    resetCounts();
    localStorage.removeItem(EVENTS_KEY);
    updateCountsUI();
    const canvas = getHeatmapCanvas();
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // hide the heatmap so it doesn't reappear until toggled
      canvas.style.display = 'none';
    }
    alert('Cleared');
  });

  const resetBtn = document.getElementById('resetCounts');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all stored counts for both variants?')) return;
    // Reset counts and also clear event log + heatmap so totals fully refresh
    resetCounts();
    localStorage.removeItem(EVENTS_KEY);
    // refresh the full UI (summary cards + json + events)
    updateCountsUI();
    const pre = document.getElementById('counts-json');
    if (pre) pre.textContent = JSON.stringify(readCounts(), null, 2);
    // clear & hide heatmap canvas
    const canvas = getHeatmapCanvas();
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      canvas.style.display = 'none';
    }
  });

  const exportCountsBtn = document.getElementById('exportCounts'); if (exportCountsBtn) exportCountsBtn.addEventListener('click', exportCounts);

  document.addEventListener('DOMContentLoaded', () => {
    const v = assignVariant();
    const label = document.getElementById('variant-label'); if (label) label.textContent = v;

    try {
      const abControls = document.getElementById('ab-controls');
      const countsPanel = document.getElementById('counts-panel');
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const smallScreen = window.innerWidth <= 768;
      if (isTouch || smallScreen) {
        if (abControls) abControls.style.display = 'none';
        if (countsPanel) countsPanel.style.display = 'none';
      }
    } catch(e){}

    const screenImg = document.getElementById('screen'); if (screenImg) screenImg.addEventListener('dragstart', e => e.preventDefault());

    // Initialize segmented toggle
    try {
      const variantToggle = document.getElementById('variantToggle');
      if (variantToggle) {
        const buttons = Array.from(variantToggle.querySelectorAll('.ab-btn'));
        function updateToggleUI(selected) {
          buttons.forEach(b => {
            const v = b.getAttribute('data-variant');
            const active = v === selected;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
        }
        const current = localStorage.getItem(VAR_KEY) || assignVariant();
        updateToggleUI(current);
        buttons.forEach(b => b.addEventListener('click', () => {
          const v = b.getAttribute('data-variant');
          setVariant(v);
          updateToggleUI(v);
          updateCountsUI();
        }));
      }
    } catch(e){}
  });
})();

// ------------ Heatmap wiring --------------
(function wireHeatmap(){
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = getHeatmapCanvas();
    if (canvas) {
      canvas.style.display = 'none';
      sizeHeatmapToImage();
    }

    // wire toggle inside DOMContentLoaded to ensure element exists
    const toggle = document.getElementById('toggleHeatmap');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const canvas = getHeatmapCanvas();
        if (!canvas) return;
        const hidden = canvas.style.display === 'none' || canvas.style.display === '';
        canvas.style.display = hidden ? 'block' : 'none';
        if (hidden) drawHeatmap();
      });
    }
  });

  window.addEventListener('resize', () => {
    const canvas = getHeatmapCanvas();
    if (!canvas || canvas.style.display === 'none') return;
    drawHeatmap();
  });

  const originalSetScreen = window.setScreen;
  window.setScreen = function(path) {
    originalSetScreen(path);
    const img = getScreenImg();
    if (img) {
      img.addEventListener('load', () => {
        const canvas = getHeatmapCanvas();
        if (canvas && canvas.style.display !== 'none') drawHeatmap();
      }, { once: true });
    }
  };
})();
