export type AsignaturaImportada = {
  clave_legado: string;
  nombre: string;
  creditos: number;
  horas_semanales?: number;
  clasificacion_clave: '263' | '264' | '266';
  clasificacion_nombre: 'Obligatoria' | 'Optativa' | 'Complementaria';
  numero_periodo: number;
  etapa_clave: string;
  etapa_nombre: string;
  clave_certificacion: number | null;
  activo: true;
};

export type FilaAsignatura = {
  numero: number;
  clave: string;
  nombre: string;
  periodo: string;
  creditos: string;
  clasificacion: string;
  claveCertificacion: string;
  errores: string[];
  asignatura: AsignaturaImportada | null;
};

const encabezados = ['clave', 'nombre', 'creditos', 'clasificacion', 'periodo'] as const;
type Encabezado = typeof encabezados[number];
type EncabezadoOpcional = 'etapa_clave' | 'etapa_nombre' | 'clave_certificacion' | 'horas_semanales';

const normalizar = (valor: string) => valor.trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');

const alias: Record<string, Encabezado | EncabezadoOpcional> = {
  clave: 'clave', clave_legado: 'clave', clave_asignatura: 'clave',
  nombre: 'nombre', asignatura: 'nombre', nombre_asignatura: 'nombre',
  creditos: 'creditos', credito: 'creditos',
  horas_semanales: 'horas_semanales', horas_semana: 'horas_semanales', horas_de_clase: 'horas_semanales',
  clasificacion: 'clasificacion', clasificacion_nombre: 'clasificacion', clasificacion_clave: 'clasificacion',
  periodo: 'periodo', numero_periodo: 'periodo', bloque: 'periodo', bloque_periodo: 'periodo',
  etapa_clave: 'etapa_clave', etapa_nombre: 'etapa_nombre',
  clave_certificacion: 'clave_certificacion', id_asignatura_certificacion: 'clave_certificacion',
};

const texto = (valor: unknown) => valor === null || valor === undefined ? '' : String(valor).trim();

function separadorCSV(textoCSV: string): string {
  const cantidades: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let entreComillas = false;
  for (let i = 0; i < textoCSV.length; i++) {
    const caracter = textoCSV[i];
    if (caracter === '"') {
      if (entreComillas && textoCSV[i + 1] === '"') i++;
      else entreComillas = !entreComillas;
    } else if (!entreComillas && (caracter === '\r' || caracter === '\n')) break;
    else if (!entreComillas && caracter in cantidades) cantidades[caracter]++;
  }
  return [',', ';', '\t'].sort((a, b) => cantidades[b] - cantidades[a])[0];
}

export function leerCSV(textoCSV: string): string[][] {
  const contenido = textoCSV.replace(/^\uFEFF/, '');
  const separador = separadorCSV(contenido);
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < contenido.length; i++) {
    const caracter = contenido[i];
    if (caracter === '"') {
      if (entreComillas && contenido[i + 1] === '"') { celda += '"'; i++; }
      else entreComillas = !entreComillas;
    } else if (caracter === separador && !entreComillas) {
      fila.push(celda); celda = '';
    } else if ((caracter === '\r' || caracter === '\n') && !entreComillas) {
      if (caracter === '\r' && contenido[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += caracter;
  }
  if (entreComillas) throw new Error('El CSV contiene comillas sin cerrar.');
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.map(f => f.map(texto)).filter(f => f.some(Boolean));
}

export async function leerArchivoAsignaturas(archivo: File): Promise<string[][]> {
  const extension = archivo.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return leerCSV(await archivo.text());
  if (extension !== 'xlsx') throw new Error('Selecciona un archivo CSV o XLSX.');
  const XLSX = await import('xlsx');
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw new Error('El XLSX no contiene hojas.');
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: false, defval: '' });
  return filas.map(f => f.map(texto)).filter(f => f.some(Boolean));
}

export function prepararAsignaturas(filas: string[][]): FilaAsignatura[] {
  if (filas.length < 2) throw new Error('El archivo debe incluir encabezados y al menos una asignatura.');
  const indices = new Map<Encabezado | EncabezadoOpcional, number>();
  filas[0].forEach((columna, indice) => {
    const encabezado = alias[normalizar(columna)];
    if (encabezado && !indices.has(encabezado)) indices.set(encabezado, indice);
  });
  const faltantes = encabezados.filter(encabezado => !indices.has(encabezado));
  if (faltantes.length) throw new Error(`Faltan columnas: ${faltantes.join(', ')}.`);
  const claves = new Set<string>();
  return filas.slice(1).map((fila, indice) => {
    const obtener = (columna: Encabezado | EncabezadoOpcional) => {
      const indiceColumna = indices.get(columna);
      return indiceColumna === undefined ? '' : texto(fila[indiceColumna]);
    };
    const clave = obtener('clave');
    const nombre = obtener('nombre');
    const creditos = obtener('creditos');
    const clasificacion = obtener('clasificacion');
    const periodo = obtener('periodo');
    const claveCertificacion = obtener('clave_certificacion');
    const horasSemanales = obtener('horas_semanales');
    const errores: string[] = [];
    if (!clave) errores.push('Falta la clave');
    if (!nombre) errores.push('Falta el nombre');
    if (clave && claves.has(clave.toLocaleUpperCase('es-MX'))) errores.push('Clave repetida en el archivo');
    const numeroCreditos = Number(creditos.replace(',', '.'));
    if (!creditos || !Number.isFinite(numeroCreditos) || numeroCreditos < 0) errores.push('Créditos inválidos');
    const numeroPeriodo = Number(periodo);
    if (!periodo || !Number.isSafeInteger(numeroPeriodo) || numeroPeriodo < 1) errores.push('Periodo inválido');
    const numeroCertificacion = Number(claveCertificacion);
    const numeroHoras = Number(horasSemanales);
    if (horasSemanales && (!Number.isSafeInteger(numeroHoras) || numeroHoras < 1 || numeroHoras > 40)) errores.push('Horas semanales inválidas');
    if (claveCertificacion && (!Number.isSafeInteger(numeroCertificacion) || numeroCertificacion < 0)) errores.push('Clave de certificación inválida');
    const clasificaciones: Record<string, ['263' | '264' | '266', 'Obligatoria' | 'Optativa' | 'Complementaria']> = {
      '263': ['263', 'Obligatoria'], obligatoria: ['263', 'Obligatoria'],
      '264': ['264', 'Optativa'], optativa: ['264', 'Optativa'],
      '266': ['266', 'Complementaria'], complementaria: ['266', 'Complementaria'],
    };
    const tipo = clasificaciones[normalizar(clasificacion)];
    if (!tipo) errores.push('Clasificación inválida');
    if (clave && !errores.length) claves.add(clave.toLocaleUpperCase('es-MX'));
    return {
      numero: indice + 2, clave, nombre, periodo, creditos, clasificacion, claveCertificacion, errores,
      asignatura: errores.length ? null : {
        clave_legado: clave, nombre, creditos: numeroCreditos,
        clasificacion_clave: tipo[0], clasificacion_nombre: tipo[1],
        numero_periodo: numeroPeriodo, etapa_clave: obtener('etapa_clave') || String(numeroPeriodo),
        etapa_nombre: obtener('etapa_nombre') || `Bloque ${numeroPeriodo}`,
        clave_certificacion: claveCertificacion ? numeroCertificacion : null, activo: true,
        ...(horasSemanales ? { horas_semanales: numeroHoras } : {}),
      },
    };
  });
}

export const plantillaAsignaturasCSV = '\uFEFFclave,nombre,creditos,clasificacion,periodo,horas_semanales,etapa_clave,etapa_nombre,clave_certificacion\r\n';
