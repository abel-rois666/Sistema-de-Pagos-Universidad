import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AppConfig, Empleado } from '../types';

export interface TitulacionAlumnoData {
  alumno: any;
  configuracion: {
    correo: string;
    modalidad_id: string;
    fecha_examen: string;
    fecha_exencion: string;
    antecedente_inicio: string;
    antecedente_fin: string;
    cedula_especialidad: string;
    folio_control: string;
    id_autorizacion: string;
    fundamento_legal_ss: string;
  };
}

const ENTIDADES_CATALOGO: Record<string, { id: string, nombre: string }> = {
  'AGUASCALIENTES': { id: '01', nombre: 'AGUASCALIENTES' },
  'BAJA CALIFORNIA': { id: '02', nombre: 'BAJA CALIFORNIA' },
  'BAJA CALIFORNIA SUR': { id: '03', nombre: 'BAJA CALIFORNIA SUR' },
  'CAMPECHE': { id: '04', nombre: 'CAMPECHE' },
  'COAHUILA': { id: '05', nombre: 'COAHUILA DE ZARAGOZA' },
  'COAHUILA DE ZARAGOZA': { id: '05', nombre: 'COAHUILA DE ZARAGOZA' },
  'COLIMA': { id: '06', nombre: 'COLIMA' },
  'CHIAPAS': { id: '07', nombre: 'CHIAPAS' },
  'CHIHUAHUA': { id: '08', nombre: 'CHIHUAHUA' },
  'CIUDAD DE MÉXICO': { id: '09', nombre: 'CIUDAD DE MÉXICO' },
  'CIUDAD DE MEXICO': { id: '09', nombre: 'CIUDAD DE MÉXICO' },
  'CDMX': { id: '09', nombre: 'CIUDAD DE MÉXICO' },
  'DF': { id: '09', nombre: 'CIUDAD DE MÉXICO' },
  'D.F.': { id: '09', nombre: 'CIUDAD DE MÉXICO' },
  'DURANGO': { id: '10', nombre: 'DURANGO' },
  'GUANAJUATO': { id: '11', nombre: 'GUANAJUATO' },
  'GUERRERO': { id: '12', nombre: 'GUERRERO' },
  'HIDALGO': { id: '13', nombre: 'HIDALGO' },
  'JALISCO': { id: '14', nombre: 'JALISCO' },
  'ESTADO DE MÉXICO': { id: '15', nombre: 'MÉXICO' },
  'ESTADO DE MEXICO': { id: '15', nombre: 'MÉXICO' },
  'MÉXICO': { id: '15', nombre: 'MÉXICO' },
  'MEXICO': { id: '15', nombre: 'MÉXICO' },
  'MEX': { id: '15', nombre: 'MÉXICO' },
  'MICHOACÁN': { id: '16', nombre: 'MICHOACÁN DE OCAMPO' },
  'MICHOACÁN DE OCAMPO': { id: '16', nombre: 'MICHOACÁN DE OCAMPO' },
  'MICHOACAN': { id: '16', nombre: 'MICHOACÁN DE OCAMPO' },
  'MORELOS': { id: '17', nombre: 'MORELOS' },
  'NAYARIT': { id: '18', nombre: 'NAYARIT' },
  'NUEVO LEÓN': { id: '19', nombre: 'NUEVO LEÓN' },
  'NUEVO LEON': { id: '19', nombre: 'NUEVO LEÓN' },
  'OAXACA': { id: '20', nombre: 'OAXACA' },
  'PUEBLA': { id: '21', nombre: 'PUEBLA' },
  'QUERÉTARO': { id: '22', nombre: 'QUERÉTARO' },
  'QUERETARO': { id: '22', nombre: 'QUERÉTARO' },
  'QUINTANA ROO': { id: '23', nombre: 'QUINTANA ROO' },
  'SAN LUIS POTOSÍ': { id: '24', nombre: 'SAN LUIS POTOSÍ' },
  'SAN LUIS POTOSI': { id: '24', nombre: 'SAN LUIS POTOSÍ' },
  'SINALOA': { id: '25', nombre: 'SINALOA' },
  'SONORA': { id: '26', nombre: 'SONORA' },
  'TABASCO': { id: '27', nombre: 'TABASCO' },
  'TAMAULIPAS': { id: '28', nombre: 'TAMAULIPAS' },
  'TLAXCALA': { id: '29', nombre: 'TLAXCALA' },
  'VERACRUZ': { id: '30', nombre: 'VERACRUZ DE IGNACIO DE LA LLAVE' },
  'VERACRUZ DE IGNACIO DE LA LLAVE': { id: '30', nombre: 'VERACRUZ DE IGNACIO DE LA LLAVE' },
  'VER': { id: '30', nombre: 'VERACRUZ DE IGNACIO DE LA LLAVE' },
  'YUCATÁN': { id: '31', nombre: 'YUCATÁN' },
  'YUCATAN': { id: '31', nombre: 'YUCATÁN' },
  'YUC': { id: '31', nombre: 'YUCATÁN' },
  'ZACATECAS': { id: '32', nombre: 'ZACATECAS' },
  'ZAC': { id: '32', nombre: 'ZACATECAS' },
  'EXTRANJERO': { id: '33', nombre: 'EXTRANJERO' }
};

const MODALIDADES_TITULACION: Record<string, string> = {
  '1': 'POR TESIS',
  '2': 'POR PROMEDIO',
  '3': 'POR ESTUDIOS DE POSGRADOS',
  '4': 'POR EXPERIENCIA LABORAL',
  '5': 'POR CENEVAL',
  '6': 'OTRO'
};

const AUTORIZACIONES_RECONOCIMIENTO: Record<string, string> = {
  '1': 'RVOE FEDERAL',
  '2': 'RVOE ESTATAL',
  '3': 'AUTORIZACIÓN FEDERAL',
  '4': 'AUTORIZACIÓN ESTATAL',
  '5': 'ACTA DE SESIÓN',
  '6': 'ACUERDO DE INCORPORACIÓN',
  '7': 'ACUERDO SECRETARIAL SEP',
  '8': 'DECRETO DE CREACIÓN',
  '9': 'OTRO'
};

const FUNDAMENTOS_SERVICIO_SOCIAL: Record<string, string> = {
  '1': 'ART. 52 LRART. 5 CONST',
  '2': 'ART. 55 LRART. 5 CONST',
  '3': 'ART. 91 RLRART. 5 CONST',
  '4': 'ART. 10 REGLAMENTO PARA LA PRESTACIÓN DEL SERVICIO SOCIAL DE LOS ESTUDIANTES DE LAS INSTITUCIONES DE EDUCACIÓN SUPERIOR EN LA REPÚBLICA MEXICANA',
  '5': 'NO APLICA'
};

const TIPOS_ANTECEDENTE: Record<string, { id: string, desc: string }> = {
  'DOCTORADO': { id: '1', desc: 'MAESTRÍA' },
  'ESPECIALIDAD': { id: '2', desc: 'LICENCIATURA' },
  'MAESTRIA': { id: '2', desc: 'LICENCIATURA' },
  'MAESTRÍA': { id: '2', desc: 'LICENCIATURA' },
  'LICENCIATURA': { id: '4', desc: 'BACHILLERATO' }
};

function formatFechaDDMMAAAA(fechaIso?: string | null): string {
  if (!fechaIso) return '';
  const parts = fechaIso.split('-');
  if (parts.length !== 3) return fechaIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getEntidadInfo(estadoName?: string | null): { id: string, nombre: string } {
  if (!estadoName) return { id: '', nombre: '' };
  let normalized = estadoName.trim().toUpperCase();

  // If it's a numeric ID like "15" or "09" or "9"
  const asNumber = parseInt(normalized, 10);
  if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 33) {
    const padded = asNumber.toString().padStart(2, '0');
    const found = Object.values(ENTIDADES_CATALOGO).find(e => e.id === padded);
    if (found) return found;
  }

  // Remove accents for searching
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Direct match
  if (ENTIDADES_CATALOGO[normalized]) {
    return ENTIDADES_CATALOGO[normalized];
  }

  // Find in keys by removing accents from keys too
  for (const key of Object.keys(ENTIDADES_CATALOGO)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized === normalizedKey || normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
      return ENTIDADES_CATALOGO[key];
    }
  }

  return { id: '', nombre: '' };
}

export async function generarLayoutTitulacionDGAIR(
  alumnosData: TitulacionAlumnoData[],
  config: AppConfig,
  firmante1: Empleado,
  firmante2?: Empleado | null
) {
  try {
    const response = await fetch('/Layout Títulos_v6_EJEMPLO.xlsx');
    if (!response.ok) {
      throw new Error('No se pudo descargar la plantilla /Layout Títulos_v6_EJEMPLO.xlsx');
    }
    const arrayBuffer = await response.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0]; // La primera pestaña

    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

    let currentRow = 4; // Empezamos en la fila 4

    for (const data of alumnosData) {
      const { alumno, configuracion } = data;
      const carrera = alumno.carrera || {};
      const plan = alumno.plan || {};
      const nivel = (carrera.nivel_educativo || '').toUpperCase();
      
      // Folio Control (Manual del frontend)
      const folioControl = (configuracion.folio_control || '').toUpperCase();

      // Nombre Carrera
      const nombreCarreraFull = `${nivel} EN ${carrera.nombre || ''}`.toUpperCase();

      // Fechas Inicio y Fin Ciclos (Obtenidas de tabla ciclos_escolares: fecha_inicio y fecha_termino)
      let fInicioCiclo = '';
      let fFinCiclo = '';
      if (alumno.inscripciones && alumno.inscripciones.length > 0) {
        const fechasInicio: Date[] = [];
        const fechasFin: Date[] = [];
        alumno.inscripciones.forEach((i: any) => {
          if (i.ciclo) {
            // Convertimos las fechas string a objetos Date (asumiendo formato YYYY-MM-DD o ISO)
            if (i.ciclo.fecha_inicio) fechasInicio.push(new Date(i.ciclo.fecha_inicio + 'T00:00:00'));
            if (i.ciclo.fecha_termino) fechasFin.push(new Date(i.ciclo.fecha_termino + 'T00:00:00'));
          }
        });
        if (fechasInicio.length > 0) {
          const minDate = new Date(Math.min(...fechasInicio.map(d => d.getTime())));
          const isoStr = minDate.toISOString().split('T')[0];
          fInicioCiclo = formatFechaDDMMAAAA(isoStr);
        }
        if (fechasFin.length > 0) {
          const maxDate = new Date(Math.max(...fechasFin.map(d => d.getTime())));
          const isoStr = maxDate.toISOString().split('T')[0];
          fFinCiclo = formatFechaDDMMAAAA(isoStr);
        }
      }

      // Servicio Social
      let cumplioSS = '0';
      let idSS = configuracion.fundamento_legal_ss || '';
      let descSS = idSS ? FUNDAMENTOS_SERVICIO_SOCIAL[idSS] || '' : '';

      if (nivel === 'LICENCIATURA') {
        const ss = alumno.servicio_social;
        if (ss && ss.estatus === 'LIBERADO') {
          cumplioSS = '1';
        }
      } else {
        cumplioSS = '0';
        // idSS ya vendrá de configuracion o lo forzamos a 5 si aplica en el frontend
      }

      // Autorizacion Reconocimiento
      const idAut = configuracion.id_autorizacion || '';
      const descAut = idAut ? AUTORIZACIONES_RECONOCIMIENTO[idAut] || '' : '';

      // Entidades
      const entidadProcedencia = getEntidadInfo(alumno.estado_escolaridad);
      
      // Tipo Antecedente
      let idTipoAnt = '';
      let descTipoAnt = '';
      if (TIPOS_ANTECEDENTE[nivel]) {
        idTipoAnt = TIPOS_ANTECEDENTE[nivel].id;
        descTipoAnt = TIPOS_ANTECEDENTE[nivel].desc;
      }

      // Modalidad Desc
      const descModalidad = MODALIDADES_TITULACION[configuracion.modalidad_id] || '';

      const filaDatos = [
        folioControl, // 1
        firmante1.clave_puesto || '', // 2
        (firmante1.puesto || '').toUpperCase(), // 3
        (firmante1.titulo_academico || '').toUpperCase(), // 4
        (firmante1.nombres || '').toUpperCase(), // 5
        (firmante1.apellido_paterno || '').toUpperCase(), // 6
        (firmante1.apellido_materno || '').toUpperCase(), // 7
        (firmante1.curp || '').toUpperCase(), // 8
        firmante2 ? firmante2.clave_puesto || '' : '', // 9
        firmante2 ? (firmante2.puesto || '').toUpperCase() : '', // 10
        firmante2 ? (firmante2.titulo_academico || '').toUpperCase() : '', // 11
        firmante2 ? (firmante2.nombres || '').toUpperCase() : '', // 12
        firmante2 ? (firmante2.apellido_paterno || '').toUpperCase() : '', // 13
        firmante2 ? (firmante2.apellido_materno || '').toUpperCase() : '', // 14
        firmante2 ? (firmante2.curp || '').toUpperCase() : '', // 15
        config.claveInstitucion || '', // 16
        'CENTRO UNIVERSITARIO ORIENTE DE MÉXICO', // 17
        (carrera.clave || '').toUpperCase(), // 18
        nombreCarreraFull, // 19
        fInicioCiclo, // 20
        fFinCiclo, // 21
        idAut, // 22
        descAut.toUpperCase(), // 23
        (plan.rvoe || '').toUpperCase(), // 24
        (alumno.curp || '').toUpperCase(), // 25
        (alumno.nombres || '').toUpperCase(), // 26
        (alumno.apellido_paterno || '').toUpperCase(), // 27
        (alumno.apellido_materno || '').toUpperCase(), // 28
        (configuracion.correo || '').toLowerCase(), // 29
        fechaActual, // 30
        configuracion.modalidad_id || '', // 31
        descModalidad, // 32
        configuracion.modalidad_id === '1' ? formatFechaDDMMAAAA(configuracion.fecha_examen) : '', // 33
        configuracion.modalidad_id !== '1' && configuracion.modalidad_id ? formatFechaDDMMAAAA(configuracion.fecha_exencion) : '', // 34
        cumplioSS, // 35
        idSS, // 36
        descSS, // 37
        config.claveEntidadUniversidad || '', // 38
        (config.nombreEntidadUniversidad || '').toUpperCase(), // 39
        (alumno.escuela_procedencia || '').toUpperCase(), // 40
        idTipoAnt, // 41
        descTipoAnt, // 42
        entidadProcedencia.id || '', // 43
        entidadProcedencia.nombre || '', // 44
        formatFechaDDMMAAAA(configuracion.antecedente_inicio), // 45
        formatFechaDDMMAAAA(configuracion.antecedente_fin), // 46
        ['ESPECIALIDAD', 'MAESTRÍA', 'MAESTRIA', 'DOCTORADO'].includes(nivel) ? configuracion.cedula_especialidad : '' // 47
      ];

      // Inyectar en exceljs manteniendo formato
      const row = worksheet.getRow(currentRow);
      filaDatos.forEach((val, index) => {
        const cell = row.getCell(index + 1);
        if (index === 28) {
          // Correo en minúsculas
          cell.value = typeof val === 'string' ? val.toLowerCase() : val;
        } else {
          cell.value = typeof val === 'string' ? val.toUpperCase() : val;
        }
      });
      row.commit();
      
      currentRow++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `LAYOUT_TITULACION_DGAIR_${new Date().getTime()}.xlsx`);

  } catch (error) {
    console.error('Error al exportar:', error);
    throw error;
  }
}
