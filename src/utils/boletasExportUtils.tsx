import type { AppConfig, CicloEscolar, Empleado } from '../types';

export interface BoletaOpciones {
  copias: number;
  incluirSello: boolean;
  incluirFirma: boolean;
  filename?: string;
  folderBy?: 'carrera' | 'grupo' | 'none';
}

function numeroALetra(numStr: string) {
    const letras = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ'];
    const p = Math.round(parseFloat(numStr));
    if (p >= 0 && p <= 10) return letras[p];
    return '-';
}

function getDecimalsText(d: string) {
    if (d === '00' || d === '0') return '';
    const units = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const tens = ['CERO', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const special: Record<string, string> = { '11': 'ONCE', '12': 'DOCE', '13': 'TRECE', '14': 'CATORCE', '15': 'QUINCE', '16': 'DIECISEIS', '17': 'DIECISIETE', '18': 'DIECIOCHO', '19': 'DIECINUEVE',
                     '21': 'VEINTIUNO', '22': 'VEINTIDOS', '23': 'VEINTITRES', '24': 'VEINTICUATRO', '25': 'VEINTICINCO', '26': 'VEINTISEIS', '27': 'VEINTISIETE', '28': 'VEINTIOCHO', '29': 'VEINTINUEVE' };
                     
    if (special[d]) return special[d];
    
    let t = parseInt(d[0]);
    let u = parseInt(d.length > 1 ? d[1] : '0');
    
    if (t === 0) return units[u];
    if (u === 0) return tens[t];
    return tens[t] + ' Y ' + units[u];
}

function promedioALetra(numStr: string) {
    const num = parseFloat(numStr);
    if (isNaN(num)) return '';
    const partes = numStr.split('.');
    const enteros = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ'];
    
    let e = parseInt(partes[0]);
    let d = partes[1] || '00';
    if (d.length === 1) d = d + '0';
    
    let res = enteros[e];
    const decText = getDecimalsText(d);
    
    if (decText) {
        res += ' PUNTO ' + decText;
    }
    return res;
}



function formatCalif(calif: string | number | undefined | null): string {
    if (calif === undefined || calif === null || calif === '') return '-';
    if (parseFloat(String(calif)) === -555) return 'NP';
    return String(calif);
}
function calcularPromedioTruncado(materias: any[]) {
    // Excluir materias de inglés solo si comienzan con "Inglés" (Ej. "Inglés I", "Inglés II")
    // Esto evita falsos positivos como "Redacción de Textos en Inglés"
    const materiasValidas = materias.filter(m => {
        const nombre = (m.asignaturas?.nombre || '').trim();
        const esIngles = /^ingl[eé]s\b/i.test(nombre);
        const califNum = parseFloat(m.calificacion_final);
        return !esIngles && !isNaN(califNum);
    });

    if (materiasValidas.length === 0) return '0.00';

    const suma = materiasValidas.reduce((acc, m) => {
        const cal = parseFloat(m.calificacion_final);
        return acc + (cal === -555 ? 0 : cal);
    }, 0);
    const rawPromedio = suma / materiasValidas.length;
    // Truncate to 2 decimals without rounding
    const truncPromedio = Math.floor(rawPromedio * 100) / 100;
    return truncPromedio.toFixed(2);
}

function toTitleCase(str: string | undefined | null) {
    if (!str) return '';
    const lowers = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a', 'e', 'o', 'u', 'con', 'para', 'por', 'al'];
    const romans = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']);
    return str.toLowerCase().split(' ').map((word, index) => {
        if (index > 0 && lowers.includes(word)) {
            return word;
        }
        if (romans.has(word)) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

async function fetchImageAsBase64(url: string | undefined | null): Promise<string> {
  if (!url) return '';
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return url;
  }
}

export const BOLETAS_CSS = `
        .pdf-export-wrapper *, .pdf-export-wrapper *::before, .pdf-export-wrapper *::after { margin: 0; padding: 0; box-sizing: border-box; letter-spacing: normal; }
        .pdf-export-wrapper {
            font-family: 'Poppins', sans-serif;
            letter-spacing: normal;
            margin: 0;
            padding: 10px;
            background-color: #f0f0f0;
            display: flex;
            flex-direction: column;
            align-items: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .boleta-container {
            width: 21.59cm;
            height: 13.5cm;
            max-height: 13.5cm;
            overflow: hidden;
            background: white;
            box-sizing: border-box;
            border: 1px solid #ccc;
            padding: 8px 18px 4px 18px;
            margin-bottom: 10px;
            position: relative;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
        }

        .header {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
            flex-shrink: 0;
        }

        .logo {
            width: 95px;
            height: 95px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-size: 9px;
            text-align: center;
            font-weight: bold;
            flex-shrink: 0;
        }

        .logo img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .institution-details {
            display: flex;
            flex-direction: column;
        }

        .institution-details .title {
            font-size: 20px;
            font-weight: 700;
            font-family: 'Poppins', sans-serif;
        }

        .institution-details .subtitle {
            font-size: 14px;
            font-weight: 500;
            margin-top: 1px;
        }

        .thick-line {
            border-bottom: 3px solid black;
            border-top: 1px solid black;
            height: 2px;
            margin-bottom: 4px;
            flex-shrink: 0;
        }

        .student-info {
            display: flex;
            justify-content: space-between;
            border: 2px solid black;
            border-radius: 6px;
            padding: 3px 12px;
            font-size: 10px;
            margin-bottom: 4px;
            flex-shrink: 0;
        }

        .student-info .col {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        
        .student-info .col:first-child { width: 55%; }
        .student-info .col:last-child { width: 45%; }

        .period-title {
            text-align: center;
            font-weight: bold;
            font-size: 10px;
            margin: 0;
            border: 2px solid black;
            border-bottom: none;
            padding: 2px;
            background-color: transparent;
            flex-shrink: 0;
        }

        .grades-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin-bottom: 1px;
            flex-shrink: 0;
        }

        .grades-table th, .grades-table td {
            border: 1px solid black;
            padding: 1px 3px;
            text-align: center;
        }

        .grades-table thead th {
            border: 2px solid black;
            font-weight: bold;
            padding: 2px 3px;
        }

        .english-note {
            font-size: 8px;
            margin: 1px 0;
            flex-shrink: 0;
        }

        .footer-area {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
        }

        .footer-left {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 100%;
            padding-bottom: 2px;
            position: relative;
            z-index: 2;
        }

        .average {
            font-size: 10px;
            margin-bottom: 2px;
            text-transform: uppercase;
        }

        .signatures {
            margin-top: 2px;
            text-align: center;
            font-size: 11px;
        }

        .signature-line {
            width: 280px;
            border-top: 1px solid black;
            margin: 15px auto 0 auto;
            padding-top: 3px;
            font-size: 9px;
            font-weight: bold;
            position: relative;
        }

        .footer-notes {
            font-size: 8px;
            margin-top: 4px;
            line-height: 1.3;
        }

        .stamp-box {
            width: 220px;
            height: 220px;
            position: absolute;
            bottom: -15px;
            right: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
        }

        .stamp-content {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .divider-line {
            border-bottom: 1px solid black;
            margin: 3px 0 1px 0;
            flex-shrink: 0;
        }

        .address-line {
            text-align: center;
            font-size: 8px;
            width: 100%;
            flex-shrink: 0;
            padding-top: 1px;
        }

        .cut-line {
            width: 21.59cm;
            text-align: center;
            font-size: 10px;
            color: #999;
            letter-spacing: 2px;
            padding: 0;
            margin: 0;
            line-height: 1;
            height: 14px;
            overflow: hidden;
        }

        @media print {
            .pdf-export-wrapper {
                background-color: white;
                padding: 0;
                margin: 0;
                display: block;
            }
            .boleta-container {
                border: none;
                margin: 0;
                box-shadow: none;
                height: 510px;
                max-height: 510px;
                padding: 12px 20px 8px 20px;
                overflow: hidden;
            }
            .cut-line {
                height: 14px;
                color: #aaa;
            }
            @page {
                size: letter portrait;
                margin: 0;
            }
        }
`;

export const renderBoletasHTML = ({
  alumnos,
  inscripciones,
  ciclo,
  config,
  firmante,
  opciones
}: {
  alumnos: any[];
  inscripciones: any[];
  ciclo: CicloEscolar;
  config: AppConfig | null;
  firmante?: Empleado;
  opciones: BoletaOpciones;
}) => {
  
  const calificacionesPorAlumno: Record<string, any[]> = {};
  inscripciones.forEach(ins => {
    if (!calificacionesPorAlumno[ins.alumno_id]) {
      calificacionesPorAlumno[ins.alumno_id] = [];
    }
    calificacionesPorAlumno[ins.alumno_id].push(ins);
  });

  const getSelloHTML = () => {
    if (!opciones.incluirSello || !config?.selloUrl) return '';
    return `<img src="${config.selloUrl}" alt="Sello Institucional" style="max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.8;" />`;
  };

  const getFirmaHTML = () => {
    if (!opciones.incluirFirma || !firmante?.firma_url) return '';
    return `<img src="${firmante.firma_url}" alt="Firma" style="width: 120px; max-height: 70px; position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); opacity: 0.95; object-fit: contain;" />`;
  };

  let pagesHTML = '';

  alumnos.forEach(alumno => {
    let materias = calificacionesPorAlumno[alumno.id] || [];
    if (alumno.selectedPlanId) {
      materias = materias.filter((m: any) => {
         const asig = Array.isArray(m.asignaturas) ? m.asignaturas[0] : m.asignaturas;
         return asig?.plan_id === alumno.selectedPlanId;
      });
    }
    
    // Sort materias by clave_legado, putting "inglés" at the end
    materias.sort((a: any, b: any) => {
      const asigA = Array.isArray(a.asignaturas) ? a.asignaturas[0] : a.asignaturas;
      const asigB = Array.isArray(b.asignaturas) ? b.asignaturas[0] : b.asignaturas;
      const nombreA = (asigA?.nombre || '').toLowerCase();
      const nombreB = (asigB?.nombre || '').toLowerCase();
      const isInglesA = nombreA.includes('inglés') || nombreA.includes('ingles');
      const isInglesB = nombreB.includes('inglés') || nombreB.includes('ingles');
      
      if (isInglesA && !isInglesB) return 1;
      if (!isInglesA && isInglesB) return -1;
      
      const claveA = asigA?.clave_legado || '';
      const claveB = asigB?.clave_legado || '';
      return claveA.localeCompare(claveB);
    });
    
    const promedio = calcularPromedioTruncado(materias);

    const tipoPeriodoBase = (alumno.tipo_periodo || 'CUATRIMESTRAL').toUpperCase();
    const isSemestral = tipoPeriodoBase === 'SEMESTRAL';
    const tipoPeriodoCorto = isSemestral ? 'SEMESTRE' : 'CUATRIMESTRE';
    const tipoPeriodoLargo = isSemestral ? 'SEMESTRAL' : 'CUATRIMESTRAL';

    let periodoTexto = 'ASIGNATURAS DEL PERIODO';
    
    let numeroPeriodoDefinitivo = alumno.grado_grupo;
    if (!numeroPeriodoDefinitivo && materias.length > 0) {
       const asig0 = Array.isArray(materias[0].asignaturas) ? materias[0].asignaturas[0] : materias[0].asignaturas;
       if (asig0?.numero_periodo) {
         numeroPeriodoDefinitivo = asig0.numero_periodo;
       }
    }
    
    if (numeroPeriodoDefinitivo) {
       const p = parseInt(numeroPeriodoDefinitivo);
       const ordinarios = ['PRIMER', 'SEGUNDO', 'TERCER', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO', 'DUODÉCIMO'];
       if (p >= 1 && p <= 12) {
         periodoTexto = `ASIGNATURAS DEL ${ordinarios[p-1]} ${tipoPeriodoCorto}`;
       } else {
         periodoTexto = `ASIGNATURAS DEL ${tipoPeriodoCorto} ${p}`;
       }
    }

    let filasHTML = '';
    materias.forEach(m => {
      const asig = Array.isArray(m.asignaturas) ? m.asignaturas[0] : m.asignaturas;
      const calif = formatCalif(m.calificacion_final);
      const letraRaw = calif !== '-' ? numeroALetra(calif) : '-';
      const letra = letraRaw !== '-' ? toTitleCase(letraRaw) : '-';
      filasHTML += `
        <tr>
            <td>${asig?.clave_legado || 'S/C'}</td>
            <td style="text-align: left;">${toTitleCase(asig?.nombre || 'Materia Desconocida')}</td>
            <td>${ciclo.nombre}</td>
            <td>${calif}</td>
            <td>${letra}</td>
        </tr>
      `;
    });
    
    // Solo agregar filas vacías si hay menos de 5 materias
    if (materias.length < 5) {
      for (let i = materias.length; i < 5; i++) {
        filasHTML += `
          <tr>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
          </tr>
        `;
      }
    }

    const firmanteNombre = firmante ? toTitleCase(`${firmante.nombres} ${firmante.apellido_paterno}`) : toTitleCase(config?.directorNombre || 'LIC. ABEL RODRIGUEZ ISLAS');
    const cargoFirmante = firmante ? toTitleCase(firmante.puesto || 'COORDINADOR ACADEMICO') : toTitleCase(config?.directorCargo || 'COORDINACION ESCOLAR');

    const renderBoleta = () => {
      return `
        <div class="boleta-container">
            <div class="header">
                <div class="logo">
                    ${config?.logoUrl ? `<img src="${config.logoUrl}" crossorigin="anonymous" alt="Escudo CUOM" />` : 'Escudo<br>CUOM'}
                </div>
                <div class="institution-details">
                    <div class="title">CENTRO UNIVERSITARIO ORIENTE DE MÉXICO</div>
                    <div class="subtitle">BOLETA ${tipoPeriodoLargo}</div>
                </div>
            </div>

            <div class="thick-line"></div>

            <div class="student-info">
                <div class="col">
                    <div><strong>Nombre:</strong> ${toTitleCase(alumno.nombres)} ${toTitleCase(alumno.apellido_paterno)} ${toTitleCase(alumno.apellido_materno || '')}</div>
                    <div><strong>Licenciatura:</strong> ${toTitleCase(alumno.licenciatura || '')}</div>
                    <div><strong>Grupo:</strong> ${alumno.grupo || 'S/A'}</div>
                </div>
                <div class="col">
                    <div><strong>Matrícula:</strong> ${alumno.matricula || ''}</div>
                    <div><strong>RVOE:</strong> ${alumno.rvoe || ''}</div>
                    <div><strong>Fecha de Expedición:</strong> ${new Date().toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'})}</div>
                </div>
            </div>

            <div class="period-title">${periodoTexto}</div>

            <table class="grades-table">
                <thead>
                    <tr>
                        <th>Clave</th>
                        <th style="width: 45%;">Asignatura</th>
                        <th>Ciclo</th>
                        <th>Calificación Final</th>
                        <th>Calificación (Letra)</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasHTML}
                </tbody>
            </table>
            
            <div class="english-note">* INGLÉS (ASIGNATURA EXTRAOFICIAL NO PROMEDIA CON EL RESTO DE LAS MATERIAS)</div>

            <div class="footer-area">
                <div class="footer-left">
                    <div class="average">
                        <strong>PROMEDIO DEL CICLO ESCOLAR: ${promedio} (${toTitleCase(promedioALetra(promedio))})</strong>
                    </div>
                    
                    <div class="signatures">
                        <div>Atentamente:</div>
                        <div class="signature-line">
                            ${getFirmaHTML()}
                            <div>${firmanteNombre}</div>
                            <div>${cargoFirmante}</div>
                        </div>
                    </div>

                    <div class="footer-notes">
                        <div><strong>SE EXPIDE LA PRESENTE PARA LOS FINES QUE AL INTERESADO CONVENGAN.</strong></div>
                        <div><strong>TOTAL DE ASIGNATURAS:</strong> ${materias.length}</div>
                    </div>
                </div>
            </div>

            <div class="stamp-box">
                <div class="stamp-content">
                    ${getSelloHTML()}
                </div>
            </div>

            <div class="divider-line"></div>
            <div class="address-line">
                AV. JAVIER ROJO GOMEZ NO. 375 COL. AGRICOLA ORIENTAL C.P. 08500 ALCALDÍA IZTACALCO, CIUDAD DE MÉXICO - TELÉFONO: 5646846747
            </div>
        </div>
      `;
    };

    pagesHTML += renderBoleta();
    if (opciones.copias === 2) {
      pagesHTML += `<div class="cut-line"><span>✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</span></div>`;
      pagesHTML += renderBoleta();
    }
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boletas de Calificaciones</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      /* Print-mode: apply styles to body directly */
      * { margin: 0; padding: 0; }
      body {
          font-family: 'Poppins', sans-serif;
          margin: 0;
          padding: 10px;
          background-color: #f0f0f0;
          display: flex;
          flex-direction: column;
          align-items: center;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
      }
      ${BOLETAS_CSS}
    </style>
</head>
<body class="pdf-export-wrapper">
    ${pagesHTML}
</body>
</html>
  `;
};

export const generateBoletasZip = async ({
  alumnos,
  inscripciones,
  ciclo,
  config,
  firmante,
  opciones,
  onProgress
}: {
  alumnos: any[];
  inscripciones: any[];
  ciclo: CicloEscolar;
  config: AppConfig | null;
  firmante?: Empleado;
  opciones: BoletaOpciones;
  onProgress: (current: number, total: number, status: string) => void;
}) => {
  const JSZip = (await import('jszip')).default;
  const { saveAs } = (await import('file-saver'));
  const { pdf } = await import('@react-pdf/renderer');
  const React = (await import('react')).default;
  const { BoletaPDFDocument } = await import('../components/pdf/BoletaPDFDocument');

  const zip = new JSZip();

  const calificacionesPorAlumno: Record<string, any[]> = {};
  inscripciones.forEach(ins => {
    if (!calificacionesPorAlumno[ins.alumno_id]) {
      calificacionesPorAlumno[ins.alumno_id] = [];
    }
    calificacionesPorAlumno[ins.alumno_id].push(ins);
  });

  const base64Sello = await fetchImageAsBase64(config?.selloUrl);
  const base64Firma = await fetchImageAsBase64(firmante?.firma_url);
  const base64Logo = await fetchImageAsBase64(config?.logoUrl);

  for (let index = 0; index < alumnos.length; index++) {
    const alumno = alumnos[index];
    onProgress(index + 1, alumnos.length, `${alumno.nombres} ${alumno.apellido_paterno}`);

    let materias = calificacionesPorAlumno[alumno.id] || [];
    
    materias.sort((a: any, b: any) => {
      const asigA = Array.isArray(a.asignaturas) ? a.asignaturas[0] : a.asignaturas;
      const asigB = Array.isArray(b.asignaturas) ? b.asignaturas[0] : b.asignaturas;
      const nombreA = (asigA?.nombre || '').toLowerCase();
      const nombreB = (asigB?.nombre || '').toLowerCase();
      const isInglesA = nombreA.includes('inglés') || nombreA.includes('ingles');
      const isInglesB = nombreB.includes('inglés') || nombreB.includes('ingles');
      if (isInglesA && !isInglesB) return 1;
      if (!isInglesA && isInglesB) return -1;
      const claveA = asigA?.clave_legado || '';
      const claveB = asigB?.clave_legado || '';
      return claveA.localeCompare(claveB);
    });
    
    const promedio = calcularPromedioTruncado(materias);

    const tipoPeriodoBase = (alumno.tipo_periodo || 'CUATRIMESTRAL').toUpperCase();
    const isSemestral = tipoPeriodoBase === 'SEMESTRAL';
    const tipoPeriodoCorto = isSemestral ? 'SEMESTRE' : 'CUATRIMESTRE';
    const tipoPeriodoLargo = isSemestral ? 'SEMESTRAL' : 'CUATRIMESTRAL';

    let periodoTexto = 'ASIGNATURAS DEL PERIODO';
    
    let numeroPeriodoDefinitivo = alumno.grado_grupo;
    if (!numeroPeriodoDefinitivo && materias.length > 0) {
       const asig0 = Array.isArray(materias[0].asignaturas) ? materias[0].asignaturas[0] : materias[0].asignaturas;
       if (asig0?.numero_periodo) {
         numeroPeriodoDefinitivo = asig0.numero_periodo;
       }
    }
    
    if (numeroPeriodoDefinitivo) {
       const p = parseInt(numeroPeriodoDefinitivo);
       const ordinarios = ['PRIMER', 'SEGUNDO', 'TERCER', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO', 'DUODÉCIMO'];
       if (p >= 1 && p <= 12) {
         periodoTexto = `ASIGNATURAS DEL ${ordinarios[p-1]} ${tipoPeriodoCorto}`;
       } else {
         periodoTexto = `ASIGNATURAS DEL ${tipoPeriodoCorto} ${p}`;
       }
    }

    const materiasProps = materias.map((m: any) => {
      const calif = formatCalif(m.calificacion_final);
      const letraRaw = calif !== '-' ? numeroALetra(calif) : '-';
      return {
        clave: m.asignaturas?.clave_legado || 'S/C',
        nombre: toTitleCase(m.asignaturas?.nombre || 'Materia Desconocida'),
        calif,
        letra: letraRaw !== '-' ? toTitleCase(letraRaw) : '-'
      };
    });

    const firmanteNombre = firmante ? toTitleCase(`${firmante.nombres} ${firmante.apellido_paterno}`) : toTitleCase(config?.directorNombre || 'LIC. ABEL RODRIGUEZ ISLAS');
    const cargoFirmante = firmante ? toTitleCase(firmante.puesto || 'COORDINADOR ACADEMICO') : toTitleCase(config?.directorCargo || 'COORDINACION ESCOLAR');

    const pdfProps = {
      alumno,
      materias: materiasProps,
      ciclo,
      config,
      firmante,
      opciones,
      base64Logo,
      base64Sello,
      base64Firma,
      promedio,
      promedioLetra: toTitleCase(promedioALetra(promedio)),
      tipoPeriodoLargo,
      periodoTexto,
      firmanteNombre,
      cargoFirmante
    };

    const doc = React.createElement(BoletaPDFDocument, { props: pdfProps });
    const blob = await pdf(doc).toBlob();
    
    const safeName = `Boleta_${alumno.matricula || 'SinMatricula'}_${alumno.nombres.replace(/\s+/g, '')}_${alumno.apellido_paterno.replace(/\s+/g, '')}.pdf`;
    
    let folder = zip;
    if (opciones.folderBy === 'grupo') {
      const g = alumno.grupo || alumno.grado_grupo || 'Sin Grupo';
      folder = zip.folder(g) || zip;
    } else if (opciones.folderBy === 'carrera') {
      const c = alumno.licenciatura || 'Sin Carrera';
      folder = zip.folder(c) || zip;
    }
    folder.file(safeName, blob);

  }

  // Generate and save ZIP
  onProgress(-1, alumnos.length, 'Comprimiendo archivo ZIP...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const finalFilename = opciones.filename || `Boletas_Ciclo_${ciclo.nombre}.zip`;
  saveAs(zipBlob, finalFilename);
};

/**
 * Generate a single PDF for one student (no ZIP wrapper).
 */
export const generateSingleBoletaPDF = async ({
  alumnos,
  inscripciones,
  ciclo,
  config,
  firmante,
  opciones,
  onProgress
}: {
  alumnos: any[];
  inscripciones: any[];
  ciclo: CicloEscolar;
  config: AppConfig | null;
  firmante?: Empleado;
  opciones: BoletaOpciones;
  onProgress: (current: number, total: number, status: string) => void;
}) => {
  const { pdf } = await import('@react-pdf/renderer');
  const { saveAs } = (await import('file-saver'));
  const React = (await import('react')).default;
  const { BoletaPDFDocument } = await import('../components/pdf/BoletaPDFDocument');

  const alumno = alumnos[0];
  onProgress(1, 1, `${alumno.nombres} ${alumno.apellido_paterno}`);

  const calificacionesPorAlumno: Record<string, any[]> = {};
  inscripciones.forEach(ins => {
    if (!calificacionesPorAlumno[ins.alumno_id]) calificacionesPorAlumno[ins.alumno_id] = [];
    calificacionesPorAlumno[ins.alumno_id].push(ins);
  });

  const base64Sello = await fetchImageAsBase64(config?.selloUrl);
  const base64Firma = await fetchImageAsBase64(firmante?.firma_url);
  const base64Logo = await fetchImageAsBase64(config?.logoUrl);

  let materias = calificacionesPorAlumno[alumno.id] || [];

  materias.sort((a: any, b: any) => {
    const asigA = Array.isArray(a.asignaturas) ? a.asignaturas[0] : a.asignaturas;
    const asigB = Array.isArray(b.asignaturas) ? b.asignaturas[0] : b.asignaturas;
    const nombreA = (asigA?.nombre || '').toLowerCase();
    const nombreB = (asigB?.nombre || '').toLowerCase();
    const isInglesA = nombreA.includes('inglés') || nombreA.includes('ingles');
    const isInglesB = nombreB.includes('inglés') || nombreB.includes('ingles');
    if (isInglesA && !isInglesB) return 1;
    if (!isInglesA && isInglesB) return -1;
    const claveA = asigA?.clave_legado || '';
    const claveB = asigB?.clave_legado || '';
    return claveA.localeCompare(claveB);
  });

  const promedio = calcularPromedioTruncado(materias);

  const tipoPeriodoBase = (alumno.tipo_periodo || 'CUATRIMESTRAL').toUpperCase();
  const isSemestral = tipoPeriodoBase === 'SEMESTRAL';
  const tipoPeriodoCorto = isSemestral ? 'SEMESTRE' : 'CUATRIMESTRE';
  const tipoPeriodoLargo = isSemestral ? 'SEMESTRAL' : 'CUATRIMESTRAL';

  let periodoTexto = 'ASIGNATURAS DEL PERIODO';
  
  let numeroPeriodoDefinitivo = alumno.grado_grupo;
  if (!numeroPeriodoDefinitivo && materias.length > 0) {
     const asig0 = Array.isArray(materias[0].asignaturas) ? materias[0].asignaturas[0] : materias[0].asignaturas;
     if (asig0?.numero_periodo) {
       numeroPeriodoDefinitivo = asig0.numero_periodo;
     }
  }
  
  if (numeroPeriodoDefinitivo) {
     const p = parseInt(numeroPeriodoDefinitivo);
     const ordinarios = ['PRIMER', 'SEGUNDO', 'TERCER', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO', 'DUODÉCIMO'];
     if (p >= 1 && p <= 12) {
       periodoTexto = `ASIGNATURAS DEL ${ordinarios[p-1]} ${tipoPeriodoCorto}`;
     } else {
       periodoTexto = `ASIGNATURAS DEL ${tipoPeriodoCorto} ${p}`;
     }
  }

  const materiasProps = materias.map((m: any) => {
    const calif = formatCalif(m.calificacion_final);
    const letraRaw = calif !== '-' ? numeroALetra(calif) : '-';
    return {
      clave: m.asignaturas?.clave_legado || 'S/C',
      nombre: toTitleCase(m.asignaturas?.nombre || 'Materia Desconocida'),
      calif,
      letra: letraRaw !== '-' ? toTitleCase(letraRaw) : '-'
    };
  });

  const firmanteNombre = firmante ? toTitleCase(`${firmante.nombres} ${firmante.apellido_paterno}`) : toTitleCase(config?.directorNombre || 'LIC. ABEL RODRIGUEZ ISLAS');
  const cargoFirmante = firmante ? toTitleCase(firmante.puesto || 'COORDINADOR ACADEMICO') : toTitleCase(config?.directorCargo || 'COORDINACION ESCOLAR');

  const pdfProps = {
    alumno,
    materias: materiasProps,
    ciclo,
    config,
    firmante,
    opciones,
    base64Logo,
    base64Sello,
    base64Firma,
    promedio,
    promedioLetra: toTitleCase(promedioALetra(promedio)),
    tipoPeriodoLargo,
    periodoTexto,
    firmanteNombre,
    cargoFirmante
  };

  const doc = React.createElement(BoletaPDFDocument, { props: pdfProps });
  const blob = await pdf(doc).toBlob();

  const safeName = `Boleta_${alumno.matricula || 'SinMatricula'}_${alumno.nombres.replace(/\s+/g, '')}_${alumno.apellido_paterno.replace(/\s+/g, '')}.pdf`;
  saveAs(blob, safeName);
};
