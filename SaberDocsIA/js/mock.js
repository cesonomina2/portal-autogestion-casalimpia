/* ═══════════════════════════════════════════════════════════════════════
   mock.js — Datos de demostración y simulación de pipeline
   ═══════════════════════════════════════════════════════════════════════ */

const MOCK = (() => {

  /* ── Etapas del pipeline ─────────────────────────────────────────── */
  const STAGES = [
    { id: 'extraction',     label: 'Extracción de frames y audio',  desc: 'FFmpeg procesa el video y extrae fotogramas clave' },
    { id: 'transcription',  label: 'Transcripción con Google STT',  desc: 'Convierte el audio a texto en español colombiano' },
    { id: 'generation',     label: 'Generación del instructivo',    desc: 'Claude redacta los pasos en modo imperativo formal' },
    { id: 'document',       label: 'Creación del Google Doc',       desc: 'Publica el borrador en Google Workspace' },
    { id: 'slides',         label: 'Generación de presentación',    desc: 'Crea las diapositivas con capturas del video' },
    { id: 'history',        label: 'Registro en historial',         desc: 'Guarda el evento en Google Sheets' },
  ];

  /* ── Instructivo de muestra ──────────────────────────────────────── */
  const SAMPLE_INSTRUCTIVO = {
    title: 'Instructivo de uso: Módulo de Solicitudes',
    meta: {
      proceso: 'Gestión de Solicitudes de Servicio',
      area: 'Operaciones',
      version: '1.0',
      fecha: new Date().toISOString().slice(0,10),
      codigo: '[PENDIENTE — Área de Procesos]',
      vigencia: '[PENDIENTE — Área de Procesos]',
    },
    objective: 'Describir el procedimiento para registrar y gestionar solicitudes de servicio a través del módulo de solicitudes, garantizando el correcto seguimiento de cada requerimiento operativo.',
    steps: [
      {
        num: 1,
        title: 'Acceder al módulo de solicitudes',
        desc: 'Inicie sesión en el sistema con sus credenciales corporativas y diríjase al menú principal. Seleccione la opción "Solicitudes" ubicada en la barra de navegación izquierda.',
        image: true,
      },
      {
        num: 2,
        title: 'Crear una nueva solicitud',
        desc: 'Haga clic en el botón "Nueva Solicitud" (ícono "+" en la esquina superior derecha). Complete los campos obligatorios: Tipo de servicio, Área solicitante, Prioridad y Descripción detallada.',
        note: '⚠️ Validar paso — segmento de audio con baja confianza (0.62). Verifique que el campo "Prioridad" corresponda con la urgencia real.',
        image: true,
      },
      {
        num: 3,
        title: 'Adjuntar documentos de soporte',
        desc: 'En la sección "Adjuntos", cargue los documentos requeridos según el tipo de solicitud. Formatos admitidos: PDF, DOCX, XLSX, JPG, PNG. Tamaño máximo por archivo: 10 MB.',
        image: true,
      },
      {
        num: 4,
        title: 'Asignar responsable y fecha límite',
        desc: 'Seleccione el colaborador responsable del seguimiento en el campo "Asignado a". Establezca la fecha límite de atención. El sistema enviará notificación automática al responsable seleccionado.',
        image: false,
      },
      {
        num: 5,
        title: 'Enviar y confirmar la solicitud',
        desc: 'Revise toda la información ingresada. Haga clic en "Enviar solicitud". El sistema generará un número de radicado único que deberá conservar para el seguimiento posterior.',
        image: true,
      },
      {
        num: 6,
        title: 'Hacer seguimiento al estado',
        desc: 'Consulte el estado de su solicitud en cualquier momento desde la sección "Mis Solicitudes". Los estados posibles son: Radicada, En gestión, En revisión, Cerrada o Rechazada.',
        image: false,
      },
    ],
  };

  /* ── Historial de muestra ────────────────────────────────────────── */
  const SAMPLE_HISTORY = [
    {
      id: 'INST-2026-001',
      proceso: 'Proceso de Facturación Electrónica',
      area: 'Finanzas',
      fecha: '2026-07-08',
      duracion: '04:32',
      pasos: 8,
      estado: 'Aprobado',
      doc_url: '#',
    },
    {
      id: 'INST-2026-002',
      proceso: 'Registro de Novedades de Nómina',
      area: 'Talento Humano',
      fecha: '2026-07-09',
      duracion: '06:15',
      pasos: 11,
      estado: 'Pendiente nomenclatura',
      doc_url: '#',
    },
    {
      id: 'INST-2026-003',
      proceso: 'Cierre de Turno Operativo',
      area: 'Operaciones',
      fecha: '2026-07-10',
      duracion: '03:48',
      pasos: 7,
      estado: 'Pendiente nomenclatura',
      doc_url: '#',
    },
  ];

  /* ── Generación de instructivo HTML ─────────────────────────────── */
  function renderInstructivo(data) {
    const { title, meta, steps } = data;

    const stepsHtml = steps.map(s => `
      <div class="step-block">
        <div class="step-number">${s.num}</div>
        <div class="step-content">
          <div class="step-title">${s.title}</div>
          <div class="step-desc">${s.desc}</div>
          ${s.note ? `<div class="step-note">${s.note}</div>` : ''}
          ${s.image ? `
            <div class="step-image-placeholder">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>[Imagen ${s.num}. Captura del video]</span>
            </div>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="instructivo-header">
        <h1>${title}</h1>
        <div class="instructivo-meta-grid">
          <div class="instructivo-meta-item">
            <strong>Proceso</strong>${meta.proceso}
          </div>
          <div class="instructivo-meta-item">
            <strong>Área</strong>${meta.area}
          </div>
          <div class="instructivo-meta-item">
            <strong>Versión</strong>${meta.version}
          </div>
          <div class="instructivo-meta-item">
            <strong>Código</strong><span class="pending-tag">${meta.codigo}</span>
          </div>
          <div class="instructivo-meta-item">
            <strong>Fecha elaboración</strong>${meta.fecha}
          </div>
          <div class="instructivo-meta-item">
            <strong>Vigencia</strong><span class="pending-tag">${meta.vigencia}</span>
          </div>
        </div>
      </div>
      <div class="instructivo-steps">${stepsHtml}</div>
    `;
  }

  /* ── Simulación del pipeline ─────────────────────────────────────── */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function runPipeline(formData, callbacks) {
    const { onStageStart, onStageProgress, onStageDone, onComplete } = callbacks;
    const totalStages = STAGES.length;
    const stageDurations = [3200, 5500, 6000, 2500, 3000, 1200];

    for (let i = 0; i < totalStages; i++) {
      const stage = STAGES[i];
      onStageStart(i, stage);

      const duration = stageDurations[i];
      const steps = 20;
      for (let s = 0; s <= steps; s++) {
        await sleep(duration / steps);
        const pct = Math.round((s / steps) * 100);
        onStageProgress(i, pct);
      }

      onStageDone(i, stage);
      await sleep(200);
    }

    const result = {
      ...SAMPLE_INSTRUCTIVO,
      meta: {
        ...SAMPLE_INSTRUCTIVO.meta,
        proceso: formData.proceso || SAMPLE_INSTRUCTIVO.meta.proceso,
        area: formData.area || SAMPLE_INSTRUCTIVO.meta.area,
        version: formData.version || SAMPLE_INSTRUCTIVO.meta.version,
      },
      doc_url: '#',
      slides_url: formData.includeSlides ? '#' : null,
      stats: {
        pasos: SAMPLE_INSTRUCTIVO.steps.length,
        duracion_proceso: Math.round(21200 / 1000),
        confianza_stt: 87,
        advertencias: 1,
      },
    };

    onComplete(result);
  }

  return { STAGES, SAMPLE_INSTRUCTIVO, SAMPLE_HISTORY, renderInstructivo, runPipeline };
})();
