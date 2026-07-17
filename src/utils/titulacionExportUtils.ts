import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { AppConfig, Empleado } from '../types';

export interface TitulacionAlumnoData {
  alumno: any; // Incluye carrera, plan, inscripciones, ficha_titulacion, servicio_social, etc.
  configuracion: {
    correo: string;
    modalidad_id: string;
    fecha_examen: string;
    fecha_exencion: string;
    antecedente_inicio: string;
    antecedente_fin: string;
    cedula_especialidad: string;
  };
}

// Catálogo Oficial de Entidades Federativas
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
  'DURANGO': { id: '10', nombre: 'DURANGO' },
  'GUANAJUATO': { id: '11', nombre: 'GUANAJUATO' },
  'GUERRERO': { id: '12', nombre: 'GUERRERO' },
  'HIDALGO': { id: '13', nombre: 'HIDALGO' },
  'JALISCO': { id: '14', nombre: 'JALISCO' },
  'ESTADO DE MÉXICO': { id: '15', nombre: 'MÉXICO' },
  'ESTADO DE MEXICO': { id: '15', nombre: 'MÉXICO' },
  'MÉXICO': { id: '15', nombre: 'MÉXICO' },
  'MEXICO': { id: '15', nombre: 'MÉXICO' },
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
  'YUCATÁN': { id: '31', nombre: 'YUCATÁN' },
  'YUCATAN': { id: '31', nombre: 'YUCATÁN' },
  'ZACATECAS': { id: '32', nombre: 'ZACATECAS' },
  'EXTRANJERO': { id: '33', nombre: 'EXTRANJERO' }
};

const MODALIDADES_TITULACION: Record<string, string> = {
  '1': 'POR TESIS',
  '2': 'POR PROMEDIO',
  '3': 'POR ESTUDIOS DE POSGRADO',
  '4': 'POR EXPERIENCIA PROFESIONAL',
  '5': 'POR CENEVAL',
  '6': 'OTRO'
};

const FUNDAMENTOS_SERVICIO_SOCIAL: Record<string, string> = {
  '1': 'ARTÍCULO 52 DE LA LEY REGLAMENTARIA DEL ARTÍCULO 5 CONSTITUCIONAL RELATIVO AL EJERCICIO DE LAS PROFESIONES EN EL DISTRITO FEDERAL',
  '2': 'ARTÍCULO 55 DE LA LEY REGLAMENTARIA DEL ARTÍCULO 5 CONSTITUCIONAL RELATIVO AL EJERCICIO DE LAS PROFESIONES EN EL DISTRITO FEDERAL',
  '3': 'ARTÍCULO 91 DEL REGLAMENTO DE LA LEY REGLAMENTARIA DEL ARTÍCULO 5 CONSTITUCIONAL RELATIVO AL EJERCICIO DE LAS PROFESIONES EN EL DISTRITO FEDERAL',
  '4': 'ACUERDO NÚMERO 286 EMITIDO POR LA SECRETARÍA DE EDUCACIÓN PÚBLICA',
  '5': 'EL CUMPLIMIENTO DEL SERVICIO SOCIAL NO ES EXIGIBLE PARA LA TITULACIÓN / OBTENCIÓN DE GRADO'
};

const TIPOS_ANTECEDENTE: Record<string, { id: string, desc: string }> = {
  'DOCTORADO': { id: '1', desc: 'DOCTORADO' },
  'ESPECIALIDAD': { id: '2', desc: 'MAESTRÍA O ESPECIALIDAD' },
  'MAESTRIA': { id: '2', desc: 'MAESTRÍA O ESPECIALIDAD' },
  'MAESTRÍA': { id: '2', desc: 'MAESTRÍA O ESPECIALIDAD' },
  'LICENCIATURA': { id: '4', desc: 'LICENCIATURA' },
  'PREPARATORIA': { id: '6', desc: 'BACHILLERATO' },
  'BACHILLERATO': { id: '6', desc: 'BACHILLERATO' }
};

function formatFechaDDMMAAAA(fechaIso?: string | null): string {
  if (!fechaIso) return '';
  const parts = fechaIso.split('-');
  if (parts.length !== 3) return fechaIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getEntidadInfo(estadoName?: string | null): { id: string, nombre: string } {
  if (!estadoName) return { id: '', nombre: '' };
  const normalized = estadoName.trim().toUpperCase();
  if (ENTIDADES_CATALOGO[normalized]) {
    return ENTIDADES_CATALOGO[normalized];
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

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const matrizDatos: any[][] = [];

    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

    for (const data of alumnosData) {
      const { alumno, configuracion } = data;
      const carrera = alumno.carrera || {};
      const plan = alumno.plan || {};
      const nivel = (carrera.nivel_educativo || '').toUpperCase();
      
      // Folio Control
      const fNivel = nivel.charAt(0) || 'X';
      const fCarrera = (carrera.nombre || '').charAt(0) || 'X';
      const folioControl = `${fNivel}${fCarrera}-000-0000`;

      // Nombre Carrera
      const nombreCarreraFull = `${nivel} EN ${carrera.nombre || ''}`.toUpperCase();

      // Fechas Inicio y Fin Ciclos
      let fInicioCiclo = '';
      let fFinCiclo = '';
      if (alumno.inscripciones && alumno.inscripciones.length > 0) {
        const fechasInicio: Date[] = [];
        const fechasFin: Date[] = [];
        alumno.inscripciones.forEach((i: any) => {
          if (i.ciclo) {
            if (i.ciclo.fecha_inicio) fechasInicio.push(new Date(i.ciclo.fecha_inicio));
            if (i.ciclo.fecha_termino) fechasFin.push(new Date(i.ciclo.fecha_termino));
          }
        });
        if (fechasInicio.length > 0) {
          const minDate = new Date(Math.min(...fechasInicio.map(d => d.getTime())));
          fInicioCiclo = formatFechaDDMMAAAA(minDate.toISOString().split('T')[0]);
        }
        if (fechasFin.length > 0) {
          const maxDate = new Date(Math.max(...fechasFin.map(d => d.getTime())));
          fFinCiclo = formatFechaDDMMAAAA(maxDate.toISOString().split('T')[0]);
        }
      }

      // Servicio Social
      let cumplioSS = '0';
      let idSS = '';
      let descSS = '';

      if (nivel === 'LICENCIATURA') {
        const ss = alumno.servicio_social;
        if (ss && ss.estatus === 'LIBERADO') {
          cumplioSS = '1';
          if (ss.variante_legal === 'ART_52') idSS = '1';
          else if (ss.variante_legal === 'ART_55') idSS = '2';
          else if (ss.variante_legal === 'ART_91') idSS = '3';
        }
      } else {
        cumplioSS = '0';
        idSS = '5';
      }

      if (idSS && FUNDAMENTOS_SERVICIO_SOCIAL[idSS]) {
        descSS = FUNDAMENTOS_SERVICIO_SOCIAL[idSS];
      }

      // Entidades
      const entidadProcedencia = getEntidadInfo(alumno.estado_escolaridad);
      
      // Tipo Antecedente
      let idTipoAnt = '';
      let descTipoAnt = '';
      if (nivel === 'LICENCIATURA') {
        idTipoAnt = '6'; // Bachillerato
        descTipoAnt = 'BACHILLERATO';
      } else if (nivel === 'ESPECIALIDAD' || nivel === 'MAESTRÍA' || nivel === 'MAESTRIA') {
        idTipoAnt = '4'; // Licenciatura
        descTipoAnt = 'LICENCIATURA';
      } else if (nivel === 'DOCTORADO') {
        idTipoAnt = '2'; // Maestría
        descTipoAnt = 'MAESTRÍA O ESPECIALIDAD';
      }

      // Modalidad Desc
      const descModalidad = MODALIDADES_TITULACION[configuracion.modalidad_id] || '';

      const fila = [
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
        plan.id_autorizacion_reconocimiento || '', // 22
        (plan.autorizacion_reconocimiento || '').toUpperCase(), // 23
        (plan.rvoe || '').toUpperCase(), // 24
        (alumno.curp || '').toUpperCase(), // 25
        (alumno.nombres || '').toUpperCase(), // 26
        (alumno.apellido_paterno || '').toUpperCase(), // 27
        (alumno.apellido_materno || '').toUpperCase(), // 28
        (configuracion.correo || '').toUpperCase(), // 29
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
        nivel === 'ESPECIALIDAD' ? configuracion.cedula_especialidad : '' // 47
      ];

      matrizDatos.push(fila.map(f => typeof f === 'string' ? f.toUpperCase() : f));
    }

    XLSX.utils.sheet_add_aoa(sheet, matrizDatos, { origin: "A4" });

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(blob, `LAYOUT_TITULACION_DGAIR_${new Date().getTime()}.xlsx`);

  } catch (error) {
    console.error('Error al exportar:', error);
    throw error;
  }
}
