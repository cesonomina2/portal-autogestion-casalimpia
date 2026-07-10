/* ═══════════════════════════════════════════════════════════════════════
   ai_service.js — Google Gemini REST API
   Reemplaza Claude. Soporta CORS nativo desde el navegador.
   ═══════════════════════════════════════════════════════════════════════ */

const AIService = (() => {

  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  const SYSTEM_PROMPT = `Eres un experto redactor de instructivos técnicos para la empresa Casalimpia (empresa de aseo y servicios).
Tu tarea es convertir una transcripción de grabación de pantalla en un instructivo paso a paso.

REGLAS OBLIGATORIAS:
1. Usa modo imperativo formal en español colombiano: "Ingrese", "Seleccione", "Haga clic", "Diríjase".
2. Cada paso debe tener máximo 3 líneas de descripción.
3. Divide la transcripción en pasos lógicos y secuenciales.
4. Si un segmento contiene "[Texto pendiente de validación]", agrega nota: "⚠️ Validar paso — audio poco claro en grabación original."
5. El código del documento y la vigencia SIEMPRE deben ser "[PENDIENTE — Área de Procesos]".
6. El título del instructivo debe empezar con "Instructivo de uso: " seguido del nombre del proceso.
7. Genera entre 5 y 15 pasos según la complejidad del proceso.

FORMATO DE RESPUESTA — devuelve ÚNICAMENTE el JSON, sin texto adicional:
{
  "titulo": "Instructivo de uso: [nombre del proceso]",
  "objetivo": "Describir el procedimiento para [acción] en [sistema/herramienta], garantizando [beneficio].",
  "pasos": [
    {
      "numero": 1,
      "titulo": "Título del paso (5-8 palabras)",
      "descripcion": "Descripción imperativa del paso. Máximo 3 líneas.",
      "nota": null
    }
  ],
  "advertencias": 0
}`;

  /**
   * Genera el instructivo a partir de la transcripción y los metadatos.
   * @param {string} transcripcion  - Texto de la transcripción
   * @param {object} metadata       - { proceso, area, version }
   * @param {number} advertencias   - Número de segmentos con baja confianza
   * @returns {object}              - JSON del instructivo
   */
  async function generateInstructivo(transcripcion, metadata, advertencias = 0) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    const model  = CONFIG.GEMINI_MODEL;

    const userPrompt = `
Proceso: ${metadata.proceso}
Área: ${metadata.area}
Versión: ${metadata.version}
Segmentos con baja confianza STT: ${advertencias}

TRANSCRIPCIÓN COMPLETA:
${transcripcion || '[Sin transcripción disponible — generar pasos genéricos del proceso indicado]'}

Genera el instructivo JSON según las reglas del sistema.`.trim();

    const body = {
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
      ],
      generationConfig: {
        temperature:     0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `${BASE_URL}/${model}:generateContent?key=${apiKey}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data   = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        /* Gemini a veces envuelve el JSON en ```json ``` */
        const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed  = JSON.parse(jsonStr);

        /* Normaliza la estructura mínima */
        if (!parsed.pasos) parsed.pasos = [];
        parsed.advertencias = parsed.advertencias ?? advertencias;
        return parsed;

      } catch (err) {
        lastError = err;
        if (attempt < 2) await _sleep(1500 * (attempt + 1));
      }
    }

    throw new Error(`Google Gemini falló: ${lastError.message}`);
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { generateInstructivo };
})();
