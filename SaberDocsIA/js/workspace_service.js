/* ═══════════════════════════════════════════════════════════════════════
   workspace_service.js — Google Apps Script Web App
   Crea documentos en Google Workspace sin servidor propio.
   ═══════════════════════════════════════════════════════════════════════ */

const WorkspaceService = (() => {

  /**
   * Envía el instructivo al Apps Script para crear el Google Doc.
   * @returns {{ doc_url, slides_url|null }}
   */
  async function createDocuments(instructivoData, frames, metadata) {
    const url = CONFIG.APPS_SCRIPT_URL;
    if (!url) throw new Error('APPS_SCRIPT_URL no configurada en config.js');

    const payload = {
      action:   'createInstructivo',
      metadata: {
        proceso:   metadata.proceso,
        area:      metadata.area,
        version:   metadata.version,
        domain:    CONFIG.WORKSPACE_DOMAIN,
        folderId:  CONFIG.DRIVE_FOLDER_ID,
        sheetsId:  CONFIG.SHEETS_HISTORY_ID,
        includeSlides: metadata.includeSlides || false,
      },
      instructivo: instructivoData,
      frames: frames,   // array de base64 JPEG (máximo 6 imágenes)
    };

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script no acepta application/json cross-origin
      body:    JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Respuesta inválida de Apps Script'); }

    if (data.error) throw new Error(data.error);
    return data;
  }

  /**
   * Obtiene el historial desde Google Sheets vía Apps Script.
   */
  async function getHistory() {
    const url = CONFIG.APPS_SCRIPT_URL;
    if (!url) return [];

    try {
      const res  = await fetch(`${url}?action=getHistory`, { redirect: 'follow' });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  return { createDocuments, getHistory };
})();
