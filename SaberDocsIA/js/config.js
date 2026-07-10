/* ═══════════════════════════════════════════════════════════════════════
   config.js — Configuración central de la aplicación
   ► El administrador rellena este archivo UNA SOLA VEZ.
   ► Los usuarios no necesitan cambiar nada.
   ═══════════════════════════════════════════════════════════════════════ */

const CONFIG = {

  /* ── Google Cloud API Key ────────────────────────────────────────────
     1. Ve a console.cloud.google.com
     2. Habilita "Cloud Speech-to-Text API"
     3. Crea una API Key y restringe su uso al dominio casalimpia.com.co
     ------------------------------------------------------------------ */
  GOOGLE_STT_API_KEY: '',  // 'AIzaSy...'

  /* ── Google Gemini API Key ───────────────────────────────────────────
     1. Ve a aistudio.google.com/app/apikey
     2. Crea una API Key con tu cuenta @casalimpia.com.co
     ------------------------------------------------------------------ */
  GEMINI_API_KEY: '',       // 'AIzaSy...'
  GEMINI_MODEL: 'gemini-1.5-flash',

  /* ── Google Apps Script Web App ──────────────────────────────────────
     1. Abre script.google.com → Nuevo proyecto
     2. Pega el contenido de google_apps_script/Code.gs
     3. Despliega como Web App:
        - Ejecutar como: Yo (tu cuenta @casalimpia.com.co)
        - Quién puede acceder: Cualquier usuario del dominio
     4. Copia la URL del despliegue aquí
     ------------------------------------------------------------------ */
  APPS_SCRIPT_URL: 'https://script.google.com/a/macros/casalimpia.com/s/AKfycby4MYwV0M93lQVie2aQzNP8fyxb1iy927NZR6CW6KBUuengUJvPvCors-Kk5S8tX8RmsQ/exec',  // 'https://script.google.com/macros/s/.../exec'

  /* ── Google Workspace ────────────────────────────────────────────────
     IDs de las carpetas y hojas de cálculo destino.
     Los encuentras en la URL de Drive/Sheets.
     ------------------------------------------------------------------ */
  DRIVE_FOLDER_ID:    '15h8XYwV_aJ9cSMOsSGQoZQsV111-Gav6',  // ID de la carpeta de instructivos en Drive
  SHEETS_HISTORY_ID:  '1LU_ITYnjTz4Z1Wt-xlZY3yQwUWWv3bx879o0xOwgqXI',  // ID del Google Sheet de historial
  WORKSPACE_DOMAIN:   'casalimpia.com',

  /* ── Parámetros de procesamiento ─────────────────────────────────── */
  STT_CONFIDENCE_THRESHOLD: 0.70,  // por debajo de esto → "⚠️ Validar paso"
  FRAMES_COUNT: 6,                 // fotogramas a extraer por video
  AUDIO_CHUNK_SECONDS: 55,         // segundos por chunk de audio (max STT sync: 60s)
  AUDIO_SAMPLE_RATE: 16000,        // Hz — requerido por Google STT

  /* ── Modo de operación ───────────────────────────────────────────────
     La app detecta automáticamente si las claves están configuradas.
     Si no lo están, funciona en MODO DEMO con datos de muestra.
     ------------------------------------------------------------------ */
  get IS_REAL_MODE() {
    return !!(this.GOOGLE_STT_API_KEY && this.GEMINI_API_KEY && this.APPS_SCRIPT_URL);
  },
};
