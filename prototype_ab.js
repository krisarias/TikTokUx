// ------------ Simple A/B assignment --------------
// Debug helper: detect if the script loads and capture unhandled errors (useful on GitHub Pages)
try {
  console.log('prototype_ab.js loaded', location.href);
} catch(e) {}
window.addEventListener && window.addEventListener('error', function(evt) {
  try {
    const err = { message: evt.message, filename: evt.filename, lineno: evt.lineno, colno: evt.colno, stack: (evt.error && evt.error.stack) || null, ts: new Date().toISOString() };
    try { localStorage.setItem('tt_last_js_error', JSON.stringify(err)); } catch(e) {}
    console.error('Captured JS error:', err);
  } catch(e) {}
});
const VAR_KEY = 'tt_variant';
const COUNTS_KEY = 'tt_counts_v2';
const EVENTS_KEY = 'tt_events_v1';
const TASKS_STATE_KEY = 'tt_tasks_state_v1';

// Task list (sequence requested by user)
const TASKS = [
  'Revisa tus mensajes con francini1822',
  'Revisa si tienes nuevos seguidores',
  'Mira si han respondido a uno de tus comentarios',
  'Revisa el resultado de una denuncia que pusiste',
  'Cambia los ajustes de notificaciones',
  'Cuentanos que te parecio'
];

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

// --------- Task state helpers ----------
function loadTaskState() {
  try {
    const raw = localStorage.getItem(TASKS_STATE_KEY);
    if (!raw) return { currentIndex: 0, runs: [] };
    return JSON.parse(raw);
  } catch(e) { return { currentIndex: 0, runs: [] }; }
}

function saveTaskState(state) {
  try { localStorage.setItem(TASKS_STATE_KEY, JSON.stringify(state)); } catch(e){}
}

function pushTaskEvent(type, taskIndex, extra) {
  // Use recordEvent to keep events unified; id indicates task action
  try {
    const id = type === 'start' ? 'task-start' : (type === 'finish' ? 'task-finish' : 'task-response');
    recordEvent(id, TASKS[taskIndex] || null, false, Object.assign({ taskIndex }, extra || {}));
  } catch(e){}
}

// --------- Simple modal helpers ----------
function _createModal(contentEl) {
  const backdrop = document.createElement('div');
  backdrop.style.position = 'fixed';
  backdrop.style.left = '0'; backdrop.style.top = '0'; backdrop.style.right = '0'; backdrop.style.bottom = '0';
  backdrop.style.background = 'rgba(0,0,0,0.45)';
  backdrop.style.display = 'flex';
  backdrop.style.alignItems = 'center';
  backdrop.style.justifyContent = 'center';
  backdrop.style.zIndex = '10000';
  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.borderRadius = '8px';
  box.style.padding = '14px';
  box.style.width = 'min(640px, 92%)';
  box.style.boxShadow = '0 8px 30px rgba(0,0,0,0.35)';
  box.appendChild(contentEl);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  return backdrop;
}

function showStartModal(taskIndex, onSave) {
  const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Iniciar tarea'; title.style.marginTop = '0';
  const txt = document.createElement('textarea'); txt.value = TASKS[taskIndex] || ''; txt.rows = 3; txt.style.width = '100%'; txt.readOnly = true; txt.style.marginBottom = '8px';
  const notes = document.createElement('textarea'); notes.placeholder = 'Notas de inicio (opcional)'; notes.rows = 4; notes.style.width = '100%'; notes.style.marginBottom = '8px';
  const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px';
  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Guardar inicio'; saveBtn.style.padding = '8px 12px'; saveBtn.style.background = '#0b74de'; saveBtn.style.color = '#fff'; saveBtn.style.border = 'none'; saveBtn.style.borderRadius = '6px';
  const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancelar'; cancelBtn.style.padding = '8px 12px'; cancelBtn.style.border = '1px solid #ccc'; cancelBtn.style.borderRadius = '6px';
  row.appendChild(saveBtn); row.appendChild(cancelBtn);
  container.appendChild(title); container.appendChild(txt); container.appendChild(notes); container.appendChild(row);
  const modal = _createModal(container);
  cancelBtn.addEventListener('click', () => modal.remove());
  saveBtn.addEventListener('click', () => {
    try {
      const state = loadTaskState();
      const idx = taskIndex;
      state.runs = state.runs || [];
      state.runs[idx] = state.runs[idx] || { taskIndex: idx, task: TASKS[idx] };
      state.runs[idx].startedAt = new Date().toISOString();
      if (notes.value) state.runs[idx].startNotes = notes.value;
      saveTaskState(state);
      pushTaskEvent('start', idx, { startNotes: notes.value });
      if (typeof onSave === 'function') onSave(state.runs[idx]);
    } catch(e){}
    modal.remove();
  });
}

function showNextTaskModal(nextIndex) {
  const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Siguiente tarea'; title.style.marginTop = '0';
  const txt = document.createElement('p'); txt.textContent = TASKS[nextIndex] || 'No hay más tareas'; txt.style.whiteSpace = 'pre-wrap';
  const closeBtn = document.createElement('button'); closeBtn.textContent = 'Cerrar'; closeBtn.style.padding = '8px 12px'; closeBtn.style.border = '1px solid #ccc'; closeBtn.style.borderRadius = '6px';
  container.appendChild(title); container.appendChild(txt); container.appendChild(closeBtn);
  const modal = _createModal(container);
  closeBtn.addEventListener('click', () => modal.remove());
}

function showFinalResponseModal(taskIndex) {
  const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Respuesta final'; title.style.marginTop = '0';
  const txt = document.createElement('p'); txt.textContent = TASKS[taskIndex] || ''; txt.style.whiteSpace = 'pre-wrap';
  const resp = document.createElement('textarea'); resp.rows = 6; resp.style.width = '100%'; resp.placeholder = 'Escribe tu respuesta aquí...'; resp.style.marginBottom = '8px';
  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Enviar respuesta'; saveBtn.style.padding = '8px 12px'; saveBtn.style.background = '#0b74de'; saveBtn.style.color = '#fff'; saveBtn.style.border = 'none'; saveBtn.style.borderRadius = '6px';
  const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancelar'; cancelBtn.style.padding = '8px 12px'; cancelBtn.style.border = '1px solid #ccc'; cancelBtn.style.borderRadius = '6px';
  const row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.appendChild(saveBtn); row.appendChild(cancelBtn);
  container.appendChild(title); container.appendChild(txt); container.appendChild(resp); container.appendChild(row);
  const modal = _createModal(container);
  cancelBtn.addEventListener('click', () => modal.remove());
  saveBtn.addEventListener('click', () => {
    try {
      const state = loadTaskState();
      state.runs = state.runs || [];
      state.runs[taskIndex] = state.runs[taskIndex] || { taskIndex: taskIndex, task: TASKS[taskIndex] };
      state.runs[taskIndex].response = resp.value;
      state.runs[taskIndex].finishedAt = state.runs[taskIndex].finishedAt || new Date().toISOString();
      saveTaskState(state);
      pushTaskEvent('response', taskIndex, { response: resp.value });
    } catch(e){}
    modal.remove();
  });
}

// --------- Handlers for buttons ----------
function handleStartTask() {
  try {
    const state = loadTaskState();
    const idx = state.currentIndex || 0;
    showStartModal(idx);
  } catch(e){}
}

function handleEndTask() {
  try {
    const state = loadTaskState();
    const idx = state.currentIndex || 0;
    state.runs = state.runs || [];
    state.runs[idx] = state.runs[idx] || { taskIndex: idx, task: TASKS[idx] };
    state.runs[idx].finishedAt = new Date().toISOString();
    saveTaskState(state);
    pushTaskEvent('finish', idx, {});

    // If last task, open final response modal
    if (idx >= TASKS.length - 1) {
      showFinalResponseModal(idx);
      // mark completed
      state.currentIndex = TASKS.length;
      saveTaskState(state);
      return;
    }

    // show next task text and advance index
    const next = idx + 1;
    state.currentIndex = next;
    saveTaskState(state);
    showNextTaskModal(next);
  } catch(e){}
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
  if (img) img.src = encodeURI(path);
}

// History helpers: keep a simple in-memory stack of visited screens for a back button.
window.__screenHistory = window.__screenHistory || [];
function pushCurrentToHistory() {
  try {
    const img = getScreenImg();
    if (!img) return;
    const cur = img.getAttribute('src');
    if (cur) {
      window.__screenHistory = window.__screenHistory || [];
      // avoid pushing duplicate consecutive entries
      if (window.__screenHistory.length === 0 || window.__screenHistory[window.__screenHistory.length - 1] !== cur) {
        window.__screenHistory.push(cur);
      }
    }
  } catch(e){}
}

// Exposed goBack function: pops the last screen and navigates to it. Records the event and increments counts.
window.goBack = function(areaId) {
  try {
    // If current screen is one of the pages where back should be disabled, do nothing
    const img = getScreenImg();
    const curSrc = img ? decodeURIComponent(img.getAttribute('src') || '') : '';
    const curBase = curSrc.split('/').pop().toLowerCase();
    const BACK_DISABLED = ['tconfigmsj.png', 'tmain.png'];
    if (BACK_DISABLED.includes(curBase)) {
      // no-op: back is disabled on these screens
      return;
    }

    window.__lastAreaClicked = true;
    if (!areaId) areaId = 'back';
    incrementCount(areaId);
    const hist = window.__screenHistory || [];
    const prev = hist.pop();
    window.__screenHistory = hist;
    if (prev) {
      recordEvent(areaId, prev, false);
      setScreen(prev);
    } else {
      // fallback if no history: go to the default home screen (TMain)
      recordEvent(areaId, 'images/A.Tratamiento/TMain.png', false);
      setScreen('images/A.Tratamiento/TMain.png');
    }
  } catch(e){}
};

// Track click and navigate. targetKey may be a path or 'VARIANT_MIDDLE'.
function trackAndSet(areaId, targetKey) {
  window.__lastAreaClicked = true;
  incrementCount(areaId);
  const variant = localStorage.getItem(VAR_KEY) || assignVariant();
  const middleMap = { A: 'images/A.Tratamiento/TMain.png', B: 'images/A.Tratamiento/TActv.png' };
  if (targetKey === 'VARIANT_MIDDLE') {
    const target = (middleMap[variant] || middleMap.A);
    // push current screen into history before navigating to the variant middle
    pushCurrentToHistory();
    recordEvent(areaId, target, false);
    setScreen(target);
  } else {
    // for normal navigations, push current into history so back works
    pushCurrentToHistory();
    recordEvent(areaId, targetKey, false);
    setScreen(targetKey);
  }
}

// ------------ Heatmap helpers --------------
function getHeatmapCanvas() { return document.getElementById('heatmap'); }
function getScreenImg() { return document.getElementById('screen'); }

// Helper to check whether the current displayed image matches a filename (basename)
function isCurrentScreenBasename(basename) {
  try {
    const img = getScreenImg();
    if (!img) return false;
    const src = decodeURIComponent(img.getAttribute('src') || '');
    const cur = src.split('/').pop() || '';
    return cur.toLowerCase() === (basename || '').toLowerCase();
  } catch(e) { return false; }
}

// Handler for areas that should only work when TMsj is displayed.
// areaId: identifier for counting/recording; action: optional target (image path or URL)
function handleTMsjArea(areaId, action) {
  // Behavior:
  // - If current screen is TMsj.png: act (record event) and perform provided action (open /msj or navigate to image)
  // - If current screen is TMain.png: navigate to TMsj (push history, record event)
  // - Otherwise: inert
  try {
    const cur = (getScreenImg() && decodeURIComponent(getScreenImg().getAttribute('src') || '').split('/').pop()) || '';
    const curLow = cur.toLowerCase();

    if (curLow === 'tmsj.png') {
      window.__lastAreaClicked = true;
      incrementCount(areaId);
      recordEvent(areaId, action || null, false);
      if (action && typeof action === 'string') {
        if (action.startsWith('images/')) {
          setScreen(action);
        } else if (action.startsWith('/')) {
          window.location.href = action;
        }
      }
      return false;
    }

    if (curLow === 'tmain.png') {
      // navigate from TMain to TMsj and record the click
      pushCurrentToHistory();
      window.__lastAreaClicked = true;
      incrementCount(areaId);
      recordEvent(areaId, 'images/A.Tratamiento/TMsj.png', false);
      setScreen('images/A.Tratamiento/TMsj.png');
      return false;
    }

    // inert on other screens
    return false;
  } catch (e) { return false; }
}


// Generic handler for areas that should work on most screens but be disabled on a set of screens.
// areaId: id used for counting/recording
// targetImage: path to image to navigate to (images/...), or a URL starting with '/'
// disabledBasenames: array of basenames (e.g. ['TActvFltrs.png']) where the area must be inert
function handleGlobalArea(areaId, targetImage, disabledBasenames) {
  try {
    const img = getScreenImg();
    const cur = img ? (decodeURIComponent(img.getAttribute('src') || '').split('/').pop() || '') : '';
    const curLow = cur.toLowerCase();
    const disabled = Array.isArray(disabledBasenames) ? disabledBasenames.map(s => (s||'').toLowerCase()) : [];

    if (disabled.includes(curLow)) {
      // inert
      return false;
    }

    // active: navigate to targetImage (push history), record event and increment count
    pushCurrentToHistory();
    window.__lastAreaClicked = true;
    incrementCount(areaId);
    recordEvent(areaId, targetImage, false);

    if (typeof targetImage === 'string') {
      if (targetImage.startsWith('images/')) {
        setScreen(targetImage);
      } else if (targetImage.startsWith('/')) {
        window.location.href = targetImage;
      }
    }
  } catch(e){}
  return false;
}

// Handler for areas that are active ONLY on a small set of basenames.
// enabledBasenames: array like ['TNotfSys.png'] where the area should work; otherwise inert.
function handleEnabledOn(areaId, targetImage, enabledBasenames) {
  try {
    const img = getScreenImg();
    const cur = img ? (decodeURIComponent(img.getAttribute('src') || '').split('/').pop() || '') : '';
    const curLow = cur.toLowerCase();
    const enabled = Array.isArray(enabledBasenames) ? enabledBasenames.map(s => (s||'').toLowerCase()) : [];
    if (!enabled.includes(curLow)) {
      // inert
      return false;
    }

    // active: navigate to targetImage (push history), record event and increment count
    pushCurrentToHistory();
    window.__lastAreaClicked = true;
    incrementCount(areaId);
    recordEvent(areaId, targetImage, false);

    if (typeof targetImage === 'string') {
      if (targetImage.startsWith('images/')) {
        setScreen(targetImage);
      } else if (targetImage.startsWith('/')) {
        window.location.href = targetImage;
      }
    }
  } catch(e){}
  return false;
}
// Consolidated area activation rules.
// Map lowercased area-id -> { enabledOn: [...], disabledOn: [...] }
const AREA_RULES = {
  'area-solicitudmsj': { enabledOn: ['TMsj.png'] },
  'area-msj2': { enabledOn: ['TMain.png'] },
  'area-tconfigmsj': { enabledOn: ['TMain.png'] },
  'area-tconfig': { enabledOn: ['TNotfSys.png'] },
  'area-tactfltrs': { enabledOn: ['TActv.png'] },
  'area-denuncias': { enabledOn: ['TNotfSys.png'] },
  'area-actualizaciones': { enabledOn: ['TSysDen.png'] },
  // global areas: disabled on these basenames
  'area-seguidores': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png'] },
  'area-actividad': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png'] },
  'area-notifsistema': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png'] },
  'area-main': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png'] }
};

function _normalizeBasenames(arr) { return Array.isArray(arr) ? arr.map(s => (s||'').toLowerCase()) : []; }

function isAreaActive(areaId) {
  try {
    const img = getScreenImg(); if (!img) return false;
    const basename = (decodeURIComponent(img.getAttribute('src') || '').split('/').pop() || '').toLowerCase();
    const rule = AREA_RULES[(areaId||'').toLowerCase()];
    if (!rule) return true; // default: active
    if (rule.enabledOn) {
      const enabled = _normalizeBasenames(rule.enabledOn);
      return enabled.includes(basename);
    }
    if (rule.disabledOn) {
      const disabled = _normalizeBasenames(rule.disabledOn);
      return !disabled.includes(basename);
    }
    return true;
  } catch(e) { return true; }
}

function updateAreasActive() {
  try {
    const areas = Array.from(document.querySelectorAll('map#phone-map area'));
    areas.forEach(area => {
      const el = document.getElementById(area.id);
      if (!el) return;
      const active = isAreaActive(area.id);
      el.style.pointerEvents = active ? 'auto' : 'none';
      el.style.cursor = active ? 'pointer' : 'default';
    });
  } catch(e) {}
}

// Any-touch behaviours (TConfigMsj => back, TActvFltrs => go to TActv)
window.__anyTouchHandler = window.__anyTouchHandler || null;
function backFromTConfigMsj(areaId) {
  try {
    window.__lastAreaClicked = true;
    if (!areaId) areaId = 'area-TConfigMsj-any';
    incrementCount(areaId);
    const hist = window.__screenHistory || [];
    const prev = hist.pop();
    window.__screenHistory = hist;
    if (prev) {
      recordEvent(areaId, prev, false);
      setScreen(prev);
    } else {
      recordEvent(areaId, 'images/A.Tratamiento/TMain.png', false);
      setScreen('images/A.Tratamiento/TMain.png');
    }
  } catch(e){}
}

function backFromTActvFltrs(areaId) {
  try {
    window.__lastAreaClicked = true;
    if (!areaId) areaId = 'area-TActFltrs-any';
    incrementCount(areaId);
    recordEvent(areaId, 'images/A.Tratamiento/TActv.png', false);
    setScreen('images/A.Tratamiento/TActv.png');
  } catch(e){}
}

function updateAnyTouchBehaviors() {
  try {
    const img = getScreenImg(); if (!img) return;
    const src = decodeURIComponent(img.getAttribute('src') || '');
    const basename = (src.split('/').pop() || '').toLowerCase();

    // remove existing
    if (window.__anyTouchHandler) {
      document.removeEventListener('click', window.__anyTouchHandler, true);
      window.__anyTouchHandler = null;
    }

    if (basename === 'tconfigmsj.png' || basename === 'tactvfltrs.png') {
      const handler = function(evt) {
        try {
          const container = document.querySelector('.screen-wrap');
          if (!container) return;
          const rect = container.getBoundingClientRect();
          if (evt.clientX < rect.left || evt.clientX > rect.right || evt.clientY < rect.top || evt.clientY > rect.bottom) return;
          evt.preventDefault();
          evt.stopPropagation();
          if (basename === 'tconfigmsj.png') backFromTConfigMsj('area-TConfigMsj-any');
          else if (basename === 'tactvfltrs.png') backFromTActvFltrs('area-TActFltrs-any');
        } catch(e){}
      };
      window.__anyTouchHandler = handler;
      document.addEventListener('click', handler, true);
    }
  } catch(e){}
}

// ---------- Area overlay helpers (visual purple markers) ----------
function removeAreaOverlays() {
  try {
    const container = document.querySelector('.screen-wrap');
    if (!container) return;
    const prev = container.querySelectorAll('.area-overlay');
    prev.forEach(n => n.remove());
  } catch(e) {}
}

function computeBBoxFromCoords(shape, coordsArr) {
  // coordsArr: array of numbers in natural image coordinate space
  if (!Array.isArray(coordsArr) || coordsArr.length === 0) return null;
  if (!shape) shape = 'rect';
  shape = shape.toLowerCase();
  if (shape === 'rect') {
    const x1 = Number(coordsArr[0] || 0), y1 = Number(coordsArr[1] || 0);
    const x2 = Number(coordsArr[2] || 0), y2 = Number(coordsArr[3] || 0);
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), shape: 'rect' };
  }
  if (shape === 'circle') {
    const cx = Number(coordsArr[0] || 0), cy = Number(coordsArr[1] || 0), r = Number(coordsArr[2] || 0);
    return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, shape: 'circle' };
  }
  // polygon or other: compute bounding box
  let xs = [], ys = [];
  for (let i = 0; i < coordsArr.length; i += 2) {
    xs.push(Number(coordsArr[i] || 0));
    ys.push(Number(coordsArr[i + 1] || 0));
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY), shape: 'poly' };
}

function createAreaOverlays() {
  try {
    const img = getScreenImg();
    if (!img) return;
    const container = img.closest('.screen-wrap') || document.querySelector('.screen-wrap');
    if (!container) return;
    // remove any previous overlays
    removeAreaOverlays();

    const naturalW = img.naturalWidth || img.width || img.clientWidth;
    const naturalH = img.naturalHeight || img.height || img.clientHeight;
    if (!naturalW || !naturalH) return;

    const rect = img.getBoundingClientRect();
    const scaleX = rect.width / naturalW;
    const scaleY = rect.height / naturalH;

    const areas = Array.from(document.querySelectorAll('map#phone-map area'));
    areas.forEach(area => {
      try {
        // Skip overlays for areas that are not active on the current screen
        if (!isAreaActive(area.id)) return;
        const coords = (area.getAttribute('coords') || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
        if (!coords.length) return;
        const shape = (area.getAttribute('shape') || 'rect').toLowerCase();
        const bbox = computeBBoxFromCoords(shape, coords);
        if (!bbox) return;

        // scale
        const left = Math.round(bbox.x * scaleX);
        const top = Math.round(bbox.y * scaleY);
        const width = Math.max(2, Math.round(bbox.w * scaleX));
        const height = Math.max(2, Math.round(bbox.h * scaleY));

        const ov = document.createElement('div');
        ov.className = 'area-overlay ' + (bbox.shape === 'circle' ? 'circle' : (bbox.shape === 'poly' ? 'poly' : 'rect'));
        ov.style.left = left + 'px';
        ov.style.top = top + 'px';
        ov.style.width = width + 'px';
        ov.style.height = height + 'px';
        ov.setAttribute('data-area-id', area.id || '');
        ov.title = area.getAttribute('title') || area.getAttribute('alt') || area.id || '';
        // append overlay above image within screen-wrap
        container.appendChild(ov);
      } catch (e) { /* per-area */ }
    });
  } catch(e) {}
}


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

    // wire task buttons
    try {
      const startBtn = document.getElementById('startTaskBtn');
      const endBtn = document.getElementById('endTaskBtn');
      if (startBtn) startBtn.addEventListener('click', handleStartTask);
      if (endBtn) endBtn.addEventListener('click', handleEndTask);
    } catch(e){}

  // Ensure areas and any-touch handlers are initialized
  try { updateAreasActive(); } catch(e){}
  try { createAreaOverlays(); } catch(e){}
  try { updateAnyTouchBehaviors(); } catch(e){}

    // image selector wiring (populated from HTML options)
    try {
      const selector = document.getElementById('imageSelector');
      if (selector) {
        // set initial value if the screen src matches an option
        try { const cur = document.getElementById('screen').getAttribute('src'); if (cur) selector.value = cur; } catch(e){}
        selector.addEventListener('change', (ev) => {
          const v = ev.target.value;
          // record current screen in history so the selector can be 'backed' out of
          pushCurrentToHistory();
          setScreen(v);
          // hide & clear heatmap while switching screens
          const canvas = getHeatmapCanvas();
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0,0,canvas.width,canvas.height);
            canvas.style.display = 'none';
          }
          try { updateAreasActive(); } catch(e){}
          try { updateAnyTouchBehaviors(); } catch(e){}
        });
      }
    } catch(e){}

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
    // always re-position overlays on resize; redraw heatmap only when visible
    try { createAreaOverlays(); } catch(e){}
    try { updateAreasActive(); } catch(e){}
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
  try { updateAreasActive(); } catch(e){}
  try { createAreaOverlays(); } catch(e){}
  try { updateAnyTouchBehaviors(); } catch(e){}
      }, { once: true });
    }
  };
})();
