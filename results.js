// results.js — parse multiple JSON session files and render a table + aggregation
(function(){
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const tbody = document.querySelector('#resultsTable tbody');
  const aggregateView = document.getElementById('aggregateView');
  const aggregateBtn = document.getElementById('aggregateBtn');
  const clearBtn = document.getElementById('clearBtn');

  const sessions = []; // {name, data, metrics}

  function safeParse(text, name){
    try{ return JSON.parse(text); }
    catch(e){ console.warn('Failed to parse', name, e); return null; }
  }

  function extractMetrics(parsed){
    // Flexible extraction updated to support the modern export shape produced
    // by prototype_ab.js: { exportedAt, exportedAtMs, variant, counts, events,
    //   missSummary, tasks, meta }
  const metrics = { variant: '—', total: null, miss: 0, counts: null, perVariantTotals: null, exportedAt: null, lastTaskName: null, lastTaskDurationS: null, respuesta_final: null, tasks: null, participantName: null };
    if(!parsed) return metrics;

    // If the top-level is an array of events, use length
    if(Array.isArray(parsed)){
      metrics.total = parsed.length;
      metrics.counts = { events: parsed.length };
      return metrics;
    }

    if(typeof parsed === 'object'){
      // capture exportedAt if present
      if(parsed.exportedAt) metrics.exportedAt = parsed.exportedAt;
      if(parsed.exportedAtMs && !metrics.exportedAt) {
        try{ metrics.exportedAt = new Date(Number(parsed.exportedAtMs)).toISOString(); } catch(e){}
      }

  // participantName can appear in several places depending on export shape
  // prefer top-level `participantName`, then `meta.participantName`, then `meta.participant.name`
  metrics.participantName = parsed.participantName || (parsed.meta && (parsed.meta.participantName || (parsed.meta.participant && parsed.meta.participant.name))) || null;

  // variant can be top-level or inside meta/summary
      metrics.variant = parsed.variant || (parsed.meta && parsed.meta.variant) || (parsed.summary && parsed.summary.variant) || parsed.variantName || metrics.variant;

      // Preferred: top-level counts object (may contain per-variant sub-objects)
      if(parsed.counts && typeof parsed.counts === 'object'){
        metrics.counts = parsed.counts;

        // compute per-variant totals when counts looks like { A: {...}, B: {...} }
        const per = {};
        let grandTotal = 0;
        for(const [variantKey, obj] of Object.entries(parsed.counts)){
          if(typeof obj === 'object'){
            let s = 0;
            for(const [k, v] of Object.entries(obj)){
              if(k === 'miss') continue;
              if(typeof v === 'number') s += v;
            }
            per[variantKey] = s;
            grandTotal += s;
          }
        }
        // If we found per-variant numeric totals, attach them
        if(Object.keys(per).length) metrics.perVariantTotals = per;
        if(grandTotal > 0) metrics.total = grandTotal;

        // miss: prefer missSummary.total, else sum per-variant miss fields if present
        if(parsed.missSummary && typeof parsed.missSummary.total === 'number'){
          metrics.miss = parsed.missSummary.total;
        } else {
          let missSum = 0;
          for(const obj of Object.values(parsed.counts)){
            if(obj && typeof obj.miss === 'number') missSum += obj.miss;
          }
          metrics.miss = missSum;
        }

        // If tasks/runs are present on the export, compute per-task durations and last response
        // Normalize tasks/runs: exports sometimes include an object {currentIndex,runs:[]}
        let runsArr = null;
        if (Array.isArray(parsed.tasks)) runsArr = parsed.tasks;
        else if (parsed.tasks && Array.isArray(parsed.tasks.runs)) runsArr = parsed.tasks.runs;
        else if (Array.isArray(parsed.runs)) runsArr = parsed.runs;
        else if (parsed.tasks && typeof parsed.tasks === 'object' && Array.isArray(parsed.tasks)) runsArr = parsed.tasks;

        if (Array.isArray(runsArr) && runsArr.length) {
          metrics.tasks = runsArr.map(t => {
            const started = t.startedAt ? Date.parse(t.startedAt) : (t.started ? Date.parse(t.started) : null);
            const finished = t.finishedAt ? Date.parse(t.finishedAt) : (t.finished ? Date.parse(t.finished) : null);
            const durationMs = (Number.isFinite(started) && Number.isFinite(finished)) ? (finished - started) : (typeof t.durationMs === 'number' ? t.durationMs : null);
            const duration_s = (durationMs != null && !isNaN(durationMs)) ? Math.round(durationMs / 1000) : null;
            const successVal = Object.prototype.hasOwnProperty.call(t, 'success') ? (t.success === true || t.success === 1) : null;
            return { index: (t.index ?? t.taskIndex ?? null), task: (t.task || t.title || null), startedAt: (t.startedAt || t.started || null), finishedAt: (t.finishedAt || t.finished || null), durationMs: durationMs, duration_s, success: successVal, raw: t };
          });

          // Attempt to extract per-task click/miss totals from counts.byTask if present
          try {
            const perTaskTotals = {}; // index -> total clicks
            const perTaskMiss = {}; // index -> miss clicks
            if (parsed.counts && typeof parsed.counts === 'object') {
              for (const [variantKey, obj] of Object.entries(parsed.counts)) {
                if (obj && typeof obj === 'object' && obj.byTask && typeof obj.byTask === 'object') {
                  for (const [ti, areaObj] of Object.entries(obj.byTask)) {
                    const idx = String(ti);
                    perTaskTotals[idx] = perTaskTotals[idx] || 0;
                    perTaskMiss[idx] = perTaskMiss[idx] || 0;
                    for (const [areaK, areaV] of Object.entries(areaObj || {})) {
                      const n = typeof areaV === 'number' ? areaV : 0;
                      perTaskTotals[idx] += n;
                      if (String(areaK).toLowerCase() === 'miss') perTaskMiss[idx] += n;
                    }
                  }
                }
              }
            }
            if (Object.keys(perTaskTotals).length) {
              metrics.perTaskTotals = perTaskTotals;
              metrics.perTaskMiss = perTaskMiss;
            }
          } catch(e) { /* ignore per-task extraction errors */ }

          // count successful tasks if any
          try { metrics.successfulTasks = metrics.tasks.filter(x => x.success === true).length; } catch(e){ metrics.successfulTasks = 0; }

          // Compute duration summaries: per-task durations (s), total, min, max
          try {
            const durList = metrics.tasks.map(t => (Number.isFinite(t.duration_s) ? t.duration_s : null)).filter(v => v != null);
            if (durList.length) {
              const total = durList.reduce((a,b) => a + b, 0);
              const maxV = Math.max(...durList);
              const minV = Math.min(...durList);
              metrics.totalDurationS = total;
              // find corresponding task names (first match)
              const maxTask = metrics.tasks.find(t => t.duration_s === maxV);
              const minTask = metrics.tasks.find(t => t.duration_s === minV);
              metrics.longestTaskName = maxTask ? maxTask.task : null;
              metrics.shortestTaskName = minTask ? minTask.task : null;
            } else {
              metrics.totalDurationS = null;
              metrics.longestTaskName = null;
              metrics.shortestTaskName = null;
            }
          } catch(e) {
            metrics.totalDurationS = null;
            metrics.longestTaskName = null;
            metrics.shortestTaskName = null;
          }

          // Determine the last run by using the maximum reported index if available, otherwise last array element
          let maxIdx = -Infinity;
          metrics.tasks.forEach(rt => { if (Number.isFinite(rt.index)) maxIdx = Math.max(maxIdx, rt.index); });
          let chosenRun = null;
          if (Number.isFinite(maxIdx) && maxIdx > -Infinity) {
            chosenRun = runsArr.find(r => (r.index ?? r.taskIndex) === maxIdx) || null;
          }
          if (!chosenRun) chosenRun = runsArr[runsArr.length - 1] || null;

          if (chosenRun) {
            const started = chosenRun.startedAt ? Date.parse(chosenRun.startedAt) : (chosenRun.started ? Date.parse(chosenRun.started) : null);
            const finished = chosenRun.finishedAt ? Date.parse(chosenRun.finishedAt) : (chosenRun.finished ? Date.parse(chosenRun.finished) : null);
            const durationMs = (Number.isFinite(started) && Number.isFinite(finished)) ? (finished - started) : (typeof chosenRun.durationMs === 'number' ? chosenRun.durationMs : null);
            metrics.lastTaskName = chosenRun.task || chosenRun.title || null;
            metrics.lastTaskDurationS = (durationMs != null && !isNaN(durationMs)) ? Math.round(durationMs / 1000) : null;

            // respuesta_final: if the last run object contains a response property (even empty string), use it
            if (Object.prototype.hasOwnProperty.call(chosenRun, 'response') || Object.prototype.hasOwnProperty.call(chosenRun, 'respuesta') || Object.prototype.hasOwnProperty.call(chosenRun, 'answer')){
              metrics.respuesta_final = chosenRun.response ?? chosenRun.respuesta ?? chosenRun.answer ?? '';
            } else {
              metrics.respuesta_final = null;
            }
            // last run success if available (only consider `success` property)
            if (Object.prototype.hasOwnProperty.call(chosenRun, 'success')){
              metrics.lastTaskSuccess = (chosenRun.success === true || chosenRun.success === 1) ? true : (chosenRun.success === false || chosenRun.success === 0 ? false : null);
            }
          }
          // missSummary per-task if present
          if (parsed.missSummary && parsed.missSummary.byTaskIndex && typeof parsed.missSummary.byTaskIndex === 'object'){
            metrics.missByTask = parsed.missSummary.byTaskIndex;
          }
        }

        return metrics;
      }

      // If events array present, prefer it for total and keep events in counts for visibility
      if(parsed.events && Array.isArray(parsed.events)){
        metrics.total = parsed.events.length;
        // small counts object showing events length
        metrics.counts = { events: parsed.events.length };
        // miss may be provided under missSummary
        if(parsed.missSummary && typeof parsed.missSummary.total === 'number') metrics.miss = parsed.missSummary.total;
        return metrics;
      }

      // fallback heuristics (keep backward compatibility with older shapes)
      const countsCandidates = ['perVariant','per_variant','counts_json','countsJson','counts-json'];
      for(const k of countsCandidates){ if(parsed[k]) { metrics.counts = parsed[k]; break; } }
      if(!metrics.counts && parsed['counts-json']) metrics.counts = parsed['counts-json'];
      if(!metrics.counts && parsed.countsJson) metrics.counts = parsed.countsJson;

      metrics.total = parsed.total || (parsed.summary && parsed.summary.total) || parsed['summary-total'] || null;
      metrics.miss = parsed.miss || (parsed.summary && parsed.summary.miss) || parsed['summary-miss'] || 0;

      if(!metrics.counts){
        const numericProps = {};
        for(const [k,v] of Object.entries(parsed)){
          if(typeof v === 'number') numericProps[k]=v;
        }
        if(Object.keys(numericProps).length) metrics.counts = numericProps;
      }

      if(metrics.counts && typeof metrics.counts === 'object' && metrics.total == null){
        let s=0, found=false;
        for(const v of Object.values(metrics.counts)){ if(typeof v === 'number'){ s+=v; found=true } }
        if(found) metrics.total = s;
      }

      if(metrics.total == null && parsed.events && Array.isArray(parsed.events)) metrics.total = parsed.events.length;
      if(metrics.total == null) metrics.total = '—';
      if(!metrics.counts) metrics.counts = parsed;
    }

    return metrics;
  }

  function renderRow(session){
    // (counts summary column removed) — keep metric data in session.metrics if needed

    const participant = session.metrics.participantName ? escapeHtml(String(session.metrics.participantName)) : '—';
    const variant = escapeHtml(String(session.metrics.variant || '—'));
  const totalDur = (typeof session.metrics.totalDurationS === 'number') ? String(session.metrics.totalDurationS) : '—';

    // If tasks array exists, render one row per task (show 6 rows: one per expected task)
    if (Array.isArray(session.metrics.tasks) && session.metrics.tasks.length) {
      const tasksArr = session.metrics.tasks;
        for (let i = 0; i < 6; i++) {
        const t = tasksArr[i] || null;
        const taskName = t && t.task ? escapeHtml(String(t.task)) : '—';
        const duration = t && Number.isFinite(t.duration_s) ? String(t.duration_s) : '—';
        const respRaw = t && t.raw && (t.raw.response ?? t.raw.respuesta ?? t.raw.answer) ? (t.raw.response ?? t.raw.respuesta ?? t.raw.answer) : null;
        const displayedResp = respRaw == null ? '—' : (String(respRaw).length > 120 ? escapeHtml(String(respRaw).slice(0,120)) + '…' : escapeHtml(String(respRaw)));

        // success display for this task
        let successText = '—';
        try {
          if (t) {
            // prefer explicit success flag when available
            if (Object.prototype.hasOwnProperty.call(t, 'success') && t.success !== null) {
              successText = (t.success === true) ? 'Sí' : (t.success === false ? 'No' : '—');
            } else if (t.raw) {
              // fallback heuristics: finishedAt or finished implies success
              const raw = t.raw;
              if (raw.finishedAt || raw.finished) {
                successText = 'Sí';
              } else if (raw.response && String(raw.response).trim().length) {
                // if a response was recorded, treat as success (useful for final task)
                successText = 'Sí';
              }
            }
          }
        } catch(e){}

        const tr = document.createElement('tr');
        // Determine clicks/miss for this task: prefer per-task totals when available
        let taskClicks = '—';
        let taskMiss = 0;
        try {
          if (session.metrics.perTaskTotals && Object.prototype.hasOwnProperty.call(session.metrics.perTaskTotals, String(i))) {
            taskClicks = String(session.metrics.perTaskTotals[String(i)] || 0);
          } else if (typeof session.metrics.total === 'number') {
            // fallback to session total (string) when per-task not available
            taskClicks = String(session.metrics.total);
          }
          if (session.metrics.perTaskMiss && Object.prototype.hasOwnProperty.call(session.metrics.perTaskMiss, String(i))) {
            taskMiss = session.metrics.perTaskMiss[String(i)] || 0;
          } else if (typeof session.metrics.miss === 'number') {
            taskMiss = session.metrics.miss || 0;
          }
        } catch(e){ /* ignore and keep fallbacks */ }

        tr.innerHTML = `
          <td>${escapeHtml(session.name)}</td>
          <td>${participant}</td>
          <td>${variant}</td>
          <td>${i+1}</td>
          <td>${taskName}</td>
          <td>${escapeHtml(String(successText))}</td>
          <td>${escapeHtml(String(taskClicks))}</td>
          <td>${escapeHtml(String(taskMiss || 0))}</td>
          <td>${duration}</td>
          <td>${totalDur}</td>
          <td>
            <span class="resp-snippet">${displayedResp}</span>
            ${respRaw && String(respRaw).length > 120 ? '<button class="show-more-btn">Mostrar más</button>' : ''}
            ${respRaw ? '<div class="resp-full" style="display:none">' + escapeHtml(String(respRaw)) + '</div>' : ''}
          </td>
          <td><button class="details-btn">Toggle</button>
              <div class="details">${escapeHtml(JSON.stringify(session.data, null, 2))}</div>
          </td>
        `;
        tbody.appendChild(tr);
      }
      return;
    }

    // Fallback: render a single row when no task runs present
    const rawResp = (session.metrics.respuesta_final !== null && session.metrics.respuesta_final !== undefined) ? String(session.metrics.respuesta_final) : null;
    const displayedResp = rawResp == null ? '—' : (rawResp.length > 120 ? escapeHtml(rawResp.slice(0, 120)) + '…' : escapeHtml(rawResp));
    const tr = document.createElement('tr');
    // determine last task success for fallback displays
    let lastSuccessText = '—';
    try {
      if (session.metrics && typeof session.metrics.lastTaskSuccess !== 'undefined' && session.metrics.lastTaskSuccess !== null) {
        lastSuccessText = session.metrics.lastTaskSuccess === true ? 'Sí' : (session.metrics.lastTaskSuccess === false ? 'No' : '—');
      } else if (session.data && session.data.tasks && Array.isArray(session.data.tasks.runs) && session.data.tasks.runs.length) {
        const lr = session.data.tasks.runs[session.data.tasks.runs.length - 1];
        if (lr && (lr.finishedAt || lr.finished)) lastSuccessText = 'Sí';
        else if (lr && lr.response && String(lr.response).trim().length) lastSuccessText = 'Sí';
      }

    } catch(e){}

    tr.innerHTML = `
      <td>${escapeHtml(session.name)}</td>
      <td>${participant}</td>
      <td>${variant}</td>
      <td>—</td>
      <td>—</td>
  <td>${lastSuccessText}</td>
      <td>${escapeHtml(String(session.metrics.total))}</td>
      <td>${escapeHtml(String(session.metrics.miss || 0))}</td>
      <td>${escapeHtml(String(session.metrics.lastTaskDurationS != null ? session.metrics.lastTaskDurationS : '—'))}</td>
      <td>${totalDur}</td>
      <td>
        <span class="resp-snippet">${displayedResp}</span>
        ${rawResp && rawResp.length > 120 ? '<button class="show-more-btn">Mostrar más</button>' : ''}
        ${rawResp ? '<div class="resp-full" style="display:none">' + escapeHtml(rawResp) + '</div>' : ''}
      </td>
      <td><button class="details-btn">Toggle</button>
          <div class="details">${escapeHtml(JSON.stringify(session.data, null, 2))}</div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  function summarizeCounts(counts){
    if(!counts) return '—';
    if(typeof counts === 'number') return String(counts);
    if(typeof counts === 'string') return counts;
    if(typeof counts === 'object'){
      // show up to 4 keys
      const keys = Object.keys(counts).slice(0,4);
      return keys.map(k=>`${k}: ${counts[k]}`).join('; ') + (Object.keys(counts).length>4? '…':'');
    }
    return '—';
  }

  function escapeHtml(s){
    return s.replace(/[&<>"]+/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c] });
  }

  // Handle file(s)
  function handleFiles(files){
    Array.from(files).forEach(file=>{
      const reader = new FileReader();
      reader.onload = function(e){
        const raw = e.target.result;
        const parsed = safeParse(raw, file.name);
        const metrics = extractMetrics(parsed);
        const sess = {name:file.name, data: parsed||raw, metrics};
        sessions.push(sess);
        renderRow(sess);
      };
      reader.readAsText(file);
    });
  }

  // drag & drop
  dropzone.addEventListener('dragover', e=>{ e.preventDefault(); dropzone.style.borderColor='#2b6cb0'; });
  dropzone.addEventListener('dragleave', e=>{ dropzone.style.borderColor='#bbb'; });
  dropzone.addEventListener('drop', e=>{ e.preventDefault(); dropzone.style.borderColor='#bbb'; handleFiles(e.dataTransfer.files); });

  fileInput.addEventListener('change', e=>{ handleFiles(e.target.files); fileInput.value=''; });

  // toggle details
  document.addEventListener('click', e=>{
    if(e.target && e.target.classList.contains('details-btn')){
      const details = e.target.parentElement.querySelector('.details');
      if(details) details.style.display = (details.style.display === 'block') ? 'none' : 'block';
    }
    // show-more handler for long respuesta_final
    if (e.target && e.target.classList && e.target.classList.contains('show-more-btn')) {
      try {
        const btn = e.target;
        const parent = btn.parentElement;
        const full = parent.querySelector('.resp-full');
        const snippet = parent.querySelector('.resp-snippet');
        if (!full || !snippet) return;
        const isShown = full.style.display !== 'none';
        if (isShown) {
          full.style.display = 'none';
          snippet.style.display = '';
          btn.textContent = 'Mostrar más';
        } else {
          full.style.display = 'block';
          snippet.style.display = 'none';
          btn.textContent = 'Mostrar menos';
        }
      } catch(e){}
    }
  });

  aggregateBtn.addEventListener('click', ()=>{
    if(!sessions.length){ aggregateView.textContent = 'No files loaded.'; return; }
    const aggregateCounts = {}; // raw per-area aggregation when available
    const aggregatePerVariant = {}; // sums of perVariantTotals across files
    let totalClicks = 0, totalMiss = 0, filesWithNumericTotal = 0;

    sessions.forEach(s=>{
      // If file has perVariantTotals, aggregate those separately
      if(s.metrics.perVariantTotals){
        for(const [variantKey, v] of Object.entries(s.metrics.perVariantTotals)){
          if(typeof v === 'number') aggregatePerVariant[variantKey] = (aggregatePerVariant[variantKey]||0) + v;
        }
      }

      // Also aggregate raw counts (area-level) if available
      const c = s.metrics.counts;
      if(c && typeof c === 'object'){
        // If counts has variant sub-objects (like A/B), merge their fields
        const maybeVariants = Object.values(c).filter(x=>typeof x === 'object');
        if(maybeVariants.length){
          for(const obj of maybeVariants){
            for(const [k,v] of Object.entries(obj)){
              if(typeof v === 'number') aggregateCounts[k] = (aggregateCounts[k]||0) + v;
            }
          }
        } else {
          for(const [k,v] of Object.entries(c)){
            if(typeof v === 'number') aggregateCounts[k] = (aggregateCounts[k]||0) + v;
          }
        }
      }

      if(typeof s.metrics.total === 'number') { totalClicks += s.metrics.total; filesWithNumericTotal++; }
      if(typeof s.metrics.miss === 'number') totalMiss += s.metrics.miss;
    });

    const agg = {
      files: sessions.length,
      totalClicks: filesWithNumericTotal? totalClicks : '—',
      totalMiss: totalMiss,
      perVariantTotals: aggregatePerVariant,
      byArea: aggregateCounts
    };

    aggregateView.innerHTML = `<pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(agg,null,2))}</pre>`;
  });

  clearBtn.addEventListener('click', ()=>{
    sessions.length = 0; tbody.innerHTML = ''; aggregateView.textContent = 'Cleared.';
  });

  // Export to Excel/XLSX. If SheetJS (XLSX) is loaded on the page, use it; otherwise fall back to an HTML .xls download
  const exportXLSXBtn = document.getElementById('exportXLSX');
  if (exportXLSXBtn) exportXLSXBtn.addEventListener('click', () => {
    try {
      if (!sessions.length) { alert('No sessions to export'); return; }

      const rows = [];
      sessions.forEach(s => {
        const base = {
          File: s.name,
          ParticipantName: s.metrics.participantName || '',
          Variant: s.metrics.variant || '',
          TotalClicks: s.metrics.total || '',
          Missclicks: s.metrics.miss || '',
          TotalDuration_s: s.metrics.totalDurationS != null ? s.metrics.totalDurationS : ''
        };

        // If session has per-task runs, export one row per task (6 rows expected)
        if (Array.isArray(s.metrics.tasks) && s.metrics.tasks.length) {
          const tasksArr = s.metrics.tasks;
          for (let i = 0; i < 6; i++) {
            const t = tasksArr[i] || null;
            const taskName = t && t.task ? t.task : '';
            const taskDuration = t && Number.isFinite(t.duration_s) ? t.duration_s : '';
            const taskResp = t && t.raw && (t.raw.response ?? t.raw.respuesta ?? t.raw.answer) ? (t.raw.response ?? t.raw.respuesta ?? t.raw.answer) : '';
            const taskSuccess = (t && Object.prototype.hasOwnProperty.call(t, 'success')) ? (t.success === true || t.success === 1 ? true : (t.success === false || t.success === 0 ? false : null)) : null;
            // derive per-task clicks and miss from session.metrics.perTaskTotals / perTaskMiss when available
            let taskClicksExport = '';
            let taskMissExport = '';
            try {
              if (s.metrics && s.metrics.perTaskTotals && Object.prototype.hasOwnProperty.call(s.metrics.perTaskTotals, String(i))) taskClicksExport = s.metrics.perTaskTotals[String(i)];
              else taskClicksExport = s.metrics && typeof s.metrics.total === 'number' ? s.metrics.total : '';
              if (s.metrics && s.metrics.perTaskMiss && Object.prototype.hasOwnProperty.call(s.metrics.perTaskMiss, String(i))) taskMissExport = s.metrics.perTaskMiss[String(i)];
              else taskMissExport = s.metrics && typeof s.metrics.miss === 'number' ? s.metrics.miss : '';
            } catch(e){ }

            rows.push(Object.assign({}, base, {
              TaskNumber: i + 1,
              TaskName: taskName,
              TaskDuration_s: taskDuration,
              TaskResponse: taskResp,
              TaskSuccess: taskSuccess,
              TaskTotalClicks: taskClicksExport,
              TaskMissclicks: taskMissExport
            }));
          }
        } else {
          // Fallback: single row per file
          rows.push(Object.assign({}, base, {
            TaskNumber: '',
            TaskName: '',
            TaskDuration_s: '',
            TaskResponse: s.metrics.respuesta_final != null ? s.metrics.respuesta_final : '',
            TaskSuccess: (s.metrics.lastTaskSuccess === true) ? true : (s.metrics.lastTaskSuccess === false ? false : null),
            TaskTotalClicks: s.metrics && typeof s.metrics.total === 'number' ? s.metrics.total : '',
            TaskMissclicks: s.metrics && typeof s.metrics.miss === 'number' ? s.metrics.miss : ''
          }));
        }
      });

      const filename = 'sessions-' + (new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-') + '.xlsx';

      if (window.XLSX && typeof window.XLSX.utils !== 'undefined') {
        // SheetJS available
        try {
          const wb = window.XLSX.utils.book_new();
          const ws = window.XLSX.utils.json_to_sheet(rows);
          window.XLSX.utils.book_append_sheet(wb, ws, 'Sessions');
          window.XLSX.writeFile(wb, filename);
          return;
        } catch(e) {
          console.warn('SheetJS export failed, falling back to .xls HTML', e);
        }
      }

      // Fallback: build an HTML table and download as .xls which Excel can open
      let html = '<table><thead><tr>' + Object.keys(rows[0]).map(h => '<th>' + escapeHtml(h) + '</th>').join('') + '</tr></thead><tbody>';
      rows.forEach(r => {
        html += '<tr>' + Object.values(r).map(v => '<td>' + escapeHtml(String(v || '')) + '</td>').join('') + '</tr>';
      });
      html += '</tbody></table>';
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename.replace(/\.xlsx$/, '.xls'); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch(e){ console.error('Export failed', e); alert('Export failed: ' + (e && e.message)); }
  });

  // keyboard accessible dropzone: Enter triggers file input
  dropzone.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' ') fileInput.click(); });

})();
