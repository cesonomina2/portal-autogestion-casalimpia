/* ═══════════════════════════════════════════════════════════════════════
   stt_service.js — Google Cloud Speech-to-Text REST API
   Llamado directo desde el navegador. Sin servidor intermedio.
   ═══════════════════════════════════════════════════════════════════════ */

const STTService = (() => {

  const STT_URL = 'https://speech.googleapis.com/v1/speech:recognize';

  /**
   * Transcribe todos los chunks de audio y devuelve el resultado unificado.
   * @param {Uint8Array[]} audioChunks  - Chunks WAV del video
   * @param {Function}     onProgress   - Callback(porcentaje, mensaje)
   * @returns {{ texto: string, segmentos: object[], confianza_promedio: number }}
   */
  async function transcribeAll(audioChunks, onProgress) {
    const apiKey  = CONFIG.GOOGLE_STT_API_KEY;
    const results = [];

    for (let i = 0; i < audioChunks.length; i++) {
      if (onProgress) {
        onProgress(
          Math.round(((i) / audioChunks.length) * 100),
          `Transcribiendo segmento ${i + 1} de ${audioChunks.length}...`
        );
      }

      const chunk  = audioChunks[i];
      const b64    = VideoProcessor.uint8ToBase64(chunk);
      const result = await _transcribeChunk(b64, apiKey);
      results.push(result);
    }

    if (onProgress) onProgress(100, 'Transcripción completa');

    return _mergeResults(results);
  }

  /** Llama a la API REST de Google STT para un chunk individual. */
  async function _transcribeChunk(base64Audio, apiKey) {
    const body = {
      config: {
        encoding:                'LINEAR16',
        sampleRateHertz:         CONFIG.AUDIO_SAMPLE_RATE,
        languageCode:            'es-CO',
        model:                   'latest_long',
        enableWordTimeOffsets:   false,
        enableAutomaticPunctuation: true,
        metadata: {
          interactionType:       'VOICE_COMMAND',
          microphoneDistance:    'NEARFIELD',
          originalMediaType:     'VIDEO',
        },
      },
      audio: { content: base64Audio },
    };

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${STT_URL}?key=${apiKey}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        return _parseSTTResponse(data);
      } catch (err) {
        lastError = err;
        if (attempt < 2) await _sleep(1000 * (attempt + 1));
      }
    }

    throw new Error(`Google STT falló: ${lastError.message}`);
  }

  /** Convierte la respuesta de la API en el formato interno. */
  function _parseSTTResponse(data) {
    const segmentos = [];
    let texto = '';

    (data.results || []).forEach(result => {
      const alt        = result.alternatives?.[0];
      if (!alt) return;
      const confianza  = alt.confidence ?? 0.8;
      const transcrito = alt.transcript ?? '';

      const textoFinal = confianza < CONFIG.STT_CONFIDENCE_THRESHOLD
        ? `[Texto pendiente de validación — audio no claro: ${transcrito}]`
        : transcrito;

      segmentos.push({ texto: textoFinal, confianza });
      texto += (texto ? ' ' : '') + textoFinal;
    });

    const confianzaPromedio = segmentos.length
      ? segmentos.reduce((sum, s) => sum + s.confianza, 0) / segmentos.length
      : 0;

    return { texto, segmentos, confianza_promedio: confianzaPromedio };
  }

  /** Une los resultados de todos los chunks en uno solo. */
  function _mergeResults(results) {
    const texto     = results.map(r => r.texto).filter(Boolean).join(' ');
    const segmentos = results.flatMap(r => r.segmentos);
    const confianza = segmentos.length
      ? segmentos.reduce((s, r) => s + r.confianza, 0) / segmentos.length
      : 0;
    return { texto, segmentos, confianza_promedio: Math.round(confianza * 100) };
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { transcribeAll };
})();
