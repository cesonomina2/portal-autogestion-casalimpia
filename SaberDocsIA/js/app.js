/* ═══════════════════════════════════════════════════════════════════════
   app.js — Lógica principal
   Funciona 100% en el navegador. Sin servidor Python.
   Modo DEMO si config.js no tiene API keys. Modo REAL si las tiene.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const state = {
    file:        null,
    isProcessing: false,
    history:     [],
    stagesBuilt: false,
    startTime:   0,
  };

  /* ═══════════════════════════════════════════════════════════════════
     Etapas del pipeline real
  ═══════════════════════════════════════════════════════════════════ */
  const REAL_STAGES = [
    { id: 'frames',      label: 'Extracción de fotogramas',   desc: 'Canvas API extrae imágenes clave del video' },
    { id: 'audio',       label: 'Extracción de audio',        desc: 'Web Audio API obtiene el audio del video' },
    { id: 'stt',         label: 'Transcripción (Google STT)', desc: 'Convierte el audio a texto en español colombiano' },
    { id: 'ai',          label: 'Generación del instructivo', desc: 'Gemini redacta los pasos en modo imperativo formal' },
    { id: 'docs',        label: 'Creación de documentos',     desc: 'Google Apps Script crea el Doc y el Slides en Drive' },
    { id: 'history',     label: 'Registro en historial',      desc: 'Guarda el instructivo en Google Sheets' },
  ];

  /* ═══════════════════════════════════════════════════════════════════
     Init
  ═══════════════════════════════════════════════════════════════════ */
  function init() {
    setupModeBadge();
    setupTabs();
    setupDropzone();
    setupForm();
    setupConfig();
    loadHistory();
  }

  function setupModeBadge() {
    const isReal = CONFIG.IS_REAL_MODE;
    const badge  = $('#modeBadge');
    $('#modeText').textContent = isReal ? 'MODO REAL' : 'MODO DEMO';
    if (isReal) badge.classList.add('real');
  }

  /* ═══════════════════════════════════════════════════════════════════
     Tabs
  ═══════════════════════════════════════════════════════════════════ */
  function setupTabs() {
    $$('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.nav-tab').forEach(t => t.classList.remove('active'));
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        $(`#tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Dropzone
  ═══════════════════════════════════════════════════════════════════ */
  function setupDropzone() {
    const zone  = $('#dropzone');
    const input = $('#fileInput');

    $('#btnSelectFile').addEventListener('click', () => input.click());
    zone.addEventListener('click', e => { if (e.target === zone || e.target.closest('.upload-card')) input.click(); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp4','avi','mov','mkv'].includes(ext)) {
      showToast('Formato no admitido. Use MP4, AVI, MOV o MKV.', 'error'); return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showToast('El archivo supera el límite de 500 MB.', 'error'); return;
    }
    state.file = file;

    $('#dropzone').classList.add('hidden');
    const prev = $('#filePreview');
    prev.classList.remove('hidden');
    prev.innerHTML = `
      <div class="file-preview-inner">
        <svg class="file-icon" width="32" height="32" fill="none" stroke="#2e86c1" stroke-width="2" viewBox="0 0 24 24">
          <polygon points="23 7 16 1 1 1 1 23 23 23 23 7"/><polyline points="16 1 16 7 23 7"/>
        </svg>
        <div class="file-info">
          <span class="file-name">${file.name}</span>
          <span class="file-size">${fmtBytes(file.size)}</span>
        </div>
        <button class="btn-icon" id="btnRemoveFile" title="Quitar archivo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
    $('#btnRemoveFile').addEventListener('click', removeFile);
    $('#btnProcess').disabled = false;
  }

  function removeFile() {
    state.file = null;
    $('#fileInput').value = '';
    $('#dropzone').classList.remove('hidden');
    $('#filePreview').classList.add('hidden');
    $('#btnProcess').disabled = true;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Formulario
  ═══════════════════════════════════════════════════════════════════ */
  function setupForm() {
    $('#btnProcess').addEventListener('click', handleSubmit);
    $('#btnNewProcess').addEventListener('click', resetFlow);
  }

  function getFormValues() {
    return {
      proceso:       $('#inputProceso').value.trim(),
      area:          $('#selectArea').value,
      version:       $('#inputVersion').value.trim() || '1.0',
      includeSlides: $('#checkSlides').checked,
    };
  }

  function validate() {
    const p = $('#inputProceso');
    if (!p.value.trim()) { p.classList.add('error'); showToast('Ingrese el nombre del proceso.', 'error'); return false; }
    p.classList.remove('error');
    if (!state.file) { showToast('Seleccione un archivo de video primero.', 'error'); return false; }
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Pipeline principal
  ═══════════════════════════════════════════════════════════════════ */
  async function handleSubmit() {
    if (state.isProcessing || !validate()) return;
    state.isProcessing = true;
    state.startTime    = Date.now();

    const meta   = getFormValues();
    const stages = CONFIG.IS_REAL_MODE ? REAL_STAGES : MOCK.STAGES;

    showSection('processing');
    buildStagesList(stages);
    updateProgress(0);

    if (CONFIG.IS_REAL_MODE) {
      await runReal(meta, stages);
    } else {
      await runDemo(meta);
    }
  }

  /* ── Modo DEMO ───────────────────────────────────────────────────── */
  async function runDemo(meta) {
    await MOCK.runPipeline(meta, {
      onStageStart:    (i) => setStageStatus(i, 'active', '0%'),
      onStageProgress: (i, pct) => {
        setStageProgress(i, pct);
        const total   = MOCK.STAGES.length;
        const overall = Math.round((i / total) * 100 + (pct / 100) * (100 / total));
        updateProgress(overall);
      },
      onStageDone: (i) => setStageStatus(i, 'done', 'Completado'),
      onComplete:  (result) => {
        state.isProcessing = false;
        updateProgress(100);
        const elapsed = Math.round((Date.now() - state.startTime) / 1000);
        result.stats.duracion_proceso = elapsed;
        addToHistory(result, meta);
        showSection('result');
        renderResult(result, meta);
        showToast('Instructivo generado en modo demo', 'success');
      },
    });
  }

  /* ── Modo REAL ───────────────────────────────────────────────────── */
  async function runReal(meta, stages) {
    try {
      const totalStages = stages.length;
      let result;

      /* Etapa 0: Extraer frames */
      setStageStatus(0, 'active', '0%');
      const frames = await VideoProcessor.extractFrames(state.file, CONFIG.FRAMES_COUNT, pct => {
        setStageProgress(0, pct);
        updateProgress(Math.round((0 / totalStages) * 100 + (pct / 100) * (100 / totalStages)));
      });
      setStageStatus(0, 'done', 'Completado');

      /* Etapa 1: Extraer audio */
      setStageStatus(1, 'active', '0%');
      const audioChunks = await VideoProcessor.extractAudioChunks(state.file, (pct, msg) => {
        setStageProgress(1, pct);
        updateProgress(Math.round((1 / totalStages) * 100 + (pct / 100) * (100 / totalStages)));
        $('#processingStageLabel').textContent = msg;
      });
      setStageStatus(1, 'done', 'Completado');

      /* Etapa 2: Transcripción STT */
      setStageStatus(2, 'active', '0%');
      const transcript = await STTService.transcribeAll(audioChunks, (pct, msg) => {
        setStageProgress(2, pct);
        updateProgress(Math.round((2 / totalStages) * 100 + (pct / 100) * (100 / totalStages)));
        $('#processingStageLabel').textContent = msg;
      });
      setStageStatus(2, 'done', 'Completado');

      /* Etapa 3: Generar instructivo con Gemini */
      setStageStatus(3, 'active', '0%');
      setStageProgress(3, 30);
      updateProgress(Math.round((3 / totalStages) * 100 + 0.3 * (100 / totalStages)));
      const instructivoData = await AIService.generateInstructivo(
        transcript.texto, meta,
        transcript.segmentos.filter(s => s.confianza < CONFIG.STT_CONFIDENCE_THRESHOLD).length
      );
      setStageStatus(3, 'done', 'Completado');
      updateProgress(Math.round((4 / totalStages) * 100));

      /* Etapa 4: Crear documentos en Google Workspace */
      setStageStatus(4, 'active', '0%');
      setStageProgress(4, 50);
      const docs = await WorkspaceService.createDocuments(instructivoData, frames, meta);
      setStageStatus(4, 'done', 'Completado');
      updateProgress(Math.round((5 / totalStages) * 100));

      /* Etapa 5: Historial (el Apps Script ya lo registra; solo actualizamos UI) */
      setStageStatus(5, 'active', '0%');
      await _sleep(600);
      setStageStatus(5, 'done', 'Completado');
      updateProgress(100);

      /* Construir resultado */
      const elapsed = Math.round((Date.now() - state.startTime) / 1000);
      result = {
        titulo:    instructivoData.titulo,
        steps:     instructivoData.pasos || [],
        doc_url:   docs.doc_url   || '#',
        slides_url: docs.slides_url || null,
        stats: {
          pasos:            (instructivoData.pasos || []).length,
          duracion_proceso: elapsed,
          confianza_stt:    transcript.confianza_promedio,
          advertencias:     instructivoData.advertencias || 0,
        },
      };

      state.isProcessing = false;
      addToHistory(result, meta);
      showSection('result');
      renderResult(result, meta);
      showToast('¡Instructivo generado y publicado en Google Drive!', 'success');

    } catch (err) {
      state.isProcessing = false;
      showToast(`Error: ${err.message}`, 'error');
      showSection('upload');
      console.error(err);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     UI — Secciones y stages
  ═══════════════════════════════════════════════════════════════════ */
  function showSection(name) {
    $$('.flow-section').forEach(s => s.classList.add('hidden'));
    $(`#section-${name}`).classList.remove('hidden');
  }

  function resetFlow() {
    state.isProcessing = false;
    state.file         = null;
    $('#fileInput').value = '';
    $('#inputProceso').value = '';
    $('#inputVersion').value = '';
    $('#dropzone').classList.remove('hidden');
    $('#filePreview').classList.add('hidden');
    $('#btnProcess').disabled = true;
    state.stagesBuilt = false;
    showSection('upload');
  }

  function buildStagesList(stages) {
    const container = $('#stagesList');
    container.innerHTML = '';
    stages.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'stage-item';
      div.id = `stage-${i}`;
      div.innerHTML = `
        <div class="stage-icon">${i + 1}</div>
        <div class="stage-info">
          <div class="stage-label">${s.label}</div>
          <div class="stage-desc">${s.desc}</div>
          <div class="stage-mini-bar"><div class="stage-mini-fill" id="stageFill-${i}"></div></div>
        </div>
        <div class="stage-status" data-status>Pendiente</div>`;
      container.appendChild(div);
    });
    state.stagesBuilt = true;
  }

  function setStageStatus(i, status, label) {
    const item = $(`#stage-${i}`);
    if (!item) return;
    item.className = `stage-item ${status}`;
    const icon = $('.stage-icon', item);
    icon.innerHTML = status === 'done'
      ? `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
      : (i + 1);
    $('[data-status]', item).textContent = label;
  }

  function setStageProgress(i, pct) {
    const fill = $(`#stageFill-${i}`);
    if (fill) fill.style.width = `${pct}%`;
  }

  function updateProgress(pct) {
    $('#overallBar').style.width = `${pct}%`;
    $('#progressPct').textContent = `${pct}%`;
    if (pct < 100) $('#processingStageLabel').textContent = `Procesando... ${pct}% completado`;
    else           $('#processingStageLabel').textContent = 'Pipeline completado ✓';
  }

  /* ═══════════════════════════════════════════════════════════════════
     Resultado
  ═══════════════════════════════════════════════════════════════════ */
  function renderResult(result, meta) {
    const st = result.stats || {};
    $('#resultTitle').textContent = meta.proceso || result.titulo || 'Instructivo generado';
    $('#resultMeta').textContent  = `Área: ${meta.area} · Versión: ${meta.version} · ${new Date().toLocaleDateString('es-CO')}`;

    $('#statPasos').textContent     = st.pasos || result.steps?.length || 0;
    $('#statDuracion').textContent  = fmtSec(st.duracion_proceso || 0);
    $('#statConfianza').textContent = st.confianza_stt ? `${st.confianza_stt}%` : '—';
    $('#statAlertas').textContent   = st.advertencias ?? 0;

    $('#btnOpenDoc').onclick     = () => window.open(result.doc_url || '#', '_blank');
    $('#btnDownloadPdf').onclick = () => showToast('PDF disponible solo con Google Docs abierto → Archivo → Descargar', 'info');

    const slidesCard = $('#slidesCard');
    if (result.slides_url) {
      slidesCard.classList.remove('hidden');
      slidesCard.onclick = () => window.open(result.slides_url, '_blank');
    } else {
      slidesCard.classList.add('hidden');
    }

    /* Preview del instructivo */
    const previewData = CONFIG.IS_REAL_MODE
      ? { titulo: result.titulo, meta: { ...meta, codigo: '[PENDIENTE — Área de Procesos]', vigencia: '[PENDIENTE — Área de Procesos]' }, steps: result.steps }
      : { ...MOCK.SAMPLE_INSTRUCTIVO, meta: { ...MOCK.SAMPLE_INSTRUCTIVO.meta, proceso: meta.proceso, area: meta.area, version: meta.version } };

    $('#instructivoPreview').innerHTML = MOCK.renderInstructivo(previewData);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Historial
  ═══════════════════════════════════════════════════════════════════ */
  async function loadHistory() {
    let items = MOCK.SAMPLE_HISTORY;
    if (CONFIG.IS_REAL_MODE) {
      try { items = await WorkspaceService.getHistory(); } catch { /* cae a mock */ }
    }
    state.history = [...items];
    renderHistory();
  }

  function addToHistory(result, meta) {
    state.history.unshift({
      id:      `INST-${new Date().getFullYear()}-${String(state.history.length + 1).padStart(3, '0')}`,
      proceso: meta.proceso,
      area:    meta.area,
      fecha:   new Date().toISOString().slice(0, 10),
      duracion: fmtSec(result.stats?.duracion_proceso || 0),
      pasos:   result.steps?.length || result.stats?.pasos || 0,
      estado:  'Pendiente nomenclatura',
      doc_url: result.doc_url || '#',
    });
    renderHistory();
  }

  function renderHistory() {
    const body  = $('#historyBody');
    const empty = $('#historyEmpty');
    const table = $('#historyTable');

    if (!state.history.length) {
      empty.classList.remove('hidden'); table.classList.add('hidden'); return;
    }
    empty.classList.add('hidden'); table.classList.remove('hidden');

    body.innerHTML = state.history.map(h => `
      <tr>
        <td style="font-weight:600;color:var(--azul)">${h.id}</td>
        <td>${h.proceso}</td>
        <td>${h.area}</td>
        <td>${h.fecha}</td>
        <td>${h.duracion}</td>
        <td>${h.pasos}</td>
        <td><span class="status-pill ${h.estado === 'Aprobado' ? 'status-approved' : 'status-pending'}">${h.estado}</span></td>
        <td><a class="history-link" href="${h.doc_url}" target="_blank">Ver Doc</a></td>
      </tr>`).join('');

    $('#historyCount').textContent = `${state.history.length} registros`;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Configuración (tab)
  ═══════════════════════════════════════════════════════════════════ */
  function setupConfig() {
    /* Mostrar el estado actual de las API keys en la tab de configuración */
    updateApiStatus('google-stt',       !!CONFIG.GOOGLE_STT_API_KEY);
    updateApiStatus('claude',           !!CONFIG.GEMINI_API_KEY);
    updateApiStatus('google-workspace', !!CONFIG.APPS_SCRIPT_URL);

    /* Botón probar conexión — verifica las keys con un ping real */
    $('#btnTestConnection').addEventListener('click', async () => {
      const btn = $('#btnTestConnection');
      btn.disabled = true;
      $('#connectionDot').className = 'status-dot status-unknown';
      $('#connectionText').textContent = 'Verificando...';

      const ok = await _pingApis();
      $('#connectionDot').className = `status-dot ${ok ? 'status-ok' : 'status-error'}`;
      $('#connectionText').textContent = ok
        ? 'Todo OK — Modo real activo'
        : 'Alguna clave no respondió — revise config.js';
      btn.disabled = false;
      setupModeBadge();
    });

    $('#btnSaveConfig').addEventListener('click', () => {
      showToast('Edite js/config.js directamente para guardar las claves de API.', 'info');
    });
  }

  async function _pingApis() {
    /* Ping rápido a Gemini con texto mínimo */
    if (!CONFIG.GEMINI_API_KEY) return false;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}?key=${CONFIG.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return res.ok;
    } catch { return false; }
  }

  function updateApiStatus(id, ok) {
    const el = $(`#badge-${id}`);
    if (el) { el.textContent = ok ? 'Configurado' : 'Pendiente'; el.className = `api-badge ${ok ? 'ok' : 'pending'}`; }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Toast
  ═══════════════════════════════════════════════════════════════════ */
  let _toastTimer = null;
  function showToast(msg, type = 'info') {
    const toast = $('#toast');
    const icons = {
      success: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
      error:   '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info:    '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    };
    toast.className = `toast ${type}`;
    $('#toastIcon').innerHTML = icons[type] || icons.info;
    $('#toastText').textContent = msg;
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.add('hidden'), 5000);
  }

  /* ── Utilidades ───────────────────────────────────────────────────── */
  function fmtBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  }
  function fmtSec(s) {
    if (!s) return '—';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s/60)}m ${s%60}s`;
  }
  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  document.addEventListener('DOMContentLoaded', init);
})();
