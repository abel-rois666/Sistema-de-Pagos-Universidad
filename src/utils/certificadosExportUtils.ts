import * as XLSX from 'xlsx';
import type { AnalisisMateriaDGAIR } from './kardexLogicUtils';
import type { AppConfig, Empleado } from '../types';

export async function generarLayoutDGAIR(
  alumno: any,
  inscripcionesAnalizadas: AnalisisMateriaDGAIR[],
  config: AppConfig,
  responsable: Empleado,
  tipoCertificacionId: number,
  tipoCertificacionTexto: string,
  totalAsignaturasLayout: number
) {
  try {
    // 1. Obtener la plantilla base de Excel desde public
    const response = await fetch('/layout_certificados_base.xlsx');
    if (!response.ok) {
      throw new Error('No se pudo cargar la plantilla layout_certificados_base.xlsx');
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Leer el workbook preservando toda su estructura (hojas extras, etc)
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // La hoja principal a editar debe llamarse estrictamente "MIS CERTIFICADOS"
    const sheetName = 'MIS CERTIFICADOS';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`La plantilla no contiene la hoja "${sheetName}"`);
    }

    // 3. Preparar los datos mapeados a las 37 columnas
    const matrizDatos: any[][] = [];
    
    // Obtener información común
    const fechaActual = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
        config.clave_dgair || '', // 1. ID_Institución
        config.clave_institucion || '', // 2. Clave_Campus
        config.clave_entidad_federativa || '', // 3. ID_Entidad Federativa
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
        alumno.fecha_nacimiento || '', // 15. FECHA NACIMIENTO
        '', // 16. FOTO
        '', // 17. FIRMA AUTÓGRAFA
        tipoCertificacionId, // 18. ID_TIPO CERTIFICACIÓN
        tipoCertificacionTexto, // 19. TIPO CERTIFICACIÓN
        fechaActual, // 20. FECHA (Expedición)
        config.clave_entidad_universidad || '', // 21. ID_LUGAR EXPEDICIÓN
        config.nombre_entidad_universidad || '', // 22. LUGAR EXPEDICIÓN
        alumno.plan?.id_tipo_periodo || '', // 23. ID_TIPO PERIODO
        totalAsignaturasLayout || '', // 24. TOTAL de Asignaturas
        clavePlanSoloNumeros, // 25. CLAVE PLAN ESTUDIOS
        alumno.carrera?.nombre || '', // 26. NOMBRE PLAN ESTUDIOS
        alumno.plan?.rvoe || '', // 27. RVOE
        alumno.plan?.fecha_rvoe || '', // 28. Fecha_RVOE
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
      
      matrizDatos.push(fila);
    }

    // 4. Inyectar datos a partir de A2 (evita sobreescribir A1 que son encabezados)
    XLSX.utils.sheet_add_aoa(sheet, matrizDatos, { origin: "A2" });

    // 5. Exportar archivo
    XLSX.writeFile(workbook, `LAYOUT_DGAIR_${alumno.matricula || 'SIN_MATRICULA'}.xlsx`);
    
  } catch (error) {
    console.error('Error al generar Excel DGAIR:', error);
    throw error;
  }
}
