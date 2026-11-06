import type { Expediente911, Fuente911, Instancia911, Respaldo911 } from './types';
import { valorRespuesta } from './types';
import { BASE911, huella911 } from './fuentes';
import { CORTE_EDICION911, erroresCorte911, notasCorte911 } from './corte';
import { instanciaAplica911, erroresOferta911, nombreOferta911 } from './guia';
function validarCorteExportacion911(exp: Expediente911) {
  const errores = [...erroresCorte911(exp),...erroresOferta911(exp)];
  if (errores.length) throw new Error(errores.join('. '));
}
export function codigoLayout911(codigo: string, fuente: Fuente911): string {
  // Alias estructural explícito: el portal llama V a ciertos campos de texto E del diccionario.
  if (fuente.campos.some(c => c.codigo === codigo)) return codigo;
  if (/^V\d+$/.test(codigo) && fuente.campos.some(c => c.codigo === codigo.replace(/^V/, 'E'))) return codigo.replace(/^V/, 'E');
  if (codigo === 'CV_PLAN_ESTUDIOS') return 'CV_PLAN_ESTUDIO';
  if (codigo === 'OBSERVACIONES') return 'C_OBSERVACION';
  return codigo;
}
export function generarTxt911(instancias: Instancia911[], fuente: Fuente911): string {
  if (!fuente.layout) throw new Error('TXT bloqueado: falta el encabezado oficial completo homologado');
  const h = fuente.layout.encabezado;
  const fila = (i: Instancia911) => h.map(c => {
    if (c === 'OFICIALIZADO') return '0';
    const codigo = codigoLayout911(c, fuente);
    const v = i.identidad[c] ?? i.identidad[codigo] ?? valorRespuesta(i.respuestas[codigo]);
    const s = v === null || v === undefined ? '' : String(v);
    if (/[|\r\n]/.test(s)) throw new Error(`El campo ${c} contiene separadores no permitidos`);
    return s;
  }).join('|') + '|';
  return [h.join('|') + '|', ...instancias.map(fila)].join('\r\n') + '\r\n';
}
export function resumenRespaldo911(i: Instancia911, respaldos: Respaldo911[]) {
  return respaldos.filter(r => r.instancia === i.id).map(r => {
    const respuesta = i.respuestas[r.variable];
    const declarado = valorRespuesta(respuesta);
    return {
      variable: r.variable,
      poblacion: r.poblacion,
      calculado: respuesta?.calculado ?? null,
      declarado,
      identificados: r.incluidos.length,
      diferencia: typeof declarado === 'number' ? declarado - r.incluidos.length : null,
      completa: r.completa,
      justificacion: respuesta?.justificacion || '',
      evidencia: respuesta?.evidencia || ''
    };
  });
}
export const columnasRespaldo911 = ['Matrícula', 'Nombre', 'Programa', 'Plantel', 'Modalidad', 'Ciclo ID', 'Referencia', 'Ingreso', 'Grado personal', 'Avance 911', 'Sexo', 'Edad', 'Situación al corte', 'Motivo', 'Variable', 'Primer ingreso al programa', 'Ciclo de ingreso inferido', 'Procedencia del ingreso'];
export function filasRespaldo911(exp: Expediente911, respaldos: Respaldo911[]) {
  return respaldos.flatMap(r => r.incluidos.map(p => [p.matricula, p.nombre, p.programa, exp.config.plantel, p.modalidad, p.ciclo_id, r.poblacion + ': ' + (['primerIngresoAnterior', 'egresados', 'titulados'].includes(r.poblacion) ? exp.config.anteriorInicio + ' / ' + exp.config.anteriorFin : exp.config.corte), p.tipo_ingreso, p.grado, p.avance ?? '', p.sexo, p.edad ?? '', p.situacion, p.motivo || '', r.variable, p.fecha_primer_ingreso || '', p.ingreso_procedencia?.ciclo || '', p.ingreso_procedencia?.origen || 'Sin procedencia registrada']));
}
function marca(exp: Expediente911) {
  return `${exp.config.edicion} | ${exp.estado === 'CERRADO' ? 'Versión revisada' : 'BORRADOR'} | versión ${exp.version} · revisión ${exp.revision} | corte ${exp.config.corte}`;
}
function nombreInstancia(i: Instancia911) {
  return `${i.cuestionario}-${i.identidad.CV_CARRERA || i.identidad.CV_CCT}-${i.identidad.CV_PLAN_ESTUDIOS || i.identidad.CV_PLAN_ESTUDIO || ''}-${i.id}`;
}
export async function pdfCuestionario911(exp: Expediente911, i: Instancia911, fuente: Fuente911): Promise<Uint8Array> {
  validarCorteExportacion911(exp);
  const [{
    PDFDocument,
    rgb
  }, {
    jsPDF
  }, {
    default: autoTable
  }] = await Promise.all([import('pdf-lib'), import('jspdf'), import('jspdf-autotable')]);
  const r = await fetch(BASE911 + 'plantillas/' + fuente.mapa.sha256 + '.pdf');
  if (!r.ok) throw new Error('No se pudo cargar la plantilla original de esta versión');
  const bytes = new Uint8Array(await r.arrayBuffer());
  if ((await huella911(bytes)) !== fuente.mapa.sha256) throw new Error('La plantilla PDF cambió: requiere homologación del mapa antes de generar');
  const original = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const portada = new jsPDF({
    unit: 'pt',
    format: 'letter'
  });
  portada.setFillColor(18, 52, 45);
  portada.rect(0, 0, 612, 135, 'F');
  portada.setTextColor(255);
  portada.setFontSize(28);
  portada.text('Expediente 911', 40, 65);
  portada.setFontSize(14);
  portada.text(i.cuestionario.toUpperCase(), 40, 98);
  portada.setTextColor(25);
  portada.setFontSize(12);
  const lineas = [marca(exp), `Plantel: ${exp.config.plantel} · Institución: ${exp.config.institucion}`, `Instancia: ${i.id} · Oferta: ${i.identidad.CV_CARRERA || 'No aplica'}`, `Responsable: ${exp.config.responsable || 'Pendiente'}`, `Cargo: ${exp.config.cargo || 'Pendiente'}`, `Generado: ${new Date().toISOString()}`, `Huella plantilla: ${fuente.mapa.sha256}`, `Catálogo: ${exp.catalogoHash}`, 'Documento de trabajo para revisión y captura manual.', 'La carga y oficialización se realizan en el portal.', 'Sin firma ni sello incorporados.', 'Las claves impresas se conservan. Las respuestas que no caben', 'sin cubrir el formato se relacionan en las hojas de continuación.'];
  let y = 177;
  for (const linea of [...lineas, ...notasCorte911(exp),...(exp.config.guiaVersion?[`Guía de pertinencia: ${exp.config.guiaVersion}. Oferta confirmada por Administración.`]:[])]) {
    const ls = portada.splitTextToSize(linea, 525);
    for (const t of ls) {
      if (y > 740) {
        portada.addPage();
        y = 40;
      }
      portada.text(t, 40, y);
      y += 17;
    }
    y += 9;
  }
  const docPortada = await PDFDocument.load(portada.output('arraybuffer'));
  for (const p of await out.copyPages(docPortada, docPortada.getPageIndices())) out.addPage(p);
  const pages = await out.copyPages(original, original.getPageIndices());
  for (const p of pages) out.addPage(p);
  const font = await out.embedFont('Helvetica');
  const colocados = new Set<string>();
  const identificacion: Record<string, string> = {
    INST: exp.config.institucion,
    CT: exp.config.plantel,
    OFERTA: i.identidad.CV_CARRERA || '',
    NOMBRE_INS: exp.config.nombreInstitucion || '',
    NOMBRE_CT: exp.config.nombrePlantel || '',
    NOMBRE_OFERTA: i.correspondencia.nombre || ''
  };
  const check = i.identidad.CV_MODALIDAD === '1' ? 'ESCOLARIZADA' : i.identidad.CV_MODALIDAD === '2' ? 'MIXTA' : i.identidad.CV_MODALIDAD === '4' ? 'DUAL' : i.identidad.CV_OPCION_EDUCATIVA === '10' ? 'ABIERTA' : i.identidad.CV_OPCION_EDUCATIVA === '9' ? 'EN_LINEA' : i.identidad.CV_OPCION_EDUCATIVA === '11' ? 'DISTANCIA' : '';
  if (check) identificacion['CHECK_' + check] = 'X';
  for (const k of ['C_NOM_MUN', 'C_NOM_LOC', 'C_NOM_VIALIDAD', 'N_EXTNUM']) identificacion[k] = String(valorRespuesta(i.respuestas[k]) ?? '');
  identificacion.RESPONSABLE = exp.config.responsable;
  if (exp.config.fechaLlenado) {
    identificacion.FECHA_ANIO = exp.config.fechaLlenado.slice(0, 4);
    identificacion.FECHA_MES = exp.config.fechaLlenado.slice(5, 7);
    identificacion.FECHA_DIA = exp.config.fechaLlenado.slice(8, 10);
  }
  for (const p of fuente.mapa.identificacion || []) {
    let t = identificacion[p.codigo] || '';
    if (p.caracter !== undefined) t = t[p.caracter] || '';
    if (!t) continue;
    try {
      if (font.widthOfTextAtSize(t, p.tamano) <= p.ancho) pages[p.pagina].drawText(t, {
        x: p.x,
        y: p.y,
        size: p.tamano,
        font,
        color: rgb(0.06, 0.23, 0.65)
      });
    } catch {/* El dato íntegro permanece en portada/continuación. */}
  }
  for (const p of fuente.mapa.posiciones) {
    const v = valorRespuesta(i.respuestas[p.codigo]);
    if (v === null) continue;
    const t = String(v);
    try {
      const w = font.widthOfTextAtSize(t, p.tamano);
      if (w > p.ancho || /[\r\n]/.test(t)) continue;
      pages[p.pagina].drawText(t, {
        x: p.x,
        y: p.y,
        size: p.tamano,
        font,
        color: rgb(0.06, 0.23, 0.65)
      });
      colocados.add(p.codigo);
    } catch {/* Texto no representable: se conserva completo en continuación. */}
  }
  const ap = new jsPDF({
    unit: 'pt',
    format: 'letter'
  });
  ap.setFontSize(15);
  ap.text('Respuestas y hojas de continuación', 36, 36);
  ap.setFontSize(9);
  ap.text(marca(exp), 36, 53);
  const campos = fuente.campos.filter(c => c.fase !== 'FIN' && /^[VE]\d+$/.test(c.codigo));
  const extras = Object.keys(i.respuestas).filter(k => !campos.some(c => c.codigo === k)).map(k => ({
    codigo: k,
    descripcion: 'Campo complementario',
    tipo: '',
    fase: '',
    orden: 0
  }));
  autoTable(ap, {
    startY: 66,
    tableWidth: 521,
    head: [['Clave', 'Pregunta / dato', 'Respuesta', 'Ubicación']],
    body: [...[['NOMBRE_INS', 'Institución', exp.config.nombreInstitucion], ['NOMBRE_CT', 'Plantel', exp.config.nombrePlantel], ['RESPONSABLE', 'Responsable de llenado', exp.config.responsable], ['FECHA_LLENADO', 'Fecha registrada', exp.config.fechaLlenado], ['OFERTA', 'Nombre del programa', i.correspondencia.nombre]].map(([k, d, v]) => [k || '', d || '', v || 'PENDIENTE', 'Control']), ...Object.entries(i.identidad).map(([k, v]) => [k, 'Identificación oficial', v, 'Control']), ...[...campos, ...extras].map(c => [c.codigo, c.descripcion, String(valorRespuesta(i.respuestas[c.codigo]) ?? 'PENDIENTE'), colocados.has(c.codigo) ? 'En formato y respaldo' : 'Continuación'])],
    styles: {
      fontSize: 7,
      cellPadding: 4,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: {
        cellWidth: 57
      },
      1: {
        cellWidth: 254
      },
      2: {
        cellWidth: 130
      },
      3: {
        cellWidth: 80
      }
    },
    margin: 35
  });
  for (const [bloque, filas] of Object.entries(i.bloques)) {
    ap.addPage();
    ap.setFontSize(13);
    ap.text(`Continuación: ${bloque}`, 36, 35);
    autoTable(ap, {
      startY: 50,
      head: [['Registro', 'Campo', 'Respuesta']],
      body: filas.flatMap((row, n) => Object.entries(row).map(([k, v]) => [String(n + 1), k, String(v ?? 'PENDIENTE')])),
      styles: {
        fontSize: 8
      },
      margin: 35
    });
  }
  const ajustes = Object.entries(i.respuestas).filter(([, r]) => r.declarado !== undefined);
  if (ajustes.length) {
    ap.addPage();
    ap.text('Ajustes declarados', 36, 35);
    autoTable(ap, {
      startY: 50,
      head: [['Clave', 'Calculado', 'Declarado', 'Justificación / evidencia']],
      body: ajustes.map(([k, r]) => [k, String(r.calculado ?? 'Pendiente'), String(r.declarado ?? 'Pendiente'), `${r.justificacion}\n${r.evidencia}`]),
      styles: {
        fontSize: 8
      },
      margin: 35
    });
  }
  const excepciones = Object.entries(exp.excepciones || {}).filter(([clave]) => clave.startsWith(i.id + ':'));
  if (excepciones.length) {
    ap.addPage();
    ap.text('Excepciones de reglas oficiales', 36, 35);
    autoTable(ap, {
      startY: 50,
      head: [['Regla', 'Justificación', 'Evidencia']],
      body: excepciones.map(([k, r]) => [k, r.justificacion, r.evidencia]),
      styles: {
        fontSize: 8
      },
      margin: 35
    });
  }
  const anexo = await PDFDocument.load(ap.output('arraybuffer'));
  for (const p of await out.copyPages(anexo, anexo.getPageIndices())) out.addPage(p);
  out.setTitle(`911 ${i.cuestionario} ${exp.config.edicion}`);
  out.setSubject(marca(exp));
  return out.save();
}
export async function pdfRespaldo911(exp: Expediente911, instancias: Instancia911[], respaldos: Respaldo911[], excluidos = false) {
  validarCorteExportacion911(exp);
  const [{
    jsPDF
  }, {
    default: autoTable
  }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a3'
  });
  doc.setFontSize(19);
  doc.text('911 · Respaldo de cifras', 35, 35);
  doc.setFontSize(10);
  doc.text(marca(exp), 35, 54);
  let inicioResumen = 68;
  const notas = notasCorte911(exp);
  if (notas.length) {
    autoTable(doc, { startY: inicioResumen, head: [['Control de fecha de corte']], body: notas.map(n => [n]),
      styles: { fontSize: 9 }, margin: 35 });
    inicioResumen = (doc as any).lastAutoTable.finalY + 16;
  }
  autoTable(doc, {
    startY: inicioResumen,
    head: [['Instancia', 'Variable', 'Población', 'Calculado', 'Declarado', 'Identificados', 'Diferencia', 'Justificación']],
    body: instancias.flatMap(i => resumenRespaldo911(i, respaldos).map(r => [i.id, r.variable, r.poblacion, String(r.calculado ?? 'Pendiente'), String(r.declarado ?? 'Pendiente'), r.identificados, String(r.diferencia ?? ''), r.justificacion])),
    styles: {
      fontSize: 8
    },
    margin: 35
  });
  doc.addPage();
  doc.text('Alumnos identificados · una fila por contribución a una cifra', 35, 35);
  autoTable(doc, {
    startY: 50,
    head: [columnasRespaldo911],
    body: filasRespaldo911(exp, respaldos),
    styles: {
      fontSize: 6,
      cellPadding: 3
    },
    margin: 30
  });
  if (excluidos) {
    doc.addPage();
    doc.text('Excluidos: identificadores y motivos', 35, 35);
    autoTable(doc, {
      startY: 50,
      head: [['Instancia', 'Variable', 'Registro ID', 'Motivo']],
      body: respaldos.flatMap(r => r.excluidos.map(x => [r.instancia, r.variable, x.id, x.motivo])),
      styles: {
        fontSize: 7
      },
      margin: 30
    });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
export async function xlsxRespaldo911(exp: Expediente911, instancias: Instancia911[], respaldos: Respaldo911[], excluidos = false) {
  validarCorteExportacion911(exp);
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control Escolar';
  wb.subject = marca(exp);
  const resumen = wb.addWorksheet('Resumen');
  resumen.addRow(['Estadística 911', marca(exp)]);
  for (const nota of notasCorte911(exp)) resumen.addRow(['Control del corte', nota]);
  const filaEncabezado = resumen.rowCount + 1;
  resumen.addRow(['Instancia', 'Variable', 'Población', 'Calculado', 'Declarado', 'Identificados', 'Diferencia', 'Cobertura completa', 'Justificación', 'Evidencia']);
  for (const i of instancias) for (const r of resumenRespaldo911(i, respaldos)) resumen.addRow([i.id, r.variable, r.poblacion, r.calculado, r.declarado, r.identificados, r.diferencia, r.completa ? 'Sí' : 'No', r.justificacion, r.evidencia]);
  const alumnos = wb.addWorksheet('Alumnos');
  alumnos.addRow(columnasRespaldo911);
  for (const r of filasRespaldo911(exp, respaldos)) alumnos.addRow(r);
  if (excluidos) {
    const s = wb.addWorksheet('Excluidos');
    s.addRow(['Instancia', 'Variable', 'Registro ID', 'Motivo']);
    for (const r of respaldos) for (const x of r.excluidos) s.addRow([r.instancia, r.variable, x.id, x.motivo]);
  }
  for (const s of wb.worksheets) {
    s.views = [{
      state: 'frozen',
      ySplit: s.name === 'Resumen' ? filaEncabezado : 1
    }];
    s.columns.forEach((c, n) => {
      c.width = n === 1 ? 38 : 23;
    });
    s.getRow(s.name === 'Resumen' ? filaEncabezado : 1).eachCell(c => {
      c.font = {
        bold: true,
        color: {
          argb: 'FFFFFFFF'
        }
      };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: '173F36'
        }
      };
    });
    s.eachRow(row => row.eachCell(cell => {
      cell.alignment = {
        vertical: 'top',
        wrapText: true
      };
    }));
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
export async function exportarCuestionarios911(exp: Expediente911, seleccion: Instancia911[], fuentes: Record<string, Fuente911>, formato: 'PDF' | 'TXT') {
  validarCorteExportacion911(exp);
  if (!seleccion.length) throw new Error('Selecciona al menos un cuestionario');
  if(seleccion.some(i=>!instanciaAplica911(i)))throw Error('Una oferta seleccionada está documentada como no aplicable al reporte');
  const archivos: {
    nombre: string;
    bytes: Uint8Array;
  }[] = [];
  if (formato === 'PDF') for (const i of seleccion) archivos.push({
    nombre: nombreInstancia(i) + '.pdf',
    bytes: await pdfCuestionario911(exp, i, fuentes[i.cuestionario])
  });else for (const q of [...new Set(seleccion.map(i => i.cuestionario))]) archivos.push({
    nombre: `C911.${q.toUpperCase()}.txt`,
    bytes: new TextEncoder().encode(generarTxt911(seleccion.filter(i => i.cuestionario === q), fuentes[q]))
  });
  if (archivos.length === 1 && !(formato === 'TXT' && exp.config.corte !== CORTE_EDICION911)) return archivos[0];
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const a of archivos) zip.file(a.nombre, a.bytes);
  zip.file('control.json', JSON.stringify({
    edicion: exp.config.edicion,
    revision: exp.revision,
    estado: exp.estado,
    corte: exp.config.corte,
    corteEdicion: CORTE_EDICION911,
    cortePersonalizado: exp.config.corte !== CORTE_EDICION911,
    motivoCorte: exp.config.motivoCorte || '',
    guia: exp.config.guiaVersion || null,
    ofertasNoAplicables:exp.instancias.filter(i=>!instanciaAplica911(i)).map(i=>({id:i.id,nombre:nombreOferta911(i),motivo:i.correspondencia.motivoNoAplica,evidencia:i.correspondencia.evidenciaNoAplica})),
    catalogo: exp.catalogoHash,
    archivos: await Promise.all(archivos.map(async a => ({
      nombre: a.nombre,
      sha256: await huella911(a.bytes)
    })))
  }, null, 2));
  if (exp.config.corte !== CORTE_EDICION911) zip.file('LEEME-CORTE.txt', notasCorte911(exp).join('\r\n') + '\r\nLos TXT conservan el layout original y OFICIALIZADO=0. Confirma el uso de este corte antes de trasladarlos al portal.\r\n');
  return {
    nombre: `911-${exp.config.edicion}-${formato}.zip`,
    bytes: await zip.generateAsync({
      type: 'uint8array'
    })
  };
}
export function descargar911(nombre: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
