import type ExcelJS from 'exceljs';

// A–AU: contrato contrastado con la muestra Layout Títulos_2.xlsx (18/11/2026).
export const ENCABEZADOS_TITULOS = ['De libre conformación','ID_CARGO','CARGO','ABR_TÍTULO_RESPONSABLE','NOMBRE_RESPONSABLE','PRIMER_APELLIDO_RESPONSABLE','SEGUNDO_APELLIDO_RESPONSABLE','CURP_RESPONSABLE','ID_CARGO','CARGO','ABR_TÍTULO_RESPONSABLE','NOMBRE_RESPONSABLE','PRIMER_APELLIDO_RESPONSABLE','SEGUNDO_APELLIDO_RESPONSABLE','CURP_RESPONSABLE','CLAVE_INSTITUCIÓN','NOMBRE_INSTITUCIÓN','CLAVE_CARRERA','NOMBRE_CARRERA','FECHA_INICIO','FECHA_TERMINACIÓN','ID_AUTORIZACION_RECONOCIMIENTO','AUTORIZACION_RECONOCIMIENTO','NÚMERO Acuerdo o RVOE','CURP','NOMBRE','PRIMER_APELLIDO','SEGUNDO_APELLIDO','CORREO_ELECTRÓNICO','FECHA_EXPEDICIÓN','ID_MODALIDAD_TITULACION','MODALIDAD_TITULACIÓN','FECHA_EXAMEN_PROFESIONAL','FECHA_EXENCIÓN_EXAMEN_PROFESIONAL','CUMPLIÓ_SERVICIO_SOCIAL','ID_FUNDAMENTO_LEGAL_SERVICIO_SOCIAL','FUNDAMENTO_LEGAL_SERVICIO_SOCIAL','ID_ENTIDAD_FEDERATIVA','ENTIDAD_FEDERATIVA','INSTITUCIÓN_PROCEDENCIA','ID_TIPO_ESTUDIO_ANTECEDENTE','TIPO_ESTUDIO_ANTECEDENTE','ID_ENTIDAD_FEDERATIVA','ENTIDAD_FEDERATIVA','FECHA_INICIO','FECHA_TERMINACIÓN','NÚMERO_CÉDULA'];
const FECHAS = new Set([20,21,30,33,34,45,46]);
const NUMEROS = new Set([2,9,18,22,31,35,36]);
const OPCIONALES = new Set([7,9,10,11,12,13,14,15,28,33,34,45,47]);

function fechaExcel(texto:string):Date|null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const [y,m,d]=texto.split('-').map(Number), fecha=new Date(Date.UTC(y,m-1,d));
  return y>=1900 && fecha.getUTCFullYear()===y && fecha.getUTCMonth()===m-1 && fecha.getUTCDate()===d ? fecha : null;
}

export function prepararFilaLayout(valores:unknown[]) {
  const errores:string[]=[];
  const textos=valores.map(v=>v==null?'':String(v).trim());
  const segundo=textos.slice(8,15).some(Boolean);
  const celdas=textos.map((texto,i):{valor:string|number|Date|null;formato:string}=>{
    const n=i+1, campo=`${ENCABEZADOS_TITULOS[i]} (columna ${n})`;
    const requerido= !OPCIONALES.has(n) || (segundo && [9,10,11,12,13,15].includes(n)) || (n===33 && textos[30]==='1') || (n===34 && Boolean(textos[30]) && textos[30]!=='1');
    const formato=FECHAS.has(n)?'dd/mm/yyyy':NUMEROS.has(n)?'0':'@';
    if (!texto) { if(requerido)errores.push(`Falta ${campo}.`);return {valor:null,formato}; }
    if (FECHAS.has(n)) { const fecha=fechaExcel(texto);if(!fecha)errores.push(`${campo}: fecha inválida; usa una fecha completa.`);return {valor:fecha,formato}; }
    if (NUMEROS.has(n)) {
      if(n===18 && !/^\d{6}$/.test(texto))errores.push(`${campo}: usa la clave de carrera de seis dígitos del catálogo de títulos.`);
      if(!/^\d+$/.test(texto)||!Number.isSafeInteger(Number(texto)))errores.push(`${campo}: debe ser un entero válido.`);
      const valor=Number(texto);
      if(n===35 && ![0,1].includes(valor))errores.push(`${campo}: solo admite 0 o 1.`);
      if([2,9,18,22,31,36].includes(n)&&valor<1)errores.push(`${campo}: el identificador debe ser positivo.`);
      if(n===31 && valor>6 || n===22 && valor>9 || n===36 && valor>5)errores.push(`${campo}: opción fuera del catálogo.`);
      return {valor,formato};
    }
    if ([8,15,25].includes(n) && !/^[A-Z0-9]{18}$/i.test(texto)) errores.push(`${campo}: la CURP debe tener 18 caracteres alfanuméricos.`);
    if(n===16 && !/^\d{6}$/.test(texto))errores.push(`${campo}: usa la clave institucional de seis dígitos del catálogo de títulos.`);
    if([38,43].includes(n) && !/^(0[1-9]|[12]\d|3[0-3])$/.test(texto))errores.push(`${campo}: elige una entidad válida de dos dígitos.`);
    if(n===41 && !/^[1-6]$/.test(texto))errores.push(`${campo}: opción fuera del catálogo.`);
    if(n===29 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto))errores.push(`${campo}: revisa el correo electrónico.`);
    return {valor:n===29?texto.toLowerCase():texto.toUpperCase(),formato};
  });
  for(const [desde,hasta] of [[45,46],[46,20],[20,21],[21,33],[21,34],[33,30],[34,30]]) {
    const a=celdas[desde-1].valor,b=celdas[hasta-1].valor;
    if(a instanceof Date && b instanceof Date && a>b)errores.push(`La fecha de ${ENCABEZADOS_TITULOS[desde-1]} (columna ${desde}) es posterior a ${ENCABEZADOS_TITULOS[hasta-1]} (columna ${hasta}).`);
  }
  return {celdas,errores};
}

export function validarPlantillaLayout(workbook:ExcelJS.Workbook):ExcelJS.Worksheet {
  const hoja=workbook.getWorksheet('MIS TITULOS');
  if(!hoja)throw new Error('La plantilla de títulos no contiene la hoja MIS TITULOS.');
  ENCABEZADOS_TITULOS.forEach((esperado,i)=>{
    const valor=String(hoja.getRow(2).getCell(i+1).value??'');
    if(valor!==esperado && !(i===23 && valor==='NÚMERO_Acuerdo o RVOE'))throw new Error(`Plantilla de títulos incompatible: revisa el encabezado de la columna ${i+1}.`);
  });
  hoja.getCell('X2').value=ENCABEZADOS_TITULOS[23];
  return hoja;
}
