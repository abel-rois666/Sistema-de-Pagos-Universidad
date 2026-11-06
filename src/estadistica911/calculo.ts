import type { Config911, Expediente911, Instancia911, Persona911, Respaldo911, Resultado911, Fuente911 } from './types';
import { erroresCorte911 } from './corte';
import { erroresOferta911,instanciaAplica911,conflictoPertinencia911 } from './guia';
export function fechaValida911(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
}
export function edad911(nacimiento: string | null, referencia: string): number | null {
  if (!nacimiento || !fechaValida911(nacimiento) || !fechaValida911(referencia) || nacimiento > referencia) return null;
  const edad = Number(referencia.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (referencia.slice(5) < nacimiento.slice(5) ? 1 : 0);
  return edad <= 120 ? edad : null;
}
export function avance911(grado: string, periodosPorAnio?: number): number | null {
  const n = String(grado).trim().match(/^(\d+)(?:ER|RO|DO|TO|VO|MO|NO|º|°)?$/i);
  if (!n || !periodosPorAnio || Number(n[1]) < 1) return null;
  return Math.ceil(Number(n[1]) / periodosPorAnio);
}
export function avanceOficial911(p: Persona911, i: Instancia911): number | null {
  if (p.avance !== undefined) return Number.isInteger(p.avance) && p.avance >= 1 && p.avance <= 6 ? p.avance : null;
  const esperado: Record<string, number> = {
    '1': 1,
    '2': 2,
    '3': 4,
    '4': 6,
    '5': 3
  };
  const periodos = esperado[i.identidad.CV_DURACION];
  // Créditos, flexible u otras estructuras requieren equivalencia anual acreditada en la fuente.
  if (!periodos || i.correspondencia.periodosPorAnio !== periodos) return null;
  return avance911(p.grado, periodos);
}
export function deduplicar911(personas: Persona911[]): Persona911[] {
  const mapa = new Map<string, Persona911>();
  for (const p of personas) {
    const key = `${p.alumno_id}:${p.programa_id}:${p.evento || ''}`;
    const vieja = mapa.get(key);
    if (!vieja || p.desde > vieja.desde) mapa.set(key, p);
  }
  return [...mapa.values()];
}
export function poblacion911(i: Instancia911, config: Config911, personas: Persona911[], poblacion: string) {
  const incidencias: string[] = [];
  const excluidos: {
    id: string;
    motivo: string;
  }[] = [];
  if (!i.correspondencia.confirmada || !i.correspondencia.planes.length) incidencias.push('Correspondencia oficial sin confirmar');
  if (!config.coberturas?.[`${i.id}:${poblacion}`]?.trim()) incidencias.push(`Cobertura histórica ${poblacion} sin acreditar`);
  const prev = poblacion !== 'matricula' && poblacion !== 'primerIngreso';
  if (!fechaValida911(config.corte)) incidencias.push('Fecha de corte inválida');
  if (prev && (!fechaValida911(config.anteriorInicio) || !fechaValida911(config.anteriorFin) || config.anteriorInicio > config.anteriorFin)) incidencias.push('Referencia histórica sin confirmar');
  if (!['egresados', 'titulados'].includes(poblacion) && !(prev ? config.ciclosAnteriores : config.ciclosMatricula).length) incidencias.push('Selecciona los ciclos exactos de referencia');
  const candidatos = personas.filter(p => i.correspondencia.planes.includes(p.plan_id));
  const incluidos: Persona911[] = [];
  for (const registro of candidatos) {
    let motivo = '';
    const {
      caracteristicas,
      ...p
    } = registro;
    const evento = poblacion === 'egresados' || poblacion === 'titulados';
    const relevante = evento ? p.evento === (poblacion === 'egresados' ? 'EGRESO' : 'TITULACION') && Boolean(p.fecha_evento) && p.fecha_evento! >= config.anteriorInicio && p.fecha_evento! <= config.anteriorFin : !p.evento && (prev ? config.ciclosAnteriores : config.ciclosMatricula).includes(p.ciclo_id) && p.desde <= (prev ? config.anteriorFin : config.corte) && (!p.hasta || p.hasta >= (prev ? config.anteriorInicio : config.corte));
    if (!relevante) {
      excluidos.push({
        id: p.id,
        motivo: 'Otra población, ciclo o fecha fuera de la referencia'
      });
      continue;
    }
    if (!p.confirmado) {
      incidencias.push('Existen inscripciones/eventos sin confirmar');
      motivo = 'Registro no confirmado';
    } else if (poblacion === 'egresados' || poblacion === 'titulados') {
      if (p.evento !== (poblacion === 'egresados' ? 'EGRESO' : 'TITULACION')) motivo = 'Otro tipo de evento';else if (!p.fecha_evento || p.fecha_evento < config.anteriorInicio || p.fecha_evento > config.anteriorFin) motivo = 'Evento fuera del periodo de resultados';
    } else {
      const ciclos = prev ? config.ciclosAnteriores : config.ciclosMatricula;
      if (!ciclos.length) incidencias.push('Selecciona los ciclos exactos de referencia');
      if (p.evento) motivo = 'Evento, no inscripción';else if (!ciclos.includes(p.ciclo_id)) motivo = 'Ciclo fuera de la población';else if (prev && (p.desde > config.anteriorFin || p.hasta && p.hasta < config.anteriorInicio)) motivo = 'Fuera del periodo anterior';else if (!prev && (p.desde > config.corte || p.hasta && p.hasta < config.corte)) motivo = 'Inscripción no vigente al corte';else if (!['ACTIVO', 'CURSANDO'].includes(p.situacion)) motivo = 'Situación académica no cursable al corte';else if (poblacion === 'primerIngreso' || poblacion === 'primerIngresoAnterior') {
        if (p.tipo_ingreso === 'DESCONOCIDO') incidencias.push('Tipo de ingreso pendiente');
        if (p.tipo_ingreso !== 'PRIMER_INGRESO') motivo = 'Reingreso o ingreso no acreditado';else if (!p.fecha_primer_ingreso) {
          motivo = 'Falta fecha de primer ingreso al programa';
          incidencias.push(motivo);
        } else if (!fechaValida911(prev ? config.anteriorInicio : config.actualInicio)) {
          motivo = 'Falta inicio del periodo de ingreso';
          incidencias.push(motivo);
        } else if (p.fecha_primer_ingreso < (prev ? config.anteriorInicio : config.actualInicio) || p.fecha_primer_ingreso > (prev ? config.anteriorFin : config.corte)) motivo = 'Primer ingreso fuera de la referencia';
      }
    }
    if (motivo) excluidos.push({
      id: p.id,
      motivo
    });else {
      const referencia = evento ? p.fecha_evento! : prev ? config.anteriorFin : config.corte;
      if (caracteristicas) {
        const vigentes = caracteristicas.filter(c => c.desde <= referencia && (!c.hasta || c.hasta >= referencia));
        const d = vigentes.length === 1 ? vigentes[0].datos : {};
        p.discapacidad = typeof d.discapacidad === 'boolean' ? d.discapacidad : null;
        p.indigena = typeof d.indigena === 'boolean' ? d.indigena : null;
        p.pais_nacimiento = String(d.pais_nacimiento || '');
        p.entidad_residencia = String(d.entidad_residencia || '');
        p.entidad_nacimiento = String(d.entidad_nacimiento || '');
      }
      incluidos.push({
        ...p,
        edad: edad911(p.nacimiento, evento || prev ? referencia : config.edadReferencia),
        avance: avanceOficial911(p, i) ?? undefined,
        motivo: `Incluido en ${poblacion}, inscripción/evento confirmado; referencia ${referencia}`
      });
    }
  }
  return {
    incluidos: deduplicar911(incluidos),
    excluidos,
    incidencias: [...new Set(incidencias)]
  };
}
export function calcular911(exp: Expediente911, personas: Persona911[], fuentes?: Record<string, Fuente911>): Resultado911 {
  const instancias = structuredClone(exp.instancias);
  const respaldos: Respaldo911[] = [];
  const incidencias: string[] = [];
  const asociaciones = new Map<string, Set<string>>();
  for (const i of instancias.filter(i => instanciaAplica911(i)&&['carrera', 'posgrado'].includes(i.cuestionario))) for (const plan of i.correspondencia.planes) {
    const ids = asociaciones.get(plan) || new Set<string>();
    ids.add(i.id);
    asociaciones.set(plan, ids);
  }
  for (const i of instancias) {
    if (!instanciaAplica911(i)||!['carrera', 'posgrado'].includes(i.cuestionario)) continue;
    const conflicto = i.correspondencia.planes.some(p => (asociaciones.get(p)?.size || 0) > 1);
    // Un recálculo invalida solamente cifras automáticas anteriores; preserva ajustes justificados.
    for (const r of Object.values(i.respuestas)) if (r.origen.startsWith('Población:')) r.calculado = null;
    const esCarrera = i.cuestionario === 'carrera';
    function contar(codigo: string, poblacion: string, filtro: (p: Persona911) => boolean, requerido?: (p: Persona911) => boolean) {
      const p = poblacion911(i, exp.config, personas, poblacion);
      const faltante = requerido && p.incluidos.some(x => !requerido(x));
      if (conflicto) p.incidencias.push('Un plan interno está asociado a más de una instancia oficial');
      if (faltante) p.incidencias.push(`${codigo}: faltan características individuales`);
      const incluidos = p.incluidos.filter(filtro).map(x => ({
        ...x,
        variables: [codigo]
      }));
      const completa = p.incidencias.length === 0;
      const calculado = completa ? incluidos.length : null;
      const previa = exp.instancias.find(x => x.id === i.id)?.respuestas[codigo];
      i.respuestas[codigo] = {
        ...i.respuestas[codigo],
        calculado,
        revisada: previa?.calculado === calculado ? previa?.revisada : false,
        origen: `Población: ${poblacion}`,
        poblacion
      };
      respaldos.push({
        instancia: i.id,
        variable: codigo,
        poblacion,
        incluidos,
        excluidos: p.excluidos,
        completa,
        incidencias: p.incidencias
      });
      incidencias.push(...p.incidencias.map(x => `${i.id}: ${x}`));
    }
    function bloque(inicio: number, poblacion: string, soloGrado?: number, extranjero = false) {
      const base = (p: Persona911) => soloGrado === undefined || p.avance === soloGrado;
      const gradoOk = (p: Persona911) => soloGrado === undefined || p.avance !== undefined;
      contar(`V${inicio}`, poblacion, p => base(p) && p.sexo === 'H', p => gradoOk(p) && ['H', 'M'].includes(p.sexo));
      contar(`V${inicio + 1}`, poblacion, p => base(p) && p.sexo === 'M', p => gradoOk(p) && ['H', 'M'].includes(p.sexo));
      contar(`V${inicio + 2}`, poblacion, base, gradoOk);
      contar(`V${inicio + 3}`, poblacion, p => base(p) && p.discapacidad === true, p => gradoOk(p) && p.discapacidad !== null && p.discapacidad !== undefined);
      if (extranjero) contar(`V${inicio + 4}`, poblacion, p => base(p) && Boolean(p.pais_nacimiento) && p.pais_nacimiento !== 'MX', p => gradoOk(p) && Boolean(p.pais_nacimiento));
      contar(`V${inicio + (extranjero ? 5 : 4)}`, poblacion, p => base(p) && p.indigena === true, p => gradoOk(p) && p.indigena !== null && p.indigena !== undefined);
    }
    const prev = esCarrera ? 18 : 22;
    contar(`V${prev}`, 'primerIngresoAnterior', p => p.sexo === 'H', p => ['H', 'M'].includes(p.sexo));
    contar(`V${prev + 1}`, 'primerIngresoAnterior', p => p.sexo === 'M', p => ['H', 'M'].includes(p.sexo));
    contar(`V${prev + 2}`, 'primerIngresoAnterior', () => true);
    bloque(esCarrera ? 21 : 25, 'egresados');
    bloque(esCarrera ? 26 : 30, 'titulados');
    if (esCarrera) bloque(88, 'primerIngreso');else bloque(47, 'primerIngreso');
    for (let grado = 1; grado <= (esCarrera ? 6 : 5); grado++) bloque((esCarrera ? 139 : 110) + (grado - 1) * 6, 'matricula', grado, true);
    bloque(esCarrera ? 175 : 140, 'matricula', undefined, true);
    // Desgloses por edad del diccionario, únicamente cuando la definición es inequívoca.
    if (esCarrera && fuentes?.carrera) for (const c of fuentes.carrera.campos) {
      const s = c.descripcion.toUpperCase();
      if (!s.startsWith('ALUMNOS DE ') || !s.includes('AÑOS') || !/(HOMBRES|MUJERES)$/.test(s)) continue;
      const grado = s.includes('PRIMER GRADO') ? 1 : s.includes('SEGUNDO') ? 2 : s.includes('TERCERO') ? 3 : s.includes('CUARTO') ? 4 : s.includes('QUINTO') ? 5 : s.includes('SEXTO') ? 6 : null;
      if (!grado) continue;
      let min = 0,
        max = 120;
      const rango = s.match(/DE (\d+) A (\d+) AÑOS/),
        exacta = s.match(/DE (\d+) AÑOS/),
        menor = s.match(/MENOS DE (\d+) AÑOS/),
        mayor = s.match(/(\d+) AÑOS Y M[ÁA]S/);
      if (rango) {
        min = Number(rango[1]);
        max = Number(rango[2]);
      } else if (menor) max = Number(menor[1]) - 1;else if (mayor) min = Number(mayor[1]);else if (exacta) min = max = Number(exacta[1]);else continue;
      const sexo = s.endsWith('HOMBRES') ? 'H' : 'M';
      const primer = s.includes('PRIMERO INGRESO');
      const reingreso = s.includes('REINGRESO');
      contar(c.codigo, 'matricula', p => p.avance === grado && p.sexo === sexo && p.edad !== null && p.edad! >= min && p.edad! <= max && (!primer || p.tipo_ingreso === 'PRIMER_INGRESO') && (!reingreso || p.tipo_ingreso === 'REINGRESO'), p => p.edad !== null && p.avance !== undefined && ['H', 'M'].includes(p.sexo) && (!(primer || reingreso) || p.tipo_ingreso !== 'DESCONOCIDO'));
    }
    if (esCarrera) for (let entidad = 1; entidad <= 32; entidad++) contar(`V${461 + entidad}`, 'matricula', p => p.entidad_residencia === String(entidad).padStart(2, '0'), p => Boolean(p.entidad_residencia));
  }
  return {
    instancias,
    respaldos,
    incidencias: [...new Set(incidencias)]
  };
}
export function validarCampo911(valor: string | number | null, tipo: string): string | null {
  if (valor === null) return null;
  if (/[|\r\n]/.test(String(valor))) return 'No se admiten separadores | ni saltos de línea en respuestas TXT';
  if (/INT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL/.test(tipo)) {
    if (String(valor).trim() === '' || !Number.isFinite(Number(valor)) || Number(valor) < 0) return 'Se requiere un número no negativo';
    if (/INT/.test(tipo) && !Number.isInteger(Number(valor))) return 'Se requiere un entero';
    if (tipo === 'SMALLINT' && Number(valor) > 32767) return 'Supera el límite SMALLINT';
  }
  const n = tipo.match(/(?:VAR)?CHAR\((\d+)\)/);
  if (n && String(valor).length > Number(n[1])) return `Máximo ${n[1]} caracteres`;
  return null;
}
// FIN describe también resultados históricos incluidos en estos PDF de inicio; no es motivo de exclusión.
export function camposInicio911(fuente: Fuente911) {
  return fuente.campos;
}
export function diagnosticoCierre911(exp: Expediente911, fuentes: Record<string, Fuente911>): string[] {
  const errores: string[] = [];
  errores.push(...erroresOferta911(exp));
  const vistos = new Set<string>();
  for (const i of exp.instancias.filter(i => instanciaAplica911(i)&&['carrera', 'posgrado'].includes(i.cuestionario))) for (const p of i.correspondencia.planes) {
    if (vistos.has(p)) errores.push('Plan interno con más de una correspondencia oficial: ' + p);
    vistos.add(p);
  }
  if (!fechaValida911(exp.config.corte) || !fechaValida911(exp.config.edadReferencia)) errores.push('Confirma fecha de corte y referencia de edad');
  errores.push(...erroresCorte911(exp));
  if (exp.config.fiscal !== 2025) errores.push('El formato de la edición conserva el ejercicio fiscal 2025');
  if (!fechaValida911(exp.config.actualInicio) || exp.config.actualInicio > exp.config.corte) errores.push('Inicio del periodo actual sin confirmar o posterior al corte');
  if (!fechaValida911(exp.config.anteriorInicio) || !fechaValida911(exp.config.anteriorFin) || exp.config.anteriorInicio > exp.config.anteriorFin) errores.push('Periodo anterior inválido');
  if (!exp.config.controlConfirmado) errores.push('Confirma los datos protegidos oficiales, incluido CV_CONTROL');
  if (!exp.config.responsable.trim()) errores.push('Falta responsable');
  for (const i of exp.instancias) {
    if(!instanciaAplica911(i))continue;
    if (['carrera', 'posgrado'].includes(i.cuestionario) && !i.correspondencia.confirmada) errores.push(`${i.id}: correspondencia sin confirmar`);
    const fs = fuentes[i.cuestionario];
    if (!fs) {
      errores.push(`Falta definición ${i.cuestionario}`);
      continue;
    }
    for (const c of camposInicio911(fs).filter(c => /^[VE]\d+$/.test(c.codigo))) {
      if(conflictoPertinencia911(exp,i,c.codigo))errores.push(`${i.id}/${c.codigo}: la declaración contradice la oferta confirmada`);
      const r = i.respuestas[c.codigo];
      const v = r?.declarado !== undefined ? r.declarado : r?.calculado;
      if (v === null || v === undefined) errores.push(`${i.id}/${c.codigo}: respuesta pendiente`);else if (!r?.revisada) errores.push(`${i.id}/${c.codigo}: falta revisión`);
      if (r?.declarado !== undefined && (!r.justificacion?.trim() || !r.evidencia?.trim())) errores.push(`${i.id}/${c.codigo}: ajuste sin justificación/evidencia`);
      const e = validarCampo911(v ?? null, c.tipo);
      if (e) errores.push(`${i.id}/${c.codigo}: ${e}`);
    }
    if (!exp.revisiones[i.cuestionario]?.trim()) errores.push(`${i.cuestionario}: falta revisión de sección`);
  }
  return [...new Set(errores)];
}
