export interface AnalisisMateriaDGAIR {
  materia: any; // Instancia original de InscripcionAcademica (con asignatura y ciclo)
  id_observacion: number;
  observacion_texto: string;
  requiereRevision: boolean;
  esReingreso: boolean;
  cicloLogico: string;
}

/**
 * Calcula el peso numérico de un ciclo escolar para ordenamiento cronológico fiable.
 * Ej. '2024-1' -> 20241, '2024-2' -> 20242, '2024-3' -> 20243
 */
export const getCicloWeight = (cicloStr?: string | null): number => {
  if (!cicloStr || cicloStr === '-' || cicloStr.toUpperCase() === 'SIN CICLO') return 999999;
  const parts = cicloStr.match(/(\d+)[-/](\d+)/);
  if (parts) {
    let year = parseInt(parts[1], 10);
    if (year < 100) year += 2000;
    const period = parseInt(parts[2], 10);
    return year * 10 + period;
  }
  return 999999;
};

/**
 * Calcula si el ciclo c2 es inmediatamente consecutivo al ciclo c1 en el calendario escolar.
 * Respeta la periodicidad del plan de estudios:
 * - Semestral: 2 periodos/año (1 y 2). Consecutivo de 2023-2 es 2024-1.
 * - Cuatrimestral / Tetramestral: 3 periodos/año (1, 2 y 3). Consecutivo de 2023-3 es 2024-1.
 * - Trimestral: 4 periodos/año.
 * - Bimestral: 6 periodos/año.
 * - Anual: 1 periodo/año.
 */
export function isConsecutiveCycle(c1: string, c2: string, tipoPeriodo: string = 'Semestral'): boolean {
  if (!c1 || !c2 || c1 === '-' || c2 === '-' || c1.toUpperCase() === 'SIN CICLO' || c2.toUpperCase() === 'SIN CICLO') {
    return true; // No podemos evaluar con certeza, no forzar falso positivo
  }

  const p1 = c1.match(/(\d+)[-/](\d+)/);
  const p2 = c2.match(/(\d+)[-/](\d+)/);
  if (!p1 || !p2) return true;

  let y1 = parseInt(p1[1], 10);
  if (y1 < 100) y1 += 2000;
  const per1 = parseInt(p1[2], 10);

  let y2 = parseInt(p2[1], 10);
  if (y2 < 100) y2 += 2000;
  const per2 = parseInt(p2[2], 10);

  if (isNaN(y1) || isNaN(per1) || isNaN(y2) || isNaN(per2)) return true;

  const tNorm = (tipoPeriodo || '').toUpperCase();
  let maxPeriodos = 2; // Por defecto Semestral
  if (tNorm.includes('CUATRI') || tNorm.includes('TETRA')) {
    maxPeriodos = 3;
  } else if (tNorm.includes('TRI')) {
    maxPeriodos = 4;
  } else if (tNorm.includes('BI')) {
    maxPeriodos = 6;
  } else if (tNorm.includes('ANUAL')) {
    maxPeriodos = 1;
  }

  // 1. Mismo año: Debe ser el periodo numérico inmediato consecutivo
  if (y1 === y2) {
    return (per2 - per1) === 1;
  }
  
  // 2. Salto al año siguiente inmediato: Debe pasar del último periodo del año al periodo 1 del año nuevo
  if (y2 === y1 + 1) {
    return (per1 >= maxPeriodos && per2 === 1);
  }

  return false;
}

/**
 * Detecta los ciclos escolares donde hubo una interrupción temporal de matrícula (salto temporal),
 * lo que normativamente ante DGAIR/SEP genera el estatus de REINGRESO (ID 75).
 */
export function detectarCiclosReingreso(
  ciclosReales: string[],
  tipoPeriodo: string = 'Semestral'
): Set<string> {
  const ciclosReingreso = new Set<string>();
  if (!ciclosReales || ciclosReales.length <= 1) return ciclosReingreso;

  // Filtrar ciclos válidos y eliminar duplicados
  const unicosValidos = Array.from(new Set(
    ciclosReales
      .map(c => (c || '').trim())
      .filter(c => c && c !== '-' && c.toUpperCase() !== 'SIN CICLO')
  ));

  // Ordenar cronológicamente usando el peso del ciclo
  unicosValidos.sort((a, b) => getCicloWeight(a) - getCicloWeight(b));

  // Evaluar continuidad entre ciclos consecutivos cursados
  for (let i = 1; i < unicosValidos.length; i++) {
    const cPrev = unicosValidos[i - 1];
    const cCurr = unicosValidos[i];

    if (!isConsecutiveCycle(cPrev, cCurr, tipoPeriodo)) {
      // Hubo una interrupción temporal de matrícula entre cPrev y cCurr
      ciclosReingreso.add(cCurr);
    }
  }

  return ciclosReingreso;
}

/**
 * Analiza las inscripciones aprobadas para la certificación DGAIR, respetando:
 * 1. La norma oficial SEP: El REINGRESO (75) solo aplica ante saltos temporales en el calendario de matrícula.
 * 2. Modelo RÍGIDO (ej. Derecho 2017): Agrupado y ordenado por bloque reticular (1, 2, 3...) y clave_legado.
 * 3. Modelo FLEXIBLE REGULAR: Bloques ordenados cronológicamente según el ciclo en que fueron cursados.
 * 4. Modelo ESPECIALIDAD FLEXIBLE: Agrupado directamente por ciclo y materias ordenadas alfabéticamente.
 */
export function analizarObservacionesDGAIR(
  inscripcionesAprobadas: any[],
  planEstudio?: any
): AnalisisMateriaDGAIR[] {
  if (!inscripcionesAprobadas || inscripcionesAprobadas.length === 0) {
    return [];
  }

  // 1. Resolver metadatos del plan de estudios
  const planRef = planEstudio || inscripcionesAprobadas[0]?.asignatura?.planes_estudio;
  const modelo = (planRef?.modelo || 'RIGIDO').toUpperCase();
  const tipoPeriodo = planRef?.tipo_periodo || 'Semestral';
  const nivelEducativo = (
    planRef?.carrera?.nivel_educativo ||
    planRef?.carreras?.nivel_educativo ||
    planRef?.nivel_educativo ||
    ''
  ).toLowerCase();
  const esEspecialidadFlexible = nivelEducativo.includes('especialidad') && modelo === 'FLEXIBLE';

  // 2. Extraer ciclos reales del alumno y detectar legítimos ciclos de reingreso (saltos temporales en el calendario)
  const todosLosCiclosReales = inscripcionesAprobadas
    .map(m => m.ciclo?.nombre)
    .filter(Boolean);
  const ciclosReingreso = detectarCiclosReingreso(todosLosCiclosReales, tipoPeriodo);

  // ── RAMA 1: ESPECIALIDAD FLEXIBLE ──────────────────────────────────────────
  if (esEspecialidadFlexible) {
    // Agrupar directamente por Ciclo Escolar Cursado
    const ciclosMap: Record<string, any[]> = {};
    for (const mat of inscripcionesAprobadas) {
      const cicloNombre = mat.ciclo?.nombre || 'SIN CICLO';
      if (!ciclosMap[cicloNombre]) ciclosMap[cicloNombre] = [];
      ciclosMap[cicloNombre].push(mat);
    }

    const nombresCiclos = Object.keys(ciclosMap).sort((a, b) => getCicloWeight(a) - getCicloWeight(b));
    const resultadoEspecialidad: AnalisisMateriaDGAIR[] = [];

    nombresCiclos.forEach(nombreCiclo => {
      const materiasDelCiclo = ciclosMap[nombreCiclo];
      // Ordenamiento alfabético interno obligatorio para Especialidad Flexible
      materiasDelCiclo.sort((a, b) => {
        const nameA = a.asignatura?.nombre || '';
        const nameB = b.asignatura?.nombre || '';
        return nameA.localeCompare(nameB);
      });

      const esCicloDeReingreso = ciclosReingreso.has(nombreCiclo);

      materiasDelCiclo.forEach(materia => {
        const tipoEval = (materia.tipo_evaluacion || '').toUpperCase();
        const esExtra = tipoEval.includes('EXTRAORDINARIO');

        let id_observacion = 100;
        let observacion_texto = 'ORDINARIO';
        let requiereRevision = false;

        if (esExtra && materia.calificacion_final) {
          id_observacion = 71;
          observacion_texto = 'EXAMEN EXTRAORDINARIO';
        } else if (esCicloDeReingreso) {
          id_observacion = 75;
          observacion_texto = 'REINGRESO';
        }

        resultadoEspecialidad.push({
          materia,
          id_observacion,
          observacion_texto,
          requiereRevision,
          esReingreso: esCicloDeReingreso,
          cicloLogico: nombreCiclo
        });
      });
    });

    return resultadoEspecialidad;
  }

  // ── RAMA 2: PLANES POR BLOQUES (RÍGIDOS Y FLEXIBLES REGULARES) ────────────
  // Agrupar por bloque curricular (numero_periodo)
  const bloquesMap: Record<number, any[]> = {};
  for (const mat of inscripcionesAprobadas) {
    const periodo = mat.asignatura?.numero_periodo || 0;
    if (!bloquesMap[periodo]) bloquesMap[periodo] = [];
    bloquesMap[periodo].push(mat);
  }

  // Calcular el ciclo lógico de cada bloque (la Moda de ciclos dentro del bloque)
  const bloqueCicloLogico: Record<number, string> = {};
  const numerosBloqueOriginales = Object.keys(bloquesMap).map(Number);

  numerosBloqueOriginales.forEach(numBloque => {
    const materias = bloquesMap[numBloque];
    const frecuencias: Record<string, number> = {};
    let maxFreq = 0;
    let moda = '';

    materias.forEach(m => {
      const ciclo = m.ciclo?.nombre || 'SIN CICLO';
      frecuencias[ciclo] = (frecuencias[ciclo] || 0) + 1;
      if (frecuencias[ciclo] > maxFreq) {
        maxFreq = frecuencias[ciclo];
        moda = ciclo;
      }
    });

    bloqueCicloLogico[numBloque] = moda;
  });

  // Ordenar los bloques según el Modelo del Plan:
  let numerosBloqueOrdenados: number[];
  if (modelo === 'FLEXIBLE') {
    // PLAN FLEXIBLE: Orden cronológico por ciclo cursado (del más antiguo al más reciente)
    numerosBloqueOrdenados = numerosBloqueOriginales.sort((a, b) => {
      const wA = getCicloWeight(bloqueCicloLogico[a]);
      const wB = getCicloWeight(bloqueCicloLogico[b]);
      if (wA !== wB) return wA - wB;
      return a - b;
    });
  } else {
    // PLAN RÍGIDO (Ej. Derecho 2017): Orden numérico reticular estricto (Bloque 1, 2, 3, 4, 5, 6, 7...)
    numerosBloqueOrdenados = numerosBloqueOriginales.sort((a, b) => a - b);
  }

  // Asignación final y ordenamiento interno por clave_legado
  const resultadoFinal: AnalisisMateriaDGAIR[] = [];

  numerosBloqueOrdenados.forEach(numBloque => {
    const materiasDelBloque = bloquesMap[numBloque];

    // Ordenar materias dentro del bloque por clave_legado (ascendente con orden numérico natural)
    materiasDelBloque.sort((a, b) => {
      const claveA = a.asignatura?.clave_legado || '';
      const claveB = b.asignatura?.clave_legado || '';
      return claveA.localeCompare(claveB, undefined, { numeric: true, sensitivity: 'base' });
    });

    materiasDelBloque.forEach(materia => {
      const periodo = numBloque;
      const cicloLogico = bloqueCicloLogico[periodo];
      const cicloMateria = materia.ciclo?.nombre || 'SIN CICLO';
      const esCicloReingreso = ciclosReingreso.has(cicloMateria);

      let id_observacion = 100;
      let observacion_texto = 'ORDINARIO';
      let requiereRevision = false;

      const tipoEval = (materia.tipo_evaluacion || '').toUpperCase();
      const esExtra = tipoEval.includes('EXTRAORDINARIO');

      if (esExtra && materia.calificacion_final) {
        id_observacion = 71;
        observacion_texto = 'EXAMEN EXTRAORDINARIO';
      } else if (esCicloReingreso) {
        // Interrupción temporal de estudios oficial detectada
        id_observacion = 75;
        observacion_texto = 'REINGRESO';
      } else if (cicloMateria === cicloLogico) {
        id_observacion = 100;
        observacion_texto = 'ORDINARIO';
      } else {
        // Materia cursada en ciclo distinto a la moda del bloque (ej. arrastre/irregular)
        // En DGAIR se marca 71 como sugerencia para revisión del operador escolar
        id_observacion = 71;
        observacion_texto = 'EXAMEN EXTRAORDINARIO';
        requiereRevision = true;
      }

      resultadoFinal.push({
        materia,
        id_observacion,
        observacion_texto,
        requiereRevision,
        esReingreso: esCicloReingreso,
        cicloLogico
      });
    });
  });

  return resultadoFinal;
}
