import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AnalisisMateriaDGAIR } from './kardexLogicUtils';
import type { AppConfig, Empleado } from '../types';

export interface AlumnoExportData {
  alumno: any;
  inscripcionesAnalizadas: AnalisisMateriaDGAIR[];
  tipoCertificacionId: number;
  tipoCertificacionTexto: string;
  totalAsignaturasLayout: number;
}

export async function generarLayoutDGAIR(
  alumnosData: AlumnoExportData[],
  config: AppConfig,
  responsable: Empleado
) {
  try {
    // 1. Obtener la plantilla base de Excel desde public
    const response = await fetch('/layout_certificados_base.xlsx');
    if (!response.ok) {
      throw new Error('No se pudo cargar la plantilla layout_certificados_base.xlsx');
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Leer el workbook preservando toda su estructura (hojas extras, etc)
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // La hoja principal a editar debe llamarse estrictamente "MIS CERTIFICADOS"
    const sheetName = 'MIS CERTIFICADOS';
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      throw new Error(`La plantilla no contiene la hoja "${sheetName}"`);
    }

    // Comenzamos en la fila 2
    let currentRow = 2;
    
    // Helper para convertir fechas ISO (YYYY-MM-DD) a dd/mm/aaaa
    const formatFechaDDMMAAAA = (fecha: string | null | undefined): string => {
      if (!fecha) return '';
      const parts = fecha.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return fecha;
    };

    // Obtener información común
    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // Iterar sobre cada alumno en la cola de procesamiento
    for (const data of alumnosData) {
      const { alumno, inscripcionesAnalizadas, tipoCertificacionId, tipoCertificacionTexto, totalAsignaturasLayout } = data;
      const numAsignaturasCursadas = inscripcionesAnalizadas.length;
      
      // Calcular promedio general
      let sumCal = 0;
      let countCal = 0;
      for (const item of inscripcionesAnalizadas) {
        const calFinal = parseFloat(item.materia?.calificacion_final || 0);
        if (!isNaN(calFinal)) {
          sumCal += calFinal;
          countCal++;
        }
      }
      const promedioGeneral = countCal > 0 ? (sumCal / countCal).toFixed(2) : '0.00';
      
      // Extraer clave numérica de plan de estudios (ej. 2001_LA -> 2001)
      const clavePlanStr = alumno.plan?.clave_legado || '';
      const clavePlanSoloNumeros = clavePlanStr.replace(/\D/g, '') || '';

      // Iterar materia por materia
      for (const item of inscripcionesAnalizadas) {
        const mat = item.materia;
        
        const fila = [
          config.claveDgair || '', // 1. ID_Institución
          config.claveInstitucion || '', // 2. Clave_Campus
          config.claveEntidadFederativa || '', // 3. ID_Entidad Federativa
          responsable.curp || '', // 4. CURP_Responsable
          responsable.nombres || '', // 5. Nombre
          responsable.apellido_paterno || '', // 6. Primer Apellido
          responsable.apellido_materno || '', // 7. Segundo Apellido
          responsable.clave_puesto || '', // 8. ID_Cargo Responsable
          alumno.matricula || '', // 9. NÚMERO CONTROL
          alumno.curp || '', // 10. CURP_ALUMNO
          alumno.nombres || '', // 11. NOMBRE
          alumno.apellido_paterno || '', // 12. PRIMER APELLIDO
          alumno.apellido_materno || '', // 13. SEGUNDO APELLIDO
          alumno.id_sexo || '', // 14. ID_GÉNERO
          formatFechaDDMMAAAA(alumno.fecha_nacimiento), // 15. FECHA NACIMIENTO
          '', // 16. FOTO
          '', // 17. FIRMA AUTÓGRAFA
          tipoCertificacionId, // 18. ID_TIPO CERTIFICACIÓN
          tipoCertificacionTexto, // 19. TIPO CERTIFICACIÓN
          fechaActual, // 20. FECHA (Expedición)
          config.claveEntidadUniversidad || '', // 21. ID_LUGAR EXPEDICIÓN
          config.nombreEntidadUniversidad || '', // 22. LUGAR EXPEDICIÓN
          alumno.plan?.id_tipo_periodo || '', // 23. ID_TIPO PERIODO
          totalAsignaturasLayout || '', // 24. TOTAL de Asignaturas
          clavePlanSoloNumeros, // 25. CLAVE PLAN ESTUDIOS
          alumno.carrera?.nombre || '', // 26. NOMBRE PLAN ESTUDIOS
          alumno.plan?.rvoe || '', // 27. RVOE
          formatFechaDDMMAAAA(alumno.plan?.fecha_rvoe), // 28. Fecha_RVOE
          alumno.plan?.id_plan_certificacion || '', // 29. ID_ CARRERA
          numAsignaturasCursadas, // 30. Número de ASIGNATURAS cursadas
          promedioGeneral, // 31. PROMEDIO GENERAL
          mat.asignatura?.clave_certificacion || '', // 32. ID_ ASIGNATURA
          mat.asignatura?.nombre || '', // 33. NOMBRE ASIGNATURA
          mat.ciclo?.nombre || '', // 34. CICLO
          mat.calificacion_final || '', // 35. CALIFICACIÓN
          item.id_observacion, // 36. ID_OBSERVACIONES
          item.observacion_texto // 37. OBSERVACIONES
        ];
        
        const row = sheet.getRow(currentRow);
        fila.forEach((val, index) => {
          row.getCell(index + 1).value = val;
        });
        row.commit();
        
        currentRow++;
      }
    }

    // 5. Exportar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = alumnosData.length === 1 
      ? `LAYOUT_DGAIR_${alumnosData[0].alumno.matricula || 'SIN_MATRICULA'}.xlsx`
      : `LAYOUT_DGAIR_MASIVO_${alumnosData.length}_ALUMNOS.xlsx`;
    saveAs(blob, fileName);
    
  } catch (error) {
    console.error('Error al generar Excel DGAIR:', error);
    throw error;
  }
}
