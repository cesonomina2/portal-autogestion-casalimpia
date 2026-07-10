/* ═══════════════════════════════════════════════════════════════════════
   video_processor.js — Extracción de frames y audio directamente en el
   navegador usando Canvas API + Web Audio API. Sin servidor, sin librerías.
   ═══════════════════════════════════════════════════════════════════════ */

const VideoProcessor = (() => {

  /* ── Extracción de fotogramas clave ──────────────────────────────── */

  /**
   * Extrae N fotogramas distribuidos uniformemente del video.
   * Retorna array de strings base64 (JPEG).
   */
  async function extractFrames(file, count = CONFIG.FRAMES_COUNT, onProgress) {
    return new Promise((resolve, reject) => {
      const video    = document.createElement('video');
      const url      = URL.createObjectURL(file);
      const frames   = [];
      const canvas   = document.createElement('canvas');
      const ctx      = canvas.getContext('2d');

      video.preload  = 'metadata';
      video.muted    = true;
      video.src      = url;

      video.addEventListener('loadedmetadata', () => {
        const duration   = video.duration;
        const timestamps = [];

        /* Distribuye los fotogramas evitando los primeros/últimos 5% */
        for (let i = 0; i < count; i++) {
          const t = (duration * 0.05) + (duration * 0.90 * i / Math.max(count - 1, 1));
          timestamps.push(Math.min(t, duration - 0.1));
        }

        canvas.width  = 1280;
        canvas.height = Math.round(1280 / (video.videoWidth / video.videoHeight)) || 720;

        let idx = 0;

        function seekNext() {
          if (idx >= timestamps.length) {
            URL.revokeObjectURL(url);
            resolve(frames);
            return;
          }
          video.currentTime = timestamps[idx];
        }

        video.addEventListener('seeked', () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.82).split(',')[1]);
          if (onProgress) onProgress(Math.round(((idx + 1) / timestamps.length) * 100));
          idx++;
          seekNext();
        });

        seekNext();
      });

      video.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo cargar el video. Verifique el formato (MP4, AVI, MOV, MKV).'));
      });
    });
  }

  /* ── Extracción y codificación de audio ──────────────────────────── */

  /**
   * Extrae el audio del video y lo divide en chunks WAV listos para
   * enviar a Google Speech-to-Text.
   * Retorna array de Uint8Array (WAV, 16kHz, mono, 16-bit).
   */
  async function extractAudioChunks(file, onProgress) {
    const sampleRate   = CONFIG.AUDIO_SAMPLE_RATE;
    const chunkSeconds = CONFIG.AUDIO_CHUNK_SECONDS;

    if (onProgress) onProgress(0, 'Leyendo archivo de video...');

    /* 1. Leer el archivo como ArrayBuffer */
    const arrayBuffer = await file.arrayBuffer();

    if (onProgress) onProgress(20, 'Decodificando audio...');

    /* 2. Decodificar el audio con Web Audio API */
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
    let audioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
      throw new Error('No se pudo extraer el audio del video. Asegúrese de que el archivo tenga pista de audio.');
    } finally {
      audioCtx.close();
    }

    if (onProgress) onProgress(50, 'Preparando chunks de audio...');

    /* 3. Mezclar a mono (promedio de canales) */
    const numChannels  = audioBuffer.numberOfChannels;
    const totalSamples = audioBuffer.length;
    const mono         = new Float32Array(totalSamples);

    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < totalSamples; i++) mono[i] += data[i] / numChannels;
    }

    /* 4. Dividir en chunks de chunkSeconds segundos */
    const samplesPerChunk = sampleRate * chunkSeconds;
    const chunks = [];

    for (let start = 0; start < totalSamples; start += samplesPerChunk) {
      const end   = Math.min(start + samplesPerChunk, totalSamples);
      const slice = mono.slice(start, end);
      chunks.push(_encodeWAV(slice, sampleRate));

      const pct = 50 + Math.round(((start + samplesPerChunk) / totalSamples) * 50);
      if (onProgress) onProgress(Math.min(pct, 99), `Chunk ${chunks.length} preparado...`);
    }

    if (onProgress) onProgress(100, `${chunks.length} segmentos listos`);
    return chunks;
  }

  /* ── Codificador WAV (LINEAR16) ──────────────────────────────────── */

  function _encodeWAV(pcmFloat32, sampleRate) {
    const numCh   = 1;
    const bps     = 16; // bits per sample
    const dataLen = pcmFloat32.length * 2;
    const buf     = new ArrayBuffer(44 + dataLen);
    const v       = new DataView(buf);

    const wStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };

    wStr(0,  'RIFF');
    v.setUint32(4,  36 + dataLen, true);
    wStr(8,  'WAVE');
    wStr(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20,  1, true);           // PCM
    v.setUint16(22, numCh, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * numCh * bps / 8, true);
    v.setUint16(32, numCh * bps / 8, true);
    v.setUint16(34, bps, true);
    wStr(36, 'data');
    v.setUint32(40, dataLen, true);

    let off = 44;
    for (let i = 0; i < pcmFloat32.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Uint8Array(buf);
  }

  /* ── Utilidades ───────────────────────────────────────────────────── */

  function uint8ToBase64(uint8Array) {
    const CHUNK = 8192;
    let bin = '';
    for (let i = 0; i < uint8Array.length; i += CHUNK) {
      bin += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function getVideoDurationSeconds(file) {
    return new Promise((resolve) => {
      const v   = document.createElement('video');
      const url = URL.createObjectURL(file);
      v.preload = 'metadata';
      v.src     = url;
      v.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(Math.round(v.duration));
      });
      v.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(0); });
    });
  }

  return { extractFrames, extractAudioChunks, uint8ToBase64, getVideoDurationSeconds };
})();
