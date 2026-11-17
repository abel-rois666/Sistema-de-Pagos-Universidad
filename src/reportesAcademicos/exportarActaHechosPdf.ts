import { jsPDF } from 'jspdf';
import {
  construirFirmantesActa,
  construirInvolucradosParaActa,
  INSTITUCION_ACTA_POR_DEFECTO,
  TITULO_ACTA_POR_DEFECTO,
} from './dominio';
import type { BorradorReporteAcademico, FirmanteActaHechos } from './types';

export interface OpcionesExportarActaPdf {
  folio?: string | null;
  cicloNombre?: string | null;
  logoUrl?: string | null;
  direccionInstitucional?: string | null;
  rfcCctInstitucional?: string | null;
  telefonosInstitucional?: string | null;
}

const ANCHO_CARTA = 215.9;
const MARGEN_X = 18;
const ANCHO_CONTENIDO = ANCHO_CARTA - MARGEN_X * 2;
const INICIO_Y = 16;
const LIMITE_Y = 256;

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Formatea una fecha YYYY-MM-DD a formato institucional formal en español (ej. "14 de noviembre de 2026"). */
export function formatearFechaLargaEspanol(fechaIso?: string | null): string {
  const limpio = (fechaIso || '').trim();
  const match = limpio.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return limpio || 'Fecha por definir';
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const nombreMes = MESES_ES[mes - 1];
  if (!nombreMes) return limpio;
  return `${dia} de ${nombreMes} de ${anio}`;
}

/** Formatea una hora HH:MM[:SS] a HH:MM horas. */
export function formatearHoraDocumento(hora?: string | null): string {
  const limpio = (hora || '').trim();
  if (!limpio) return '__:__';
  return limpio.length >= 5 ? limpio.slice(0, 5) : limpio;
}

/** Convierte una URL de imagen externa o data URL en DataURL utilizable por jsPDF, sin bloquear en caso de error. */
export async function cargarImagenComoDataUrl(url?: string | null): Promise<string | null> {
  const src = (url || '').trim();
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  try {
    const respuesta = await fetch(src, { mode: 'cors' });
    if (respuesta.ok) {
      const blob = await respuesta.blob();
      const dataUrl = await new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    }
  } catch {
    // Continuar con respaldo vía Image + canvas si CORS por fetch falla
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    return await new Promise<string | null>(resolve => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function dibujarEncabezadoPagina(
  pdf: jsPDF,
  nombreInstitucion: string,
  tituloDocumento: string,
  folio: string,
  cicloNombre: string,
  opciones: OpcionesExportarActaPdf & { logoDataUrl?: string | null },
  esPrimeraPagina: boolean
): number {
  let y = INICIO_Y;

  if (!esPrimeraPagina) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    pdf.text(nombreInstitucion.toUpperCase(), MARGEN_X, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${tituloDocumento.toUpperCase()} · Folio: ${folio}`, ANCHO_CARTA - MARGEN_X, y, { align: 'right' });
    y += 3;
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.3);
    pdf.line(MARGEN_X, y, ANCHO_CARTA - MARGEN_X, y);
    return y + 7;
  }

  const tieneLogo = Boolean(opciones.logoDataUrl);
  const logoSize = 20;
  const xTexto = tieneLogo ? MARGEN_X + logoSize + 5 : MARGEN_X;
  const anchoTexto = ANCHO_CARTA - MARGEN_X - xTexto;

  if (tieneLogo && opciones.logoDataUrl) {
    try {
      const formato = opciones.logoDataUrl.includes('image/jpeg') || opciones.logoDataUrl.includes('image/jpg')
        ? 'JPEG'
        : 'PNG';
      pdf.addImage(opciones.logoDataUrl, formato, MARGEN_X, y, logoSize, logoSize);
    } catch {
      // Omitir logo si el formato no pudo decodificarse
    }
  }

  let yInst = y + 4;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12.5);
  pdf.setTextColor(15, 23, 42);
  const lineasInst = pdf.splitTextToSize(nombreInstitucion.toUpperCase(), anchoTexto) as string[];
  pdf.text(lineasInst, tieneLogo ? xTexto : ANCHO_CARTA / 2, yInst, {
    align: tieneLogo ? 'left' : 'center',
  });
  yInst += lineasInst.length * 5;

  const detallesInst = [
    opciones.direccionInstitucional?.trim(),
    opciones.rfcCctInstitucional?.trim(),
    opciones.telefonosInstitucional?.trim(),
  ].filter(Boolean) as string[];

  if (detallesInst.length > 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    for (const linea of detallesInst) {
      const partidas = pdf.splitTextToSize(linea, anchoTexto) as string[];
      pdf.text(partidas, tieneLogo ? xTexto : ANCHO_CARTA / 2, yInst, {
        align: tieneLogo ? 'left' : 'center',
      });
      yInst += partidas.length * 3.4;
    }
  }

  y = Math.max(y + (tieneLogo ? logoSize + 2 : 0), yInst) + 3;

  // Banda de título formal
  pdf.setFillColor(24, 34, 53);
  pdf.roundedRect(MARGEN_X, y, ANCHO_CONTENIDO, 10, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.text(tituloDocumento.toUpperCase(), ANCHO_CARTA / 2, y + 6.5, { align: 'center' });
  y += 13;

  // Barra de metadatos
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(MARGEN_X, y, ANCHO_CONTENIDO, 8.5, 1, 1, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Folio: ${folio}`, MARGEN_X + 3, y + 5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Ciclo escolar: ${cicloNombre}`, ANCHO_CARTA - MARGEN_X - 3, y + 5.5, { align: 'right' });

  return y + 14;
}

function etiquetaRolFirmante(rol: FirmanteActaHechos['rolFirmante'], tipoTestigo?: FirmanteActaHechos['tipoTestigo']): string {
  switch (rol) {
    case 'LEVANTA_ACTA':
      return 'QUIEN INSTRUMENTA Y LEVANTA EL ACTA';
    case 'ALUMNO_INVOLUCRADO':
      return 'ALUMNO(A) INVOLUCRADO(A)';
    case 'DOCENTE_INVOLUCRADO':
      return 'DOCENTE INVOLUCRADO(A)';
    case 'TESTIGO_ASISTENCIA':
      return tipoTestigo === 'EXTERNO' ? 'TESTIGO DE ASISTENCIA (EXTERNO)' : 'TESTIGO DE ASISTENCIA';
  }
}

function medirAltoFilaFirmas(pdf: jsPDF, fila: FirmanteActaHechos[], anchoColumna: number): number {
  let maxLineasTexto = 2;
  pdf.setFontSize(8.5);
  for (const firmante of fila) {
    const lNombre = (pdf.splitTextToSize(firmante.nombreCompleto || '________________', anchoColumna - 6) as string[]).length;
    const lCargo = (pdf.splitTextToSize(firmante.cargoIdentificacion || '', anchoColumna - 6) as string[]).length;
    maxLineasTexto = Math.max(maxLineasTexto, 1 + lNombre + lCargo);
  }
  // 15 mm de área para firma manuscrita + 4 mm línea/espacio + líneas de texto + 7 mm margen inferior
  return 15 + 4 + maxLineasTexto * 3.8 + 7;
}

function dibujarBloqueFirma(
  pdf: jsPDF,
  firmante: FirmanteActaHechos,
  xCentro: number,
  yInicio: number,
  anchoBloque: number
): void {
  const rolLabel = etiquetaRolFirmante(firmante.rolFirmante, firmante.tipoTestigo);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.setTextColor(71, 85, 105);
  pdf.text(rolLabel, xCentro, yInicio + 3, { align: 'center' });

  const yLinea = yInicio + 16;
  const mitadLinea = Math.min(36, anchoBloque * 0.42);
  pdf.setDrawColor(30, 41, 59);
  pdf.setLineWidth(0.35);
  pdf.line(xCentro - mitadLinea, yLinea, xCentro + mitadLinea, yLinea);

  let yTexto = yLinea + 4.2;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  const lineasNombre = pdf.splitTextToSize(firmante.nombreCompleto || 'Nombre sin especificar', anchoBloque - 6) as string[];
  pdf.text(lineasNombre, xCentro, yTexto, { align: 'center', lineHeightFactor: 1.15 });
  yTexto += lineasNombre.length * 3.8;

  if (firmante.cargoIdentificacion) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(51, 65, 85);
    const lineasCargo = pdf.splitTextToSize(firmante.cargoIdentificacion, anchoBloque - 6) as string[];
    pdf.text(lineasCargo, xCentro, yTexto, { align: 'center', lineHeightFactor: 1.15 });
  }
}

/**
 * Construye el documento PDF formal del Acta de Hechos con márgenes oficiales,
 * encabezado institucional, relatoría justificada/cronológica y grilla de firmas autógrafas
 * protegida contra cortes entre páginas.
 */
export function crearPdfActaHechos(
  borrador: BorradorReporteAcademico,
  opciones: OpcionesExportarActaPdf & { logoDataUrl?: string | null } = {}
): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const acta = borrador.acta;
  const nombreInstitucion = (acta?.nombreInstitucion || INSTITUCION_ACTA_POR_DEFECTO).trim();
  const tituloDocumento = (acta?.tituloDocumento || TITULO_ACTA_POR_DEFECTO).trim();
  const folio = (opciones.folio || 'SIN FOLIO ASIGNADO').trim();
  const cicloNombre = (opciones.cicloNombre || 'Ciclo escolar vigente').trim();
  const lugar = (acta?.lugar || 'Instalaciones de la institución').trim();
  const fechaTexto = formatearFechaLargaEspanol(acta?.fechaLevantamiento || borrador.fechaReporte);
  const horaInicio = formatearHoraDocumento(acta?.horaInicio);
  const horaConclusion = formatearHoraDocumento(acta?.horaConclusion);
  const levantaNombre = (acta?.empleadoLevantaNombre || 'Personal administrativo designado').trim();
  const levantaCargo = (acta?.empleadoLevantaCargo || 'Administración Escolar').trim();
  const relatoria = (acta?.relatoriaHechos || borrador.descripcion || 'Sin relatoría asentada.').trim();

  const involucrados = construirInvolucradosParaActa(borrador);
  const firmantes = construirFirmantesActa(borrador);

  let y = dibujarEncabezadoPagina(pdf, nombreInstitucion, tituloDocumento, folio, cicloNombre, opciones, true);

  const asegurarEspacio = (alturaNecesaria: number) => {
    if (y + alturaNecesaria > LIMITE_Y) {
      pdf.addPage();
      y = dibujarEncabezadoPagina(pdf, nombreInstitucion, tituloDocumento, folio, cicloNombre, opciones, false);
    }
  };

  const escribirTituloSeccion = (titulo: string) => {
    asegurarEspacio(13);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(MARGEN_X, y, ANCHO_CONTENIDO, 6.5, 'F');
    pdf.setDrawColor(20, 86, 240);
    pdf.setLineWidth(0.7);
    pdf.line(MARGEN_X, y, MARGEN_X, y + 6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(titulo, MARGEN_X + 3, y + 4.4);
    y += 9.5;
  };

  const escribirParrafoLineas = (
    texto: string,
    estilo: 'normal' | 'bold' = 'normal',
    sangriaX = 0,
    tamano = 9.5
  ) => {
    pdf.setFont('helvetica', estilo);
    pdf.setFontSize(tamano);
    pdf.setTextColor(30, 41, 59);
    const parrafos = texto.split(/\r?\n/);
    for (const p of parrafos) {
      const contenido = p.trim();
      if (!contenido) {
        y += 3;
        continue;
      }
      const lineas = pdf.splitTextToSize(contenido, ANCHO_CONTENIDO - sangriaX) as string[];
      for (const linea of lineas) {
        asegurarEspacio(4.8);
        pdf.text(linea, MARGEN_X + sangriaX, y);
        y += 4.6;
      }
      y += 1.5;
    }
  };

  // I. Lugar, fecha y hora de levantamiento
  escribirTituloSeccion('I. LUGAR, FECHA Y HORA DE LEVANTAMIENTO');
  escribirParrafoLineas(
    `En ${lugar}, siendo las ${horaInicio} horas del día ${fechaTexto}, ante la presencia de ${levantaNombre}, en su carácter de ${levantaCargo} de ${nombreInstitucion}, se instrumenta la presente ${tituloDocumento} correspondiente al reporte con folio ${folio}, con fundamento en la normativa escolar vigente.`
  );
  y += 2;

  // II. Personas que intervienen
  escribirTituloSeccion('II. PARTICIPANTES Y TESTIGOS DE ASISTENCIA');
  escribirParrafoLineas(`• Quien levanta el acta: ${levantaNombre} (${levantaCargo}).`, 'normal', 2, 9.2);

  if (involucrados.mencionesTexto.length > 0) {
    escribirParrafoLineas('• Personas o grupos involucrados:', 'bold', 2, 9.2);
    for (const mencion of involucrados.mencionesTexto) {
      escribirParrafoLineas(`– ${mencion}`, 'normal', 6, 9);
    }
  } else {
    escribirParrafoLineas('• Personas o grupos involucrados: Sin participantes especificados.', 'normal', 2, 9.2);
  }

  const testigos = acta?.testigos ?? [];
  if (testigos.length > 0) {
    escribirParrafoLineas('• Testigos de asistencia:', 'bold', 2, 9.2);
    for (const testigo of testigos) {
      const etiquetaTipo = testigo.tipo === 'EXTERNO' ? 'Externo' : 'Personal institucional';
      escribirParrafoLineas(
        `– ${testigo.nombreCompleto} — ${testigo.cargoIdentificacion} [${etiquetaTipo}]`,
        'normal',
        6,
        9
      );
    }
  } else {
    escribirParrafoLineas('• Testigos de asistencia: No se registraron testigos adicionales.', 'normal', 2, 9.2);
  }
  y += 2;

  // III. Relatoría de hechos
  escribirTituloSeccion('III. RELATORÍA DE HECHOS (MODO, TIEMPO Y LUGAR)');
  escribirParrafoLineas(relatoria);
  y += 2;

  // IV. Pruebas o anexos
  const pruebas = (acta?.pruebasAnexos || '').trim();
  const enlaceDrive = (borrador.enlaceDrive || '').trim();
  const notasEvidencia = (borrador.notasEvidencia || '').trim();
  if (pruebas || enlaceDrive || notasEvidencia) {
    escribirTituloSeccion('IV. PRUEBAS Y ANEXOS DOCUMENTALES');
    if (pruebas) {
      escribirParrafoLineas(`• Elementos probatorios y anexos descritos: ${pruebas}`, 'normal', 2, 9.2);
    }
    if (enlaceDrive) {
      escribirParrafoLineas(`• Respaldo digital (Google Drive): ${enlaceDrive}`, 'normal', 2, 8.8);
    }
    if (notasEvidencia) {
      escribirParrafoLineas(`• Notas de evidencia: ${notasEvidencia}`, 'normal', 2, 9);
    }
    y += 2;
  }

  // V. Cierre y firmas autógrafas
  const numeralCierre = pruebas || enlaceDrive || notasEvidencia ? 'V.' : 'IV.';
  escribirTituloSeccion(`${numeralCierre} CIERRE DEL ACTA Y FIRMAS AUTÓGRAFAS`);
  escribirParrafoLineas(
    `Leída que fue la presente ${tituloDocumento} y enterados los comparecientes de su contenido y alcance, no habiendo más hechos que asentar, se da por concluida a las ${horaConclusion} horas del día ${fechaTexto}, firmando de conformidad al calce quienes en ella intervinieron.`
  );
  y += 4;

  const listaFirmantes = firmantes.todos;
  const anchoColumna = (ANCHO_CONTENIDO - 12) / 2;

  for (let idx = 0; idx < listaFirmantes.length; idx += 2) {
    const fila = listaFirmantes.slice(idx, idx + 2);
    const altoFila = medirAltoFilaFirmas(pdf, fila, fila.length === 1 ? ANCHO_CONTENIDO * 0.6 : anchoColumna);

    // Garantiza que ningún bloque de firma ni su etiqueta/cargo queden partidos en dos páginas
    asegurarEspacio(altoFila);

    if (fila.length === 1) {
      dibujarBloqueFirma(pdf, fila[0], ANCHO_CARTA / 2, y, ANCHO_CONTENIDO * 0.65);
    } else {
      dibujarBloqueFirma(pdf, fila[0], MARGEN_X + anchoColumna / 2, y, anchoColumna);
      dibujarBloqueFirma(pdf, fila[1], MARGEN_X + anchoColumna + 12 + anchoColumna / 2, y, anchoColumna);
    }

    y += altoFila;
  }

  // Pie de página en todas las hojas
  const totalPaginas = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    pdf.setPage(pagina);
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.25);
    pdf.line(MARGEN_X, 265, ANCHO_CARTA - MARGEN_X, 265);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${nombreInstitucion} · ${tituloDocumento} · ${folio}`, MARGEN_X, 270);
    pdf.text(`Página ${pagina} de ${totalPaginas}`, ANCHO_CARTA - MARGEN_X, 270, { align: 'right' });
  }

  return pdf;
}

/** Genera y descarga el PDF oficial del Acta de Hechos. */
export async function descargarPdfActaHechos(
  borrador: BorradorReporteAcademico,
  opciones: OpcionesExportarActaPdf = {}
): Promise<void> {
  const logoDataUrl = await cargarImagenComoDataUrl(opciones.logoUrl);
  const pdf = crearPdfActaHechos(borrador, { ...opciones, logoDataUrl });
  const folioLimpio = (opciones.folio || borrador.fechaReporte || 'Acta')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  pdf.save(`Acta_Hechos_${folioLimpio || 'Documento'}.pdf`);
}

