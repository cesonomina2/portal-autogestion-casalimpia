/**
 * ═══════════════════════════════════════════════════════════════════════
 * Instructivos IA — Google Apps Script Web App
 * Casalimpia · Área de Mejoramiento Continuo
 *
 * CÓMO DESPLEGAR (solo el administrador, una sola vez):
 * 1. Abre script.google.com → "Nuevo proyecto"
 * 2. Pega TODO este código reemplazando el contenido existente
 * 3. Guarda el proyecto (Ctrl+S)
 * 4. Menú: Implementar → Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo ([tu-cuenta@casalimpia.com.co])
 *    - Quién puede acceder: Cualquier usuario (o "en el dominio" para más seguridad)
 * 5. Copia la URL del despliegue → pégala en config.js → APPS_SCRIPT_URL
 * ═══════════════════════════════════════════════════════════════════════
 */

/* ── Configuración ────────────────────────────────────────────────────── */
const COLOR_AZUL    = '#1a5276';
const COLOR_VERDE   = '#1e8b4c';
const FONT_TITULO   = 'Calibri';
const FONT_CUERPO   = 'Calibri';


/* ══════════════════════════════════════════════════════════════════════
   Punto de entrada POST (llamado desde el navegador)
══════════════════════════════════════════════════════════════════════ */
function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const payload = JSON.parse(e.postData.contents);
    let result;

    switch (payload.action) {
      case 'createInstructivo':
        result = createInstructivo(payload);
        break;
      default:
        result = { error: 'Acción desconocida: ' + payload.action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Punto de entrada GET (historial)
══════════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    if (action === 'getHistory') {
      const sheetsId = e.parameter.sheetsId || '';
      result = sheetsId ? getHistoryFromSheets(sheetsId) : [];
    } else {
      result = { status: 'ok', version: '1.0' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/* ══════════════════════════════════════════════════════════════════════
   createInstructivo — Crea Doc, Slides (opcional) y registra en Sheets
══════════════════════════════════════════════════════════════════════ */
function createInstructivo(payload) {
  const meta        = payload.metadata;
  const instructivo = payload.instructivo;
  const frames      = payload.frames || [];

  /* 1. Subir imágenes a Drive */
  const frameUrls = uploadFramesToDrive(frames, meta.folderId);

  /* 2. Crear Google Doc */
  const docResult = createGoogleDoc(instructivo, meta, frameUrls);

  /* 3. Crear Google Slides (si se pidió) */
  let slidesUrl = null;
  if (meta.includeSlides) {
    slidesUrl = createGoogleSlides(instructivo, meta, frameUrls);
  }

  /* 4. Registrar en historial (Google Sheets) */
  if (meta.sheetsId) {
    registerHistory(instructivo, meta, docResult.url);
  }

  return {
    doc_url:    docResult.url,
    slides_url: slidesUrl,
  };
}


/* ══════════════════════════════════════════════════════════════════════
   Google Docs
══════════════════════════════════════════════════════════════════════ */
function createGoogleDoc(instructivo, meta, frameUrls) {
  const title = instructivo.titulo || `Instructivo: ${meta.proceso}`;
  const doc   = DocumentApp.create(title);
  const body  = doc.getBody();
  const docId = doc.getId();

  /* Estilo base */
  body.setMarginTop(56.7);   // 2 cm
  body.setMarginBottom(56.7);
  body.setMarginLeft(70.9);  // 2.5 cm
  body.setMarginRight(70.9);

  /* ── Encabezado corporativo ────────────────────────────────────── */
  const header = doc.addHeader();
  const hPara  = header.appendParagraph('CASALIMPIA S.A.');
  hPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  hPara.editAsText()
    .setFontFamily(FONT_TITULO)
    .setFontSize(11)
    .setBold(true)
    .setForegroundColor(COLOR_AZUL);

  /* ── Título del documento ─────────────────────────────────────── */
  const titlePara = body.appendParagraph(title.toUpperCase());
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titlePara.setSpacingAfter(6);
  titlePara.editAsText()
    .setFontFamily(FONT_TITULO)
    .setFontSize(14)
    .setBold(true)
    .setForegroundColor(COLOR_AZUL);

  /* ── Tabla de identificación ──────────────────────────────────── */
  const idData = [
    ['Código', '[PENDIENTE — Área de Procesos]', 'Versión', meta.version || '1.0'],
    ['Proceso', meta.proceso || '', 'Área', meta.area || ''],
    ['Vigencia', '[PENDIENTE — Área de Procesos]', 'Fecha elaboración', Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy')],
  ];

  const idTable = body.appendTable(idData);
  idTable.setBorderWidth(1);
  idTable.setBorderColor('#cccccc');
  for (let r = 0; r < idData.length; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = idTable.getCell(r, c);
      cell.setBackgroundColor(c % 2 === 0 ? '#d6eaf8' : '#ffffff');
      cell.editAsText().setFontFamily(FONT_CUERPO).setFontSize(9).setBold(c % 2 === 0);
    }
  }

  body.appendParagraph('').setSpacingAfter(4);

  /* ── Secciones ────────────────────────────────────────────────── */
  _appendSection(body, '1. OBJETIVO');
  body.appendParagraph(instructivo.objetivo || '')
    .editAsText().setFontFamily(FONT_CUERPO).setFontSize(10);

  body.appendParagraph('').setSpacingAfter(4);
  _appendSection(body, '2. METODOLOGÍA — PASO A PASO');

  /* ── Pasos del instructivo ────────────────────────────────────── */
  (instructivo.pasos || []).forEach((paso, idx) => {
    /* Número y título del paso */
    const stepHead = body.appendParagraph(`Paso ${paso.numero}. ${paso.titulo}`);
    stepHead.setSpacingBefore(10);
    const stH = stepHead.editAsText();
    stH.setFontFamily(FONT_TITULO).setFontSize(10).setBold(true).setForegroundColor(COLOR_VERDE);

    /* Descripción */
    const desc = body.appendParagraph(paso.descripcion || '');
    desc.setIndentFirstLine(14.2);
    desc.editAsText().setFontFamily(FONT_CUERPO).setFontSize(10);

    /* Nota de validación */
    if (paso.nota) {
      const nota = body.appendParagraph(`⚠️ ${paso.nota}`);
      nota.setIndentFirstLine(14.2);
      nota.editAsText().setFontFamily(FONT_CUERPO).setFontSize(9).setItalic(true).setForegroundColor('#e67e22');
    }

    /* Imagen del paso */
    const imgB64 = frameUrls[idx];
    if (imgB64) {
      try {
        const blob = Utilities.newBlob(Utilities.base64Decode(imgB64), 'image/jpeg', `paso_${paso.numero}.jpg`);
        const img  = body.appendImage(blob);
        img.setWidth(400);
        img.setHeight(225);
        const imgPara = img.getParent();
        if (imgPara) imgPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      } catch (e) { /* imagen no disponible */ }
    } else {
      const imgPlaceholder = body.appendParagraph(`[Imagen ${paso.numero}. Captura del video]`);
      imgPlaceholder.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      imgPlaceholder.editAsText().setFontFamily(FONT_CUERPO).setFontSize(9).setItalic(true).setForegroundColor('#999999');
    }
  });

  /* ── Control de cambios ───────────────────────────────────────── */
  body.appendParagraph('').setSpacingAfter(10);
  _appendSection(body, '3. CONTROL DE REVISIÓN Y APROBACIÓN');

  const approvalData = [
    ['Elaboró', 'Revisó', 'Aprobó'],
    ['', '', ''],
    ['Cargo: _______________', 'Cargo: _______________', 'Cargo: _______________'],
    ['Fecha: _______________', 'Fecha: _______________', 'Fecha: _______________'],
  ];
  const approvalTable = body.appendTable(approvalData);
  approvalTable.setBorderWidth(1);
  approvalTable.setBorderColor('#cccccc');
  for (let c = 0; c < 3; c++) {
    approvalTable.getCell(0, c).setBackgroundColor('#d6eaf8')
      .editAsText().setFontFamily(FONT_TITULO).setFontSize(9).setBold(true).setForegroundColor(COLOR_AZUL);
  }

  /* Mover a la carpeta de Drive si se especificó */
  if (meta.folderId) {
    try {
      const file   = DriveApp.getFileById(docId);
      const folder = DriveApp.getFolderById(meta.folderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (e) { /* carpeta no encontrada, doc queda en raíz */ }
  }

  doc.saveAndClose();
  return { id: docId, url: `https://docs.google.com/document/d/${docId}/edit` };
}

function _appendSection(body, text) {
  const p = body.appendParagraph(text);
  p.setSpacingBefore(12);
  p.editAsText()
    .setFontFamily(FONT_TITULO)
    .setFontSize(11)
    .setBold(true)
    .setForegroundColor(COLOR_AZUL);
  return p;
}


/* ══════════════════════════════════════════════════════════════════════
   Google Slides
══════════════════════════════════════════════════════════════════════ */
function createGoogleSlides(instructivo, meta, frameUrls) {
  const title = (instructivo.titulo || `Instructivo: ${meta.proceso}`).replace('Instructivo de uso: ', '');
  const pres  = SlidesApp.create(`PRES-${title}`);
  const presId = pres.getId();

  /* Slide 1: Portada */
  const slide1  = pres.getSlides()[0];
  slide1.getBackground().setSolidFill(COLOR_AZUL);
  slide1.insertTextBox(`INSTRUCTIVO DE USO\n${title.toUpperCase()}`, 60, 180, 600, 160)
    .getText().getTextStyle().setFontFamily(FONT_TITULO).setFontSize(28).setBold(true).setForegroundColor('#ffffff');
  slide1.insertTextBox(`${meta.area} · ${meta.version} · ${Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy')}`, 60, 340, 600, 40)
    .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(14).setForegroundColor('#a9cce3');
  slide1.insertTextBox('Casalimpia S.A. · Área de Mejoramiento Continuo', 60, 500, 600, 30)
    .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(11).setForegroundColor('#7fb3d3');

  /* Slide 2: Objetivo */
  const slide2 = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slide2.insertTextBox('OBJETIVO', 40, 30, 640, 40)
    .getText().getTextStyle().setFontFamily(FONT_TITULO).setFontSize(18).setBold(true).setForegroundColor(COLOR_AZUL);
  slide2.insertTextBox(instructivo.objetivo || '', 40, 90, 640, 120)
    .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(13).setForegroundColor('#333333');

  /* Un slide por cada paso */
  (instructivo.pasos || []).forEach((paso, idx) => {
    const slide  = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    const header = `Paso ${paso.numero}: ${paso.titulo}`;

    /* Barra de título */
    slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, 720, 50)
      .getFill().setSolidFill(COLOR_AZUL);
    slide.insertTextBox(header, 20, 8, 680, 36)
      .getText().getTextStyle().setFontFamily(FONT_TITULO).setFontSize(14).setBold(true).setForegroundColor('#ffffff');

    /* Descripción */
    slide.insertTextBox(paso.descripcion || '', 40, 65, 640, 100)
      .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(12).setForegroundColor('#2c3e50');

    /* Nota */
    if (paso.nota) {
      slide.insertTextBox(`⚠️ ${paso.nota}`, 40, 165, 640, 40)
        .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(10).setItalic(true).setForegroundColor('#e67e22');
    }

    /* Imagen */
    const imgB64 = frameUrls[idx];
    if (imgB64) {
      try {
        const blob = Utilities.newBlob(Utilities.base64Decode(imgB64), 'image/jpeg', `frame_${idx}.jpg`);
        slide.insertImage(blob, 40, 215, 640, 280);
      } catch (e) { /* imagen no disponible */ }
    }

    /* Número de slide */
    slide.insertTextBox(`${idx + 3} / ${(instructivo.pasos || []).length + 2}`, 640, 520, 80, 24)
      .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(9).setForegroundColor('#aaaaaa');
  });

  /* Slide final */
  const slideFin = pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slideFin.getBackground().setSolidFill(COLOR_VERDE);
  slideFin.insertTextBox('Documento generado automáticamente por\nInstructivos IA · Casalimpia', 60, 200, 600, 100)
    .getText().getTextStyle().setFontFamily(FONT_TITULO).setFontSize(18).setBold(true).setForegroundColor('#ffffff');
  slideFin.insertTextBox('[PENDIENTE — Área de Procesos para asignación de código y aprobación]', 60, 320, 600, 50)
    .getText().getTextStyle().setFontFamily(FONT_CUERPO).setFontSize(11).setItalic(true).setForegroundColor('#d5f5e3');

  /* Mover a carpeta de Drive */
  if (meta.folderId) {
    try {
      const file   = DriveApp.getFileById(presId);
      const folder = DriveApp.getFolderById(meta.folderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (e) { /* ok */ }
  }

  pres.saveAndClose();
  return `https://docs.google.com/presentation/d/${presId}/edit`;
}


/* ══════════════════════════════════════════════════════════════════════
   Google Sheets — Historial
══════════════════════════════════════════════════════════════════════ */
function registerHistory(instructivo, meta, docUrl) {
  try {
    const ss      = SpreadsheetApp.openById(meta.sheetsId);
    const sheet   = ss.getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Código', 'Proceso', 'Área', 'Versión', 'Fecha Elaboración',
        'Pasos', 'Estado', 'URL Documento',
      ]);
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#d6eaf8');
    }

    sheet.appendRow([
      '[PENDIENTE]',
      meta.proceso || '',
      meta.area    || '',
      meta.version || '1.0',
      Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy'),
      (instructivo.pasos || []).length,
      'Pendiente nomenclatura',
      docUrl || '',
    ]);
  } catch (e) {
    Logger.log('Error al registrar en Sheets: ' + e.toString());
  }
}

function getHistoryFromSheets(sheetsId) {
  try {
    const ss    = SpreadsheetApp.openById(sheetsId);
    const sheet = ss.getSheets()[0];
    const data  = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    return data.slice(1).map(row => ({
      id:      row[0] || '',
      proceso: row[1] || '',
      area:    row[2] || '',
      version: row[3] || '',
      fecha:   row[4] ? row[4].toString().slice(0, 10) : '',
      pasos:   row[5] || 0,
      estado:  row[6] || '',
      doc_url: row[7] || '#',
    })).reverse();
  } catch (e) {
    return [];
  }
}


/* ══════════════════════════════════════════════════════════════════════
   Drive — subir imágenes
══════════════════════════════════════════════════════════════════════ */
function uploadFramesToDrive(framesB64, folderId) {
  const urls = [];
  if (!framesB64 || !framesB64.length) return urls;

  let folder;
  try {
    folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
  } catch (e) {
    folder = DriveApp.getRootFolder();
  }

  framesB64.forEach((b64, i) => {
    if (!b64) { urls.push(null); return; }
    try {
      /* Guardamos el base64 directamente — los insertamos en el Doc/Slides inline */
      urls.push(b64);
    } catch (e) {
      urls.push(null);
    }
  });

  return urls;
}
