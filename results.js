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
    // Flexible extraction, with a special case for the shape you provided:
    // { variant: "B", counts: { A: {...}, B: {...} }, missSummary: { total: N, ... } }
    const metrics = {variant:'—', total:null, miss:0, counts:null, perVariantTotals:null};
    if(!parsed) return metrics;

    // If the top-level is an array of events, use length
    if(Array.isArray(parsed)){
      metrics.total = parsed.length;
      metrics.counts = {events: parsed.length};
      return metrics;
    }

    if(typeof parsed === 'object'){
      metrics.variant = parsed.variant || parsed['summary-variant'] || (parsed.summary && parsed.summary.variant) || parsed.variantName || metrics.variant;

      // Preferred: top-level counts object
      if(parsed.counts && typeof parsed.counts === 'object'){
        metrics.counts = parsed.counts;
        // compute per-variant totals (sum numeric fields except 'miss')
        const per = {};
        let grandTotal = 0;
        for(const [variantKey, obj] of Object.entries(parsed.counts)){
          if(typeof obj === 'object'){
            let s=0;
            for(const [k,v] of Object.entries(obj)){
              if(k === 'miss') continue;
              if(typeof v === 'number') s += v;
            }
            per[variantKey] = s;
            grandTotal += s;
          }
        }
        metrics.perVariantTotals = per;
        metrics.total = grandTotal;

        // miss: prefer missSummary.total, else sum per-variant miss fields
        if(parsed.missSummary && typeof parsed.missSummary.total === 'number'){
          metrics.miss = parsed.missSummary.total;
        } else {
          let missSum = 0;
          for(const obj of Object.values(parsed.counts)){
            if(obj && typeof obj.miss === 'number') missSum += obj.miss;
          }
          metrics.miss = missSum;
        }

        return metrics;
      }

      // fallback heuristics (existing behavior)
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
    const tr = document.createElement('tr');
    // Prefer per-variant totals when available for a clearer summary
    let countsSummary = '';
    if(session.metrics.perVariantTotals && typeof session.metrics.perVariantTotals === 'object'){
      countsSummary = Object.entries(session.metrics.perVariantTotals).map(([k,v])=>`${k}: ${v}`).join('; ');
    } else {
      countsSummary = summarizeCounts(session.metrics.counts);
    }

    tr.innerHTML = `
      <td>${escapeHtml(session.name)}</td>
      <td>${escapeHtml(String(session.metrics.variant || '—'))}</td>
      <td>${escapeHtml(String(session.metrics.total))}</td>
      <td>${escapeHtml(String(session.metrics.miss || 0))}</td>
      <td>${escapeHtml(countsSummary)}</td>
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

  // keyboard accessible dropzone: Enter triggers file input
  dropzone.addEventListener('keydown', e=>{ if(e.key === 'Enter' || e.key === ' ') fileInput.click(); });

})();
