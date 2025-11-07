"use strict";
try {
  console.log('prototype_ab.js loaded', location.href);
} catch(e) {}
window.addEventListener && window.addEventListener('error', function(evt) {
  try {
    const err = { message: evt.message, filename: evt.filename, lineno: evt.lineno, colno: evt.colno, stack: (evt.error && evt.error.stack) || null, ts: isoTimestamp() };
    try { localStorage.setItem('tt_last_js_error', JSON.stringify(err)); } catch(e) {}
    console.error('Captured JS error:', err);
  } catch(e) {}
});

const VAR_KEY = 'tt_variant';
const COUNTS_KEY = 'tt_counts_v2';
const EVENTS_KEY = 'tt_events_v1';
const TASKS_STATE_KEY = 'tt_tasks_state_v1';
const ALLOW_ANY_TOUCH = false;

// Return an ISO-like timestamp in the browser's local timezone, including offset
function isoTimestamp(d = new Date()) {
  try {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    // timezone offset in minutes (note: getTimezoneOffset returns minutes behind UTC, so positive means west of UTC)
    const tzMin = -d.getTimezoneOffset();
    const sign = tzMin >= 0 ? '+' : '-';
    const absMin = Math.abs(tzMin);
    const tzH = String(Math.floor(absMin / 60)).padStart(2, '0');
    const tzM = String(absMin % 60).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${sign}${tzH}:${tzM}`;
  } catch (e) {
    return new Date().toISOString();
  }
}

// Lightweight toast helper used across the app. Creates a small transient
// message in the bottom of the viewport. Safe to call even if DOM is not ready.
function showToast(msg, duration) {
  try {
    duration = Number(duration) || 3000;
    const id = '__tt_toast';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      // Use the stylesheet class so styles live in styles.css
      el.className = 'app-toast';
      document.body.appendChild(el);
    } else {
      // ensure proper class in case it was changed
      el.className = 'app-toast';
    }

    el.textContent = String(msg || '');

    // show by setting opacity (CSS transition handles fade)
    requestAnimationFrame(() => { try { el.style.opacity = '1'; } catch(e){} });

    // clear previous timer if any
    if (el.__toastTimer) clearTimeout(el.__toastTimer);
    el.__toastTimer = setTimeout(() => {
      try { el.style.opacity = '0'; } catch(e){}
      setTimeout(() => { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch(e){} }, 300);
    }, duration);
  } catch(e) { /* swallowing to avoid breaking host page */ }
}

// Prompt the participant for their name if not already stored
// askForParticipantName optionally accepts a callback that will be invoked with the saved value
// (or null if skipped). This allows callers (like export functions) to prompt the user
// and continue the export after the name is provided.
function askForParticipantName(onSaved) {
  try {
    const key = 'tt_participant_name';
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Hola! Estamos probando un nuevo diseño.'; title.className = 'modal-title';
  const intro = document.createElement('p'); intro.textContent = '¿Nos das tu nombre para identificar este test por favor?'; intro.className = 'info-text';
  const txt = document.createElement('input'); txt.type = 'text'; txt.className = 'js-modal-textarea'; txt.placeholder = 'Escribe tu nombre';
    const row = document.createElement('div'); row.className = 'js-modal-row';
    const saveBtn = document.createElement('button'); saveBtn.className = 'btn-primary'; saveBtn.textContent = 'Guardar';
    const skipBtn = document.createElement('button'); skipBtn.className = 'btn-secondary'; skipBtn.textContent = 'Omitir';
    row.appendChild(saveBtn); row.appendChild(skipBtn);
  container.appendChild(title); container.appendChild(intro); container.appendChild(txt); container.appendChild(row);
    const modal = _createModal(container);

    saveBtn.addEventListener('click', () => {
      try {
        const v = (txt.value || '').trim();
        if (v) {
          try { localStorage.setItem(key, v); } catch(e){}
          // Inform the participant what to do next after saving their name
          try {
            showToast('Gracias! ' + 
              ". Presiona el botón \"Instrucciones\" cuando estés listo. Te dará una pequeña tarea que hacer; cuando la completes presiona el botón \"terminar tarea\".", 9000);
          } catch(e) {
            // fallback shorter toast
            showToast('Nombre guardado: ' + v, 2800);
          }
        }
      } catch(e){}
      try { modal.remove(); } catch(e){}
      try { if (typeof onSaved === 'function') onSaved((txt.value||'').trim() || null); } catch(e){}
    });

    skipBtn.addEventListener('click', () => { try { modal.remove(); } catch(e){} try { if (typeof onSaved === 'function') onSaved(null); } catch(e){} });
    setTimeout(()=>{ try{ txt.focus(); }catch(e){} }, 50);
    return null;
  } catch(e) { return null; }
}

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
    try { localStorage.setItem(VAR_KEY, v); } catch(e){}
  }
  return v;
}

function setVariant(v) {
  try { localStorage.setItem(VAR_KEY, v); } catch(e){}
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

  // Update image selector options and current screen to match selected variant
  try {
    const selector = document.getElementById('imageSelector');
    // ensure selector options keep a reference to their A-base path
    if (selector) {
      const opts = Array.from(selector.options || []);
      opts.forEach(o => {
        if (!o.dataset.baseA) o.dataset.baseA = o.value;
        // set option value to variant-specific path
        o.value = computeVariantPathFromBase(o.dataset.baseA, v);
      });

      // derive base A for current screen and set selector value to the mapped variant path
      const curSrc = (document.getElementById('screen') && document.getElementById('screen').getAttribute('src')) || '';
      const baseA = deriveBaseAFromSrc(curSrc || opts[0] && (opts[0].dataset.baseA || ''));
      const mapped = computeVariantPathFromBase(baseA, v);
      try { selector.value = mapped; } catch(e){}
    }

    // change the visible screen: always go to the variant's MAIN screen
    try {
      if (v === 'A') {
        // explicit A main
        setScreen('images/A.Tratamiento/TMain.png');
      } else {
        // explicit B main
        setScreen('images/B.Control/CMain.png');
      }
    } catch(e){}
  } catch(e){}
}

// Attempt to derive the original A base path from any current src; used when toggling
function deriveBaseAFromSrc(src) {
  try {
    if (!src) return 'images/A.Tratamiento/TMain.png';
    const s = decodeURIComponent(src || '');
    if (s.indexOf('/A.Tratamiento/') !== -1) return s;
    if (s.indexOf('/B.Control/') !== -1) {
      const parts = s.split('/');
      const fn = parts.pop() || '';

      // 1) reverse lookup from explicit map
      for (const [aName, bName] of Object.entries(VARIANT_FILE_MAP)) {
        if (bName === fn) return 'images/A.Tratamiento/' + aName;
      }

      // 2) heuristic/fuzzy: remove extension and leading 'C' (allow 'C.' etc.) and try to match to T* keys
      const fnNoExt = fn.replace(/\.[^.]+$/, '');
      const stripped = fnNoExt.replace(/^c[.\-_]?/i, '');
      const targetNorm = _normalizeForMatch(stripped);
      for (const aName of Object.keys(VARIANT_FILE_MAP)) {
        const aNoExt = aName.replace(/\.[^.]+$/, '');
        const aStripped = aNoExt.replace(/^t/i, '');
        if (_normalizeForMatch(aStripped) === targetNorm) return 'images/A.Tratamiento/' + aName;
      }
    }
    // fallback
    return 'images/A.Tratamiento/TMain.png';
  } catch(e){ return 'images/A.Tratamiento/TMain.png'; }
}

// --- Static mapping and known B filenames (generated from repo contents) ---
// Canonical B.Control filenames (kept in sync with images/B.Control/)
const B_FILENAMES = [
  'C.Actividad.png',
  'C.NuevosSeguidores.png',
  'CSolicitudMensaje.png',
  'CActvFltrs.png',
  'CConfig.png',
  'CConfigMsj.png',
  'CMain.png',
  'CMsj.png',
  'CNotfSys.png',
  'CSysDen.png'
];

// Explicit A -> B filename map where the simple heuristic would fail
const VARIANT_FILE_MAP = {
  'TMain.png': 'CMain.png',
  'TMsj.png': 'CMsj.png',
  'TActvFltrs.png': 'CActvFltrs.png',
  'TConfig.png': 'CConfig.png',
  'TConfigMsj.png': 'CConfigMsj.png',
  'TNotfSys.png': 'CNotfSys.png',
  'TSysDen.png': 'CSysDen.png',
  'TPersonas.png': 'C.NuevosSeguidores.png',
  'TActv.png': 'C.Actividad.png'
};

function _normalizeForMatch(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Enhanced variant path computation that uses explicit mapping and verifies existence
function computeVariantPathFromBase(baseAPath, variant) {
  try {
    if (!baseAPath) return baseAPath;
    if (variant === 'A') return baseAPath;
    const parts = baseAPath.split('/');
    const aName = parts.pop();

    // 1) explicit mapping
    if (VARIANT_FILE_MAP[aName]) {
      const candidate = 'images/B.Control/' + VARIANT_FILE_MAP[aName];
      // verify existence in B_FILENAMES (best-effort, embedded list)
      if (B_FILENAMES.includes(VARIANT_FILE_MAP[aName])) return candidate;
    }

    // 2) heuristic: C + rest
    const heuristic = 'C' + aName.slice(1);
    if (B_FILENAMES.includes(heuristic)) return parts.concat([heuristic]).join('/').replace('/A.Tratamiento/', '/B.Control/');

    // 3) same filename in B (rare)
    if (B_FILENAMES.includes(aName)) return parts.concat([aName]).join('/').replace('/A.Tratamiento/', '/B.Control/');

    // 4) normalized fuzzy match (strip non-alnum and compare core)
    const targetNorm = _normalizeForMatch(aName.replace(/^t/i, ''));
    for (const bfn of B_FILENAMES) {
      if (_normalizeForMatch(bfn.replace(/^c/i, '')) === targetNorm) {
        return parts.concat([bfn]).join('/').replace('/A.Tratamiento/', '/B.Control/');
      }
    }

    // fallback: don't point to a non-existent B path; return original A path
    return baseAPath;
  } catch (e) { return baseAPath; }
}

function readCounts() {
  const raw = localStorage.getItem(COUNTS_KEY);
  try { return raw ? JSON.parse(raw) : { A: {}, B: {} }; } catch(e) { return { A: {}, B: {} }; }
}

function saveCounts(obj) { localStorage.setItem(COUNTS_KEY, JSON.stringify(obj)); }

function incrementCount(areaId) {
  // Only count clicks/misses while a task run is active (started and not finished).
  // Allow counting for special task events (ids starting with 'task-').
  try {
    const aid = String(areaId || '');
    if (!aid.startsWith('task-')) {
      const state = loadTaskState();
      const idx = state?.currentIndex ?? 0;
      const run = state?.runs && state.runs[idx];
      if (!run || !run.startedAt || run.finishedAt) {
        // Not currently recording; return current counts without incrementing
        return readCounts();
      }
    }
  } catch(e) {}

  const v = localStorage.getItem(VAR_KEY) || assignVariant();
  const counts = readCounts();
  if (!counts[v]) counts[v] = {};
  counts[v][areaId] = (counts[v][areaId] || 0) + 1;
  saveCounts(counts);
  return counts;
}

// Record an event to the events log (keeps recent history); also used for export
// en recordEvent(...)
function recordEvent(areaId, target, isMiss, coords) {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];

    // toma taskIndex actual (si existe)
    let taskIndex = null;
    try { taskIndex = (loadTaskState()?.currentIndex ?? null); } catch(e){}

    const img = getScreenImg();
    const screenPath = img ? decodeURIComponent(img.getAttribute('src') || '') : null;

    // If not during an active run, skip recording non-task events.
    try {
      const aid = String(areaId || '');
      if (!aid.startsWith('task-')) {
        const state = loadTaskState();
        const idx = state?.currentIndex ?? 0;
        const run = state?.runs && state.runs[idx];
        if (!run || !run.startedAt || run.finishedAt) {
          return null;
        }
      }
    } catch(e) {}

    const ev = {
      id: areaId,
      target: target || null,
      variant: localStorage.getItem(VAR_KEY) || assignVariant(),
      miss: !!isMiss,
      ts: isoTimestamp(),
      ts_ms: Date.now(),
      screen: screenPath,
      taskIndex,                         // ← NUEVO
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
  backdrop.className = 'js-modal-backdrop';
  const box = document.createElement('div');
  box.className = 'js-modal-box';
  box.appendChild(contentEl);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  return backdrop;
}

function showStartModal(taskIndex, onSave) {
  const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Iniciar tarea'; title.className = 'modal-title';
  const txt = document.createElement('textarea'); txt.value = TASKS[taskIndex] || ''; txt.rows = 3; txt.className = 'js-modal-textarea'; txt.readOnly = true;
  const notes = document.createElement('textarea'); notes.placeholder = 'Notas de inicio (opcional)'; notes.rows = 4; notes.className = 'js-modal-textarea';
  const row = document.createElement('div'); row.className = 'js-modal-row';
  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Guardar inicio'; saveBtn.className = 'btn-primary';
  const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancelar'; cancelBtn.className = 'btn-secondary';
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
      state.runs[idx].startedAt = isoTimestamp();
      if (notes.value) state.runs[idx].startNotes = notes.value;
      saveTaskState(state);
      pushTaskEvent('start', idx, { startNotes: notes.value });
      if (typeof onSave === 'function') onSave(state.runs[idx]);
    } catch(e){}
    // make sure we don't allow duplicate saves
    saveBtn.disabled = true;
    setTimeout(()=>{ saveBtn.disabled = false; }, 600);
    // focus returned to main screen; close modal
    modal.remove();
  });
  // focus notes for faster input on mobile
  setTimeout(()=>{ try{ notes.focus(); }catch(e){} }, 50);
}

function showNextTaskModal(nextIndex) {
  const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Siguiente tarea'; title.className = 'modal-title';
  const txt = document.createElement('p'); txt.textContent = TASKS[nextIndex] || 'No hay más tareas'; txt.style.whiteSpace = 'pre-wrap';
  const closeBtn = document.createElement('button'); closeBtn.textContent = 'Cerrar'; closeBtn.className = 'btn-close';
  container.appendChild(title); container.appendChild(txt); container.appendChild(closeBtn);
  const modal = _createModal(container);
  closeBtn.addEventListener('click', () => modal.remove());
}

function showFinalResponseModal(taskIndex) {
  const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Respuesta final'; title.className = 'modal-title';
  const txt = document.createElement('p'); txt.textContent = TASKS[taskIndex] || ''; txt.style.whiteSpace = 'pre-wrap';
  const resp = document.createElement('textarea'); resp.rows = 6; resp.className = 'js-modal-textarea'; resp.placeholder = 'Escribe tu respuesta aquí...';
  // Instrucción para descargar y enviar el archivo justo debajo del textarea
  const info = document.createElement('p');
  info.textContent = 'A continuación, por favor descarga el archivo que va a aparecer y envíaselo a Jimena o Krisly.';
  info.className = 'info-text';
  const saveBtn = document.createElement('button'); saveBtn.textContent = 'Enviar respuesta'; saveBtn.className = 'btn-primary';
  const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancelar'; cancelBtn.className = 'btn-secondary';
  const row = document.createElement('div'); row.className = 'js-modal-row'; row.appendChild(saveBtn); row.appendChild(cancelBtn);
  container.appendChild(title); container.appendChild(txt); container.appendChild(resp); container.appendChild(info); container.appendChild(row);
  const modal = _createModal(container);
  cancelBtn.addEventListener('click', () => modal.remove());
  saveBtn.addEventListener('click', () => {
    try {
      const state = loadTaskState();
      state.runs = state.runs || [];
      state.runs[taskIndex] = state.runs[taskIndex] || { taskIndex: taskIndex, task: TASKS[taskIndex] };
      state.runs[taskIndex].response = resp.value;
      state.runs[taskIndex].finishedAt = state.runs[taskIndex].finishedAt || isoTimestamp();
      saveTaskState(state);
      pushTaskEvent('response', taskIndex, { response: resp.value });
    } catch(e){}
    try {
      // Prevent duplicate submission
      saveBtn.disabled = true;
      setTimeout(()=>{ saveBtn.disabled = false; }, 800);

      // If on mobile, automatically export results (including the just-saved comment)
      if (typeof isMobileDevice === 'function' && isMobileDevice()) {
        try { exportCounts(); } catch(e){}
        try { showToast('envia esto a Jimena o Krisly', 5000); } catch(e){}
      }
    } catch(e){}
    modal.remove();
  });
  // focus textarea for quick input on mobile
  setTimeout(()=>{ try{ resp.focus(); }catch(e){} }, 50);
}

// Helper: detect mobile/touch or small screen devices
function isMobileDevice() {
  try {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const smallScreen = (window.innerWidth || document.documentElement.clientWidth || 0) <= 768;
    return isTouch || smallScreen;
  } catch(e) { return false; }
}

// helper to mark a task as started (used by UI helpers)
function startTaskAtIndex(idx) {
  try {
    const state = loadTaskState();
    state.currentIndex = idx;
    state.runs = state.runs || [];
    state.runs[idx] = state.runs[idx] || { taskIndex: idx, task: TASKS[idx] };
    state.runs[idx].startedAt = state.runs[idx].startedAt || isoTimestamp();
    saveTaskState(state);
    pushTaskEvent('start', idx, {});
  } catch(e) {}
}

// Prevent rapid double-activations of start/end task actions and provide
// a small visual disable to make the interaction feel more deliberate.
function setTaskButtonsDisabled(disabled) {
  try {
    const s = document.getElementById('startTaskBtn');
    const e = document.getElementById('endTaskBtn');
    if (s) s.disabled = !!disabled;
    if (e) e.disabled = !!disabled;
  } catch(e){}
}

// show a lightweight instruction modal (read-only) for a task index
function showInstructionModal(idx) {
  try {
    const container = document.createElement('div');
  const title = document.createElement('h3'); title.textContent = 'Instrucción'; title.className = 'modal-title';
  const intro = document.createElement('p'); intro.textContent = 'Estamos probando cuál diseño de interfaz es mejor.'; intro.className = 'info-text';
  const txt = document.createElement('p'); txt.textContent = TASKS[idx] || ''; txt.style.whiteSpace = 'pre-wrap'; txt.className = 'modal-paragraph';
  const row = document.createElement('div'); row.className = 'js-modal-row';
  const startBtn = document.createElement('button'); startBtn.textContent = 'Comenzar tarea'; startBtn.className = 'btn-primary';
  const closeBtn = document.createElement('button'); closeBtn.textContent = 'Cerrar'; closeBtn.className = 'btn-close';
    row.appendChild(startBtn); row.appendChild(closeBtn);
    container.appendChild(title); container.appendChild(intro); container.appendChild(txt); container.appendChild(row);
    const modal = _createModal(container);
    closeBtn.addEventListener('click', () => modal.remove());
    startBtn.addEventListener('click', () => {
      try { startTaskAtIndex(idx); } catch(e){}
      modal.remove();
    });
  } catch(e) {}
}

// --------- Handlers for buttons ----------
function handleStartTask() {
  try {
    if (window.__taskActionInProgress) return;
    window.__taskActionInProgress = true;
    setTaskButtonsDisabled(true);

    const state = loadTaskState();
    const idx = state.currentIndex || 0;

    const hasStarted = state.runs && state.runs[idx] && state.runs[idx].startedAt;
    if (!hasStarted) {
      console.log('[AB] startTask: starting idx', idx);
      startTaskAtIndex(idx);
      showInstructionModal(idx);
    } else {
      console.log('[AB] startTask: already started, showing instruction idx', idx);
      showInstructionModal(idx);
    }

    // Feedback visual si existe el botón
    const btn = document.getElementById('startTaskBtn');
    if (btn) {
      btn.disabled = true;
      setTimeout(() => { btn.disabled = false; }, 300);
    }
  } catch (e) {
    console.error('[AB] handleStartTask error', e);
    alert('No se pudo iniciar/mostrar la instrucción. Revisa la consola.');
  }
  // re-enable after small delay to avoid accidental double presses
  setTimeout(()=>{ window.__taskActionInProgress = false; setTaskButtonsDisabled(false); }, 700);
}

function handleEndTask() {
  try {
    if (window.__taskActionInProgress) return;
    window.__taskActionInProgress = true;
    setTaskButtonsDisabled(true);

    const state = loadTaskState();
    const idx = state.currentIndex || 0;

    // Marcar fin de la tarea actual
    state.runs = state.runs || [];
    state.runs[idx] = state.runs[idx] || { taskIndex: idx, task: TASKS[idx] };
    state.runs[idx].finishedAt = isoTimestamp();
    saveTaskState(state);
    pushTaskEvent('finish', idx, {});

    // ¿Última tarea?
    if (idx >= TASKS.length - 1) {
      // Abrir el modal final (único que permite escribir)
      showFinalResponseModal(idx);
      // Marcar completado
      state.currentIndex = TASKS.length;
      saveTaskState(state);
      return;
    }

    const next = idx + 1;
    // Avanzar índice y mostrar instrucción de la siguiente tarea
    state.currentIndex = next;
    saveTaskState(state);

    // Si la siguiente instrucción pide la respuesta final (p.ej. "Cuentanos que te parecio"),
    // abrir el modal de respuesta inmediatamente para evitar un click extra.
    try {
      const nextTxt = (TASKS[next] || '').toString().toLowerCase();
      if (nextTxt.includes('cuentanos que te parecio') || nextTxt.includes('cuéntanos que te pareció') || nextTxt.includes('cuentanos') && nextTxt.includes('parecio')) {
        try { showFinalResponseModal(next); } catch(e) { showInstructionModal(next); }
        return;
      }
    } catch(e) {}

    // comportamiento normal: mostrar la instrucción siguiente
    showInstructionModal(next);
  } catch(e){
    console.error('[AB] handleEndTask error', e);
  }
    // re-enable shortly after finishing
    setTimeout(()=>{ window.__taskActionInProgress = false; setTaskButtonsDisabled(false); }, 700);
}

function resetCounts() {
  const obj = { A: {}, B: {} };
  saveCounts(obj);
  return obj;
}

// Summarize miss events across all recorded events. Returns total and a
// per-screen breakdown (basename -> count). Useful for exports.
function getMissSummary() {
  try {
    const events = readEvents();
    const misses = events.filter(e => e && e.miss);
    const byScreen = {};
    misses.forEach(ev => {
      // Prefer an explicit recorded screen path, fall back to target if present
      const screenPath = ev.screen || ev.target || '';
      const basename = (screenPath.split && screenPath.split('/').pop && screenPath.split('/').pop()) || 'unknown';
      const key = (basename || 'unknown').toString();
      byScreen[key] = (byScreen[key] || 0) + 1;
    });
    return { total: misses.length, byScreen };
  } catch(e) { return { total: 0, byScreen: {} }; }
}

function exportCounts() {
  const data = readCounts();
  const missSummary = getMissSummary();
  // include events and task state so exported file contains timestamps and task metadata
  const events = readEvents();
  const tasks = loadTaskState();
  // Ensure participant name exists; if not, prompt and resume export after save
  try {
    const p = localStorage.getItem('tt_participant_name');
    if (!p) {
      askForParticipantName(function() {
        // resume export after name entry; slight delay to allow modal teardown
        setTimeout(() => { try { exportCounts(); } catch(e){} }, 120);
      });
      return;
    }
  } catch(e) {}

  const exported = { exportedAt: isoTimestamp(), exportedAtMs: Date.now(), variant: localStorage.getItem(VAR_KEY), counts: data, events: events, missSummary, tasks };
  try { exported.participantName = localStorage.getItem('tt_participant_name') || null; } catch(e) { exported.participantName = null; }
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prototype-clicks-' + isoTimestamp().slice(0,19).replace(/[:T]/g,'-') + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  try { clearAllCookies(); } catch(e){}
  try { showPostExportRestartModal(JSON.stringify(exported, null, 2)); } catch(e){}
}


function exportExperimentJSON() {
  const variant = localStorage.getItem(VAR_KEY) || assignVariant();
  const counts  = readCounts();
  const events  = readEvents();
  const missSummary = getMissSummary();

  // reconstruye runs + duraciones
  const state = loadTaskState();
  const runs = (state?.runs || []).map(r => {
    const started = r.startedAt ? Date.parse(r.startedAt) : null;
    const finished = r.finishedAt ? Date.parse(r.finishedAt) : null;
    return {
      index: r.taskIndex,
      task: r.task,
      startedAt: r.startedAt || null,
      finishedAt: r.finishedAt || null,
      durationMs: (started && finished) ? (finished - started) : null,
      response: r.response || null,
      startNotes: r.startNotes || null,
      success: Boolean(finished) // puedes afinar esto si exiges “evento objetivo”
    };
  });

  // Ensure participant name exists; if not, prompt and resume export after save
  try {
    const p = localStorage.getItem('tt_participant_name');
    if (!p) {
      askForParticipantName(function() {
        setTimeout(() => { try { exportExperimentJSON(); } catch(e){} }, 120);
      });
      return;
    }
  } catch(e) {}

  // metadatos de sesión
  const meta = {
    sessionId: localStorage.getItem('tt_session_id') || (function(){
      const id = 'sess_' + Math.random().toString(36).slice(2);
      try { localStorage.setItem('tt_session_id', id); } catch(e){}
      return id;
    })(),
    participantId: localStorage.getItem('tt_participant_id') || null,
    assignedVariantAt: localStorage.getItem('tt_variant_assigned_at') || null,
    userAgent: navigator.userAgent,
    isTouch: (('ontouchstart' in window) || (navigator.maxTouchPoints>0)),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    participantName: localStorage.getItem('tt_participant_name') || null,
    schemaVersion: '2',
    prototypeVersion: (window.__PROTOTYPE_VERSION__ || null)
  };

  // KPIs agregados rápidos
  const perVariantTotals = {};
  for (const [k,obj] of Object.entries(counts||{})) {
    let s=0; if (obj && typeof obj==='object') {
      for (const [kk,v] of Object.entries(obj)) if (kk!=='miss' && typeof v==='number') s+=v;
    }
    perVariantTotals[k]=s;
  }

  const payload = {
    exportedAt: isoTimestamp(),
    variant,
    meta,
    counts,
    perVariantTotals,
    missSummary,
    tasks: runs,
    events
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'experiment-'+isoTimestamp().slice(0,19).replace(/[:T]/g,'-')+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  try { clearAllCookies(); } catch(e){}
  try { showPostExportRestartModal(JSON.stringify(payload, null, 2)); } catch(e){}
}
// ------------ Navigation + tracking --------------

// Reset all counters, events and task state to a clean start
function resetAllData(reloadAfter = false) {
  try {
    // Reset counts
    resetCounts();
    // Clear events
    try { localStorage.removeItem(EVENTS_KEY); } catch(e){}
    // Reset tasks state to initial
    try { localStorage.setItem(TASKS_STATE_KEY, JSON.stringify({ currentIndex: 0, runs: [] })); } catch(e){}
    // Clear any in-memory history
    try { window.__screenHistory = []; } catch(e){}

    // Update UI: counts, heatmap, overlays
    try { updateCountsUI(); } catch(e){}
    try {
      const canvas = getHeatmapCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        canvas.style.display = 'none';
      }
    } catch(e){}
    try { removeAreaOverlays(); } catch(e){}

    // Reset current screen to variant main
    try {
      const v = localStorage.getItem(VAR_KEY) || assignVariant();
      if (v === 'A') setScreen('images/A.Tratamiento/TMain.png'); else setScreen('images/B.Control/CMain.png');
    } catch(e){}

    if (reloadAfter) {
      try { setTimeout(() => { location.reload(); }, 250); } catch(e){}
    }
  } catch(e){}
}

function clearAllCookies() {
  try {
    const pairs = document.cookie ? document.cookie.split(';') : [];
    pairs.forEach(function(pair){
      try {
        const idx = pair.indexOf('=');
        const name = idx > -1 ? pair.substr(0, idx).trim() : pair.trim();
        // expire for path=/ and try with domain=hostname
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        try { document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + location.hostname; } catch(e){}
      } catch(e){}
    });
  } catch(e){}

  // Also clear known localStorage keys and sessionStorage 
  try {
    const keys = [COUNTS_KEY, EVENTS_KEY, TASKS_STATE_KEY, VAR_KEY, 'tt_session_id', 'tt_participant_id', 'tt_variant_assigned_at', 'tt_last_js_error'];
    keys.forEach(k => { try { if (k) localStorage.removeItem(k); } catch(e){} });
    try { sessionStorage.clear(); } catch(e){}
    try { showToast('Intento de borrado de cookies y localStorage realizado', 3500); } catch(e){}
  } catch(e) {}
}


// Show a small modal right after export offering to restart counters/tasks
function showPostExportRestartModal(jsonString) {
  try {
    const container = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = 'Exportado'; title.className = 'modal-title';
    const p = document.createElement('p'); p.textContent = 'El archivo se ha generado. Si quieres volver a empezar recarga la página'; p.className = 'modal-paragraph';

    container.appendChild(title);
    container.appendChild(p);
    
    let previewArea = null;
    if (jsonString) {
      const hint = document.createElement('p'); hint.textContent = 'Si no se descargo copia y pega el JSOn en whatsapp :) '; hint.className = 'modal-paragraph';
      container.appendChild(hint);

  const ctrlRow = document.createElement('div'); ctrlRow.className = 'js-modal-row';
  const copyBtn = document.createElement('button'); copyBtn.textContent = 'Copiar JSON'; copyBtn.className = 'btn-primary';
  ctrlRow.appendChild(copyBtn); ctrlRow.appendChild(toggleBtn);
      container.appendChild(ctrlRow);

      previewArea = document.createElement('textarea');
      previewArea.className = 'js-modal-textarea';
      previewArea.rows = 12;
      previewArea.readOnly = true;
      previewArea.value = jsonString;
      previewArea.style.display = 'none';
      container.appendChild(previewArea);

  // Clipboard helper with fallback
      async function copyToClipboard(text) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch (e) {}
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed'; ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          return !!ok;
        } catch (e) { return false; }
      }

      copyBtn.addEventListener('click', async () => {
        try {
          // provide immediate feedback on the button and avoid double clicks
          copyBtn.disabled = true;
          const ok = await copyToClipboard(jsonString);
          if (ok) {
            // temporary label change to confirm success
            const prev = copyBtn.textContent;
            copyBtn.textContent = 'Copiado';
            showToast('JSON copiado al portapapeles', 3000);
            setTimeout(() => { try { copyBtn.textContent = prev; copyBtn.disabled = false; } catch(e){} }, 2000);
          } else {
            showToast('No se pudo copiar automáticamente. Selecciona y copia manualmente.', 5000);
            copyBtn.disabled = false;
          }
        } catch (e) { try { showToast('Error copiando al portapapeles', 3000); } catch(e){} finally { try { copyBtn.disabled = false; } catch(e){} } }
      });

      // (WhatsApp send option removed) single-copy behavior remains above.

      toggleBtn.addEventListener('click', () => {
        try {
          if (!previewArea) return;
          const shown = previewArea.style.display !== 'none';
          previewArea.style.display = shown ? 'none' : 'block';
          toggleBtn.textContent = shown ? 'Mostrar JSON' : 'Ocultar JSON';
        } catch(e){}
      });
    }

    const row = document.createElement('div'); row.className = 'js-modal-row';
    const restartBtn = document.createElement('button'); restartBtn.textContent = 'Reiniciar ahora'; restartBtn.className = 'btn-primary';
    const laterBtn = document.createElement('button'); laterBtn.textContent = 'Cerrar'; laterBtn.className = 'btn-secondary';
    row.appendChild(restartBtn); row.appendChild(laterBtn);
    container.appendChild(row);

    const modal = _createModal(container);

    laterBtn.addEventListener('click', () => { try { modal.remove(); } catch(e){} });
    restartBtn.addEventListener('click', () => {
      try {
        // perform reset and close modal
        resetAllData(false);
      } catch(e){}
      try { modal.remove(); } catch(e){}
    });
  } catch(e){}
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

    // treat A and B message screens equivalently (TMsj, CMsj, or "C. Solicitud de mensaje.png")
    // Special-case: AFrancini should never be active on the B main (CMain.png).
    // Return inert early if this area is AFrancini and we're on CMain.
    try {
      if ((areaId || '').toLowerCase().includes('afrancini') && curLow === 'cmain.png') {
        return false;
      }
    } catch(e) {}

    if (curLow === 'tmsj.png' || curLow === 'cmsj.png' || curLow === 'c. solicitud de mensaje.png') {
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

    // If we're on the main screen (A or B), navigate to the matching message screen in the same folder
    if (curLow === 'tmain.png' || curLow === 'cmain.png') {
      pushCurrentToHistory();
      window.__lastAreaClicked = true;
      incrementCount(areaId);
      // choose the target path based on the folder of the current image
      const srcFull = decodeURIComponent(getScreenImg().getAttribute('src') || '');
      let targetMsj = 'images/A.Tratamiento/TMsj.png';
      if (srcFull.indexOf('/B.Control/') !== -1) targetMsj = 'images/B.Control/CMsj.png';
      recordEvent(areaId, targetMsj, false);
      setScreen(targetMsj);
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

// Consolidated area activation rules (use canonical basenames)
const AREA_RULES = {
  'area-afrancini': { enabledOn: ['TMain.png'], disabledOn: ['CMain.png'] },
  'area-solicitudmsj': { enabledOn: ['TMsj.png'] },
  // disable back on the main screens (both A and B main variants)
  'area-back-msj': { disabledOn: ['TMain.png','CMain.png'] },
  'area-msj2': { enabledOn: ['TMain.png'] },
  'area-tconfigmsj': { enabledOn: ['TMain.png'] },
  // Aequis (A): visible solo en TConfigMsj y vuelve a TMain
  'area-aequis': { enabledOn: ['TConfigMsj.png'] },
  'area-tconfig': { enabledOn: ['TNotfSys.png','TSysDen.png'] },
  'area-tactfltrs': { enabledOn: ['TActv.png'] },
  'area-adenuncias': { enabledOn: ['TNotfSys.png'] },
  'area-bdenuncias': { enabledOn: ['CNotfSys.png','CSysDen.png'] },
  // B/C variant denuncias (CNotfSys) handled separately
  'area-actualizaciones': { enabledOn: ['TSysDen.png'] },
  'area-actualcuenta': { enabledOn: ['CSysDen.png'] },
  'area-rueda': { enabledOn: ['CNotfSys.png','CSysDen.png'] },
  // Bfiltros: only visible on C.Actividad and navigates to CActvFltrs
  'area-bfiltros': { enabledOn: ['C.Actividad.png'] },
  // Toggle: only visible on CMain, navigates to CConfigMsj
  'area-toggle': { enabledOn: ['CMain.png'] },
  // Equis: only visible on CConfigMsj, navigates back to CMain
  'area-equis': { enabledOn: ['CConfigMsj.png'] },
  // CMain-specific hotspots
  'area-cmain-bfrancini': { enabledOn: ['CMain.png'] },
  'area-cmain-newfollowers': { enabledOn: ['CMain.png'] },
  'area-cmain-systemnotif': { enabledOn: ['CMain.png'] },
  'area-cmain-denuncias': { enabledOn: ['CMain.png'] },
  'area-cmain-solicitudmsj': { enabledOn: ['CMain.png'] },
  'area-cmain-activity': { enabledOn: ['CMain.png'] },
  // Barra de pestañas de prototipoA (usa basenames canónicos)
  'area-seguidores': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png','CActvFltrs.png','CConfig.png','CConfigMsj.png','C.Actividad.png','CNotfSys.png','CMain.png','C.NuevosSeguidores.png','CSolicitudMensaje.png','CSysDen.png','CMsj.png'] },
  'area-actividad': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png','CActvFltrs.png','CConfig.png','CConfigMsj.png','C.Actividad.png','CNotfSys.png','CMain.png','C.NuevosSeguidores.png','CSolicitudMensaje.png','CSysDen.png','CMsj.png'] },
  'area-notifsistema': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png','CActvFltrs.png','CConfig.png','CConfigMsj.png','C.Actividad.png','C.NuevosSeguidores.png','CSolicitudMensaje.png','CSysDen.png','CMain.png','CMsj.png','CNotfSys.png'] },
  'area-main': { disabledOn: ['TActvFltrs.png','TConfig.png','TConfigMsj.png','TMsj.png','CActvFltrs.png','CConfig.png','CConfigMsj.png','CMain.png','C.Actividad.png','CNotfSys.png','C.NuevosSeguidores.png','CSolicitudMensaje.png','CSysDen.png','CMsj.png'] },

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
      const active = isAreaActive(area.id);

      // Guarda coords originales una sola vez
      if (!area.__origCoords) {
        area.__origCoords = area.getAttribute('coords') || '';
      }

      // Si NO está activa: sácala del hit-test del <map>
      if (!active) {
        // 1) deshabilita clicks por si el navegador respeta pointer-events
        area.style.pointerEvents = 'none';
        area.style.cursor = 'default';
        // 2) sácala del hit-test seguro en todos los navegadores
        if (area.getAttribute('coords')) {
          area.setAttribute('coords', ''); // sin coords = no colisiona
        }
      } else {
        // Activa: restaura coords y habilita
        if (!area.getAttribute('coords') && area.__origCoords) {
          area.setAttribute('coords', area.__origCoords);
        }
        area.style.pointerEvents = 'auto';
        area.style.cursor = 'pointer';
      }
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
      // choose default main depending on current image folder (A vs B)
      const srcNow = decodeURIComponent(getScreenImg().getAttribute('src') || '');
      const targetMain = srcNow.indexOf('/B.Control/') !== -1 ? 'images/B.Control/CMain.png' : 'images/A.Tratamiento/TMain.png';
      recordEvent(areaId, targetMain, false);
      setScreen(targetMain);
    }
  } catch(e){}
}

function backFromTActvFltrs(areaId) {
  try {
    window.__lastAreaClicked = true;
    if (!areaId) areaId = 'area-TActFltrs-any';
    incrementCount(areaId);
    const srcNow = decodeURIComponent(getScreenImg().getAttribute('src') || '');
    const targetActv = srcNow.indexOf('/B.Control/') !== -1 ? 'images/B.Control/C.Actividad.png' : 'images/A.Tratamiento/TActv.png';
    recordEvent(areaId, targetActv, false);
    setScreen(targetActv);
  } catch(e){}
}

function updateAnyTouchBehaviors() {
  try {
    // 🔒 Puerta dura: si no permitimos any-touch, desmonta el handler global y sal.
    if (typeof ALLOW_ANY_TOUCH !== 'undefined' && !ALLOW_ANY_TOUCH) {
      if (window.__anyTouchHandler) {
        document.removeEventListener('click', window.__anyTouchHandler, true);
        window.__anyTouchHandler = null;
      }
      return;
    }

    const img = getScreenImg();
    if (!img) {
      // No imagen => asegúrate de no dejar handler colgado
      if (window.__anyTouchHandler) {
        document.removeEventListener('click', window.__anyTouchHandler, true);
        window.__anyTouchHandler = null;
      }
      return;
    }

    const src = decodeURIComponent(img.getAttribute('src') || '');
    const basename = (src.split('/').pop() || '').toLowerCase();

    // Desmonta cualquier handler previo antes de evaluar la nueva pantalla
    if (window.__anyTouchHandler) {
      document.removeEventListener('click', window.__anyTouchHandler, true);
      window.__anyTouchHandler = null;
    }

    // Solo monta el capturador en las pantallas que lo necesitan
    if (basename === 'tconfigmsj.png' || basename === 'tactvfltrs.png') {
      const handler = function(evt) {
        try {
          const container = document.querySelector('.screen-wrap');
          if (!container) return;
          const rect = container.getBoundingClientRect();
          if (evt.clientX < rect.left || evt.clientX > rect.right ||
              evt.clientY < rect.top  || evt.clientY > rect.bottom) return;

          evt.preventDefault();
          evt.stopPropagation();

          if (basename === 'tconfigmsj.png') {
            backFromTConfigMsj('area-TConfigMsj-any');
          } else if (basename === 'tactvfltrs.png') {
            backFromTActvFltrs('area-TActFltrs-any');
          }
        } catch(e) {}
      };
      window.__anyTouchHandler = handler;
      document.addEventListener('click', handler, true);
    }
  } catch(e) {}
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

    // Limpia overlays previos
    removeAreaOverlays();

    const naturalW = img.naturalWidth || img.width || img.clientWidth;
    const naturalH = img.naturalHeight || img.height || img.clientHeight;

    // Si aún no hay tamaño natural, deshabilita todo para evitar clics fantasma
    const areasAll = Array.from(document.querySelectorAll('map#phone-map area'));
    areasAll.forEach(a => { try { a.style.pointerEvents = 'none'; } catch(e){} });
    if (!naturalW || !naturalH) return;

    const rect = img.getBoundingClientRect();
    const scaleX = rect.width / naturalW;
    const scaleY = rect.height / naturalH;

    const areas = Array.from(document.querySelectorAll('map#phone-map area'));

    // Deshabilitar todo antes de crear overlays
    areas.forEach(a => { try { a.style.pointerEvents = 'none'; } catch(e){} });

    // Crear overlays visibles para las áreas activas con coords válidas
    areas.forEach(area => {
      try {
        if (!isAreaActive(area.id)) return;

        const coords = (area.getAttribute('coords') || '')
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => !isNaN(n));
        if (!coords.length) { area.style.pointerEvents = 'none'; return; }

        const shape = (area.getAttribute('shape') || 'rect').toLowerCase();
        const bbox = computeBBoxFromCoords(shape, coords);
        if (!bbox) { area.style.pointerEvents = 'none'; return; }

        let left   = Math.round(bbox.x * scaleX);
        let top    = Math.round(bbox.y * scaleY);
        let width  = Math.max(2, Math.round(bbox.w * scaleX));
        let height = Math.max(2, Math.round(bbox.h * scaleY));

        // On mobile/small screens, expand the overlay hit area to make taps easier
        const pad = isMobileDevice() ? Math.max(10, Math.round(Math.min(rect.width, rect.height) * 0.03)) : 0;
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        width = Math.min(Math.round(rect.width) - left, width + pad * 2);
        height = Math.min(Math.round(rect.height) - top, height + pad * 2);

        const ov = document.createElement('div');
        ov.className = 'area-overlay ' + (bbox.shape === 'circle' ? 'circle' : (bbox.shape === 'poly' ? 'poly' : 'rect'));
        ov.style.left = left + 'px';
        ov.style.top = top + 'px';
        ov.style.width = width + 'px';
        ov.style.height = height + 'px';
  // On mobile allow the overlay to receive pointer events so taps hit reliably; on desktop keep it visual-only
  const mobile = isMobileDevice();
  ov.style.pointerEvents = mobile ? 'auto' : 'none';

        ov.setAttribute('data-area-id', area.id || '');
        ov.title = area.getAttribute('title') || area.getAttribute('alt') || area.id || '';

        // If on mobile, route overlay taps to the original area handler so behavior is identical
        if (mobile) {
          ov.addEventListener('click', function(evt){
            try {
              const aid = this.getAttribute('data-area-id');
              const areaEl = document.querySelector('map#phone-map area[id="' + aid + '"]');
              if (areaEl) {
                // Prefer calling the wired handler if present
                if (typeof areaEl.__prototypeClickHandler === 'function') {
                  areaEl.__prototypeClickHandler.call(areaEl, evt);
                } else {
                  // fallback: dispatch a synthetic click
                  areaEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
              }
            } catch(e){}
          });
        }

        container.appendChild(ov);

        // Habilitar el <area> si se dibujó overlay (keep disabled on mobile to avoid double events)
        if (!mobile) {
          area.style.pointerEvents = 'auto';
        } else {
          area.style.pointerEvents = 'none';
        }
        area.style.cursor = 'pointer';

        if (window.__showClickables) ov.classList.add('debug-visible');
      } catch (e) { /* por área */ }
    });

    // Reconciliar: deshabilitar áreas sin overlay.
    // Forzar habilitado de area-CConfig si está activa (en CNotfSys/CSysDen).
    try {
      const mobile = isMobileDevice();
      areas.forEach(a => {
        const hasOv = !!container.querySelector('.area-overlay[data-area-id="' + a.id + '"]');
        let shouldEnable = hasOv && isAreaActive(a.id);

        if ((a.id || '').toLowerCase() === 'area-cconfig' && isAreaActive(a.id)) {
          shouldEnable = true;
        }

        // On mobile we let overlays handle pointer events (areas stay non-interactive to avoid double taps)
        if (mobile) {
          a.style.pointerEvents = 'none';
          a.style.cursor = shouldEnable ? 'pointer' : 'default';
        } else {
          a.style.pointerEvents = shouldEnable ? 'auto' : 'none';
          a.style.cursor = shouldEnable ? 'pointer' : 'default';
        }
      });
    } catch(e) {}
  } catch(e) {}
}


// Utility: explicitly reconcile areas to overlays (call when needed)
function reconcileAreasWithOverlays() {
  try {
    const container = document.querySelector('.screen-wrap');
    if (!container) return;
    const areas = Array.from(document.querySelectorAll('map#phone-map area'));
    areas.forEach(a => {
      try {
        const ov = container.querySelector('.area-overlay[data-area-id="' + a.id + '"]');
        const active = isAreaActive(a.id);
        if (ov && active) a.style.pointerEvents = 'auto'; else a.style.pointerEvents = 'none';
      } catch(e) {}
    });
  } catch(e) {}
}

// Debug helpers: toggle visible purple overlays for clickable areas on current screen
function showClickableOverlays() {
  try {
    window.__showClickables = true;
    // ensure area active state is up to date
    try { updateAreasActive(); } catch(e) {}
    // recreate overlays and mark them debug-visible
    removeAreaOverlays();
    createAreaOverlays();
    const ov = document.querySelectorAll('.area-overlay');
    ov.forEach(o => { try { o.classList.add('debug-visible'); } catch(e){} });
  } catch(e) {}
}

function hideClickableOverlays() {
  try {
    window.__showClickables = false;
    removeAreaOverlays();
  } catch(e) {}
}

function toggleClickableOverlays() {
  try {
    if (window.__showClickables) hideClickableOverlays(); else showClickableOverlays();
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
  // find recent miss events that include x/y coordinates
  const misses = events.filter(e => e && e.miss && Number.isFinite(e.x) && Number.isFinite(e.y)).slice(-2000);
  if (!misses.length) {
    console.debug('[heatmap] no miss events with coordinates found, events count=', events.length);
    return;
  }

  const curW = canvas.width, curH = canvas.height;
  const baseR = Math.max(12, Math.floor(Math.min(curW, curH) * 0.04));

  misses.forEach(ev => {
    // If the event recorded original image dimensions (ev.w/ev.h), scale from that space.
    // Otherwise assume ev.x/ev.y are already in CSS pixels relative to the current image rect.
    let scaled = { x: ev.x || 0, y: ev.y || 0 };
    try {
      if (Number.isFinite(ev.w) && Number.isFinite(ev.h) && ev.w > 0 && ev.h > 0) {
        scaled = scalePoint(ev, curW, curH);
      } else {
        // If ev.x/ev.y appear larger than canvas, try to normalize by image natural size heuristics
        if (ev.x > curW || ev.y > curH) {
          const rect = img.getBoundingClientRect();
          const approxScaleX = rect.width && ev.w ? (curW / (ev.w || rect.width)) : 1;
          const approxScaleY = rect.height && ev.h ? (curH / (ev.h || rect.height)) : 1;
          scaled.x = Math.round((ev.x || 0) * approxScaleX);
          scaled.y = Math.round((ev.y || 0) * approxScaleY);
        }
      }
    } catch(e) { }
    const r = baseR;
    const cx = scaled.x, cy = scaled.y;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.0, 'rgba(255,0,0,0.35)');
    g.addColorStop(1.0, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Count misclicks and draw heatmap point
function attachMissHandler() {
  const img = document.getElementById('screen');
  if (!img || img.__missHandlerAttached) return;

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
  img.__missHandlerAttached = true;
}

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
      if (events.length === 0) {
        const no = document.createElement('div');
        no.className = 'muted';
        no.textContent = 'No events recorded yet.';
        el.appendChild(no);
      }
      events.forEach(ev => {
        const d = document.createElement('div');
        d.className = 'event-item';

        // strong: event id
        const sId = document.createElement('strong');
        sId.textContent = String(ev.id || '');
        d.appendChild(sId);

        // variant (muted)
        const vSpan = document.createElement('span');
        vSpan.className = 'muted';
        vSpan.textContent = ' (' + (ev.variant || '') + ')';
        d.appendChild(document.createTextNode(' '));
        d.appendChild(vSpan);

        // timestamp line
        const tsDiv = document.createElement('div');
        tsDiv.className = 'muted';
        const ms = ev.ts_ms ? (' — ' + ev.ts_ms + ' ms') : '';
        tsDiv.textContent = String(ev.ts || '') + ms;
        if (ev.miss) {
          const missSpan = document.createElement('span');
          missSpan.style.color = '#c00';
          missSpan.textContent = ' miss';
          tsDiv.appendChild(document.createTextNode(' '));
          tsDiv.appendChild(missSpan);
        }
        d.appendChild(tsDiv);
        el.appendChild(d);
      });
    }
}

// ------------ Area click wiring --------------
// Wire up click handlers for all areas in the map
// Handlers will check whether the area is active on the current screen before acting.
function wireAreaHandlers() {
  try {
    const areas = Array.from(document.querySelectorAll('map#phone-map area'));

    areas.forEach(area => {
      // Evita doble cableado
      try { area.removeEventListener('click', area.__prototypeClickHandler); } catch(e) {}
      const handler = function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          const id = area.id;
          // Si el área NO está activa en la pantalla actual, no hacer nada.
          if (!isAreaActive(id)) return false;

          // Debug opcional
          try {
            if (window.__showClickables) {
              const imgEl = getScreenImg();
              const cur = imgEl ? (decodeURIComponent(imgEl.getAttribute('src') || '').split('/').pop() || '') : '';
              const activeNow = isAreaActive(id);
              console.debug('[AB DEBUG] area click', {
                id,
                dataHandler: (area.getAttribute('data-handler') || ''),
                dataAction:  (area.getAttribute('data-action')  || ''),
                target:      (area.getAttribute('data-target')  || ''),
                active: activeNow,
                screen: cur
              });
              try {
                showAreaClickBadge(
                  id + ' | active=' + activeNow +
                  ' | handler=' + ((area.getAttribute('data-handler')||'') || (area.getAttribute('data-action')||'')) +
                  ' | target=' + (area.getAttribute('data-target')||'')
                );
              } catch(e){}
            }
          } catch(e){}

          const dataHandler = (area.getAttribute('data-handler') || '').toLowerCase();
          const dataAction  = (area.getAttribute('data-action')  || '').toLowerCase();
          const rawTarget   = area.getAttribute('data-target');
          const disabled    = (area.getAttribute('data-disabled') || '').split('|').map(s => s.trim()).filter(Boolean);
          const enabled     = (area.getAttribute('data-enabled')  || '').split('|').map(s => s.trim()).filter(Boolean);

          // Normaliza target al prototipo actual si existe helper; si no, usa el original
          const normalize = (t) => (typeof normalizeTargetToCurrentVariant === 'function' ? normalizeTargetToCurrentVariant(t) : t);
          const target = typeof rawTarget === 'string' ? normalize(rawTarget) : rawTarget;

          // Special-case: "Solicitud" debe abrir la pantalla de solicitud
          // pero sin cruzar de prototipo (normalize() se encarga de anclarlo).
          try {
            if ((id || '').toLowerCase().includes('solicitud')) {
              handleGlobalArea(id, normalize('images/B.Control/CSolicitudMensaje.png'), []);
              return false;
            }
          } catch(e) {}

          // Special-case: CConfig accesible desde CNotfSys / CSysDen
          try {
            if ((id || '').toLowerCase().includes('cconfig')) {
              const imgEl = getScreenImg();
              const cur = imgEl ? (decodeURIComponent(imgEl.getAttribute('src') || '').split('/').pop() || '').toLowerCase() : '';
              if (cur === 'cnotfsys.png' || cur === 'csysden.png') {
                handleGlobalArea(id, normalize('images/B.Control/CConfig.png'), []);
                return false;
              }
            }
          } catch(e) {}

          // Botón volver
          if (dataAction === 'goback' || dataHandler === 'goback') {
            window.goBack(id);
            return false;
          }
          if (dataHandler === 'tmsj') {
            handleTMsjArea(id, target);
            return false;
          }
          if (dataHandler === 'global') {
            handleGlobalArea(id, target, disabled.length ? disabled : undefined);
            return false;
          }
          if (dataHandler === 'enabled') {
            handleEnabledOn(id, target, enabled.length ? enabled : undefined);
            return false;
          }
          if (target) {
            handleGlobalArea(id, target, []);
            return false;
          }
        } catch (e) {
          // Ignora errores por área
        }
        return false;
      };
      area.__prototypeClickHandler = handler;
      area.addEventListener('click', handler);
    });
  } catch (e) {}
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

  const showClickablesBtn = document.getElementById('showClickables');
  if (showClickablesBtn) showClickablesBtn.addEventListener('click', () => { toggleClickableOverlays(); });
  
  // Helper to show a transient on-screen badge when debugging area clicks
  window.__areaClickBadgeTimer = null;
  function showAreaClickBadge(msg) {
    try {
      let el = document.getElementById('__area_click_badge');
      if (!el) {
        el = document.createElement('div');
        el.id = '__area_click_badge';
        el.className = 'area-click-badge';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      if (window.__areaClickBadgeTimer) clearTimeout(window.__areaClickBadgeTimer);
      window.__areaClickBadgeTimer = setTimeout(() => {
        try { el.style.opacity = '0'; } catch(e){}
      }, 3500);
    } catch(e){}
  }
  // expose for use in area handler
  window.showAreaClickBadge = showAreaClickBadge;

  const exportJSON = document.getElementById('exportCountsJSON');
  if (exportJSON) exportJSON.addEventListener('click', () => {
    const counts = readCounts();
    const events = readEvents();
    const missSummary = getMissSummary();
    const tasks = loadTaskState();
    const data = { exportedAt: isoTimestamp(), exportedAtMs: Date.now(), variant: localStorage.getItem(VAR_KEY), counts: counts, events: events, missSummary, tasks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'prototype-data-'+isoTimestamp().slice(0,19).replace(/[:T]/g,'-')+'.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); try { clearAllCookies(); } catch(e){} try { showPostExportRestartModal(); } catch(e){}
  });

  const exportCSV = document.getElementById('exportEventsCSV');
  if (exportCSV) exportCSV.addEventListener('click', () => {
    const events = readEvents();
    if (!events.length) { alert('No events to export'); return; }
    // include ts_ms column (epoch ms) to capture exact click time
    const rows = [['ts','ts_ms','variant','id','target','miss','x','y','w','h']];
    events.forEach(ev => rows.push([
      ev.ts, (ev.ts_ms ?? ''), ev.variant, ev.id, ev.target || '',
      ev.miss ? '1' : '0',
      (ev.x ?? ''), (ev.y ?? ''), (ev.w ?? ''), (ev.h ?? '')
    ]));
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'prototype-events-'+isoTimestamp().slice(0,19).replace(/[:T]/g,'-')+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
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
    // Treat each page load as a new session: clear any previously persisted variant
    try { localStorage.removeItem(VAR_KEY); localStorage.removeItem('tt_variant_assigned_at'); } catch(e){}
    const v = assignVariant();
    const label = document.getElementById('variant-label'); if (label) label.textContent = v;

    // ask for participant name when the UI loads
    try { askForParticipantName(); } catch(e){}

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
  try { wireAreaHandlers(); } catch(e){}
  try { updateAreasActive(); } catch(e){}
  // Ensure overlays are hidden by default on first load (prevent the purple debug overlays)
  try { hideClickableOverlays(); } catch(e){}
  try { createAreaOverlays(); } catch(e){}
  try { updateAnyTouchBehaviors(); } catch(e){}

    // Miss handler (lazy attach)
    try { attachMissHandler(); } catch(e){}

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
          try { attachMissHandler(); } catch(e){}
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
        // Ensure variant state is fully applied (updates selector options and screen)
        setVariant(current);
        buttons.forEach(b => b.addEventListener('click', () => {
          const v = b.getAttribute('data-variant');
          setVariant(v);
          // update counts display after variant change
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
        try { attachMissHandler(); } catch(e){}
        const canvas = getHeatmapCanvas();
        if (canvas && canvas.style.display !== 'none') drawHeatmap();
        try { updateAreasActive(); } catch(e){}
        try { createAreaOverlays(); } catch(e){}
        try { updateAnyTouchBehaviors(); } catch(e){}
      }, { once: true });
    }
  };
})();
