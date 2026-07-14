export interface AnalisisMateriaDGAIR {
  materia: any; // Instancia original de InscripcionAcademica (con asignatura y ciclo)
  id_observacion: number;
  observacion_texto: string;
  requiereRevision: boolean;
  esReingreso: boolean;
  cicloLogico: string;
}

/**
 * Calcula si el ciclo c2 es inmediatamente consecutivo al ciclo c1.
 * Asume formatos como '2023-1', '2023-2', '2023-3', etc.
 */
export function isConsecutiveCycle(c1: string, c2: string): boolean {
  if (!c1 || !c2) return true; // No podemos evaluar
  const p1 = c1.split('-');
  const p2 = c2.split('-');
  if (p1.length !== 2 || p2.length !== 2) return true; 
  
  const y1 = parseInt(p1[0], 10), per1 = parseInt(p1[1], 10);
  const y2 = parseInt(p2[0], 10), per2 = parseInt(p2[1], 10);
  
  if (isNaN(y1) || isNaN(per1) || isNaN(y2) || isNaN(per2)) return true;

  if (y1 === y2) {
    return (per2 - per1) === 1;
  } else if (y2 === y1 + 1) {
    // Si salta de año, asumimos que debe saltar de 2 a 1 (Semestral) o de 3 a 1 (Cuatrimestral)
    return (per1 >= 2 && per2 === 1);
  }
  return false;
}

export function analizarObservacionesDGAIR(inscripcionesAprobadas: any[]): AnalisisMateriaDGAIR[] {
  // 1. Agrupar por bloque (numero_periodo)
  const bloquesMap: Record<number, any[]> = {};
  for (const mat of inscripcionesAprobadas) {
    const periodo = mat.asignatura?.numero_periodo || 0;
    if (!bloquesMap[periodo]) bloquesMap[periodo] = [];
    bloquesMap[periodo].push(mat);
  }

  // 2. Analizar ciclos por bloque (El ciclo más antiguo)
  const bloqueCicloLogico: Record<number, string> = {};
  const numerosBloqueOriginales = Object.keys(bloquesMap).map(Number);
  
  numerosBloqueOriginales.forEach((numBloque) => {
    const materias = bloquesMap[numBloque];
    let cicloMasAntiguo = '';
    
    materias.forEach(m => {
      const ciclo = m.ciclo?.nombre || 'SIN CICLO';
      if (ciclo !== 'SIN CICLO') {
        if (!cicloMasAntiguo || ciclo.localeCompare(cicloMasAntiguo) < 0) {
          cicloMasAntiguo = ciclo;
        }
      }
    });
    
    bloqueCicloLogico[numBloque] = cicloMasAntiguo || 'SIN CICLO';
  });

  // 3. Ordenar bloques por ciclo (del más antiguo al más reciente)
  const numerosBloque = numerosBloqueOriginales.sort((a, b) => {
    const cicloA = bloqueCicloLogico[a] || '';
    const cicloB = bloqueCicloLogico[b] || '';
    return cicloA.localeCompare(cicloB);
  });

  // 4. Detectar saltos de ciclo entre bloques consecutivos (usando el nuevo orden cronológico)
  const bloqueReingreso: Record<number, boolean> = {};
  for (let i = 1; i < numerosBloque.length; i++) {
    const numPrev = numerosBloque[i - 1];
    const numCurr = numerosBloque[i];
    const cicloPrev = bloqueCicloLogico[numPrev];
    const cicloCurr = bloqueCicloLogico[numCurr];
    
    // Si la diferencia de periodo es > 1 (ej. no tomó el semestre 3 y pasó al 4)
    // O si los ciclos no son consecutivos temporalmente
    let salto = false;
    if (numCurr > numPrev + 1) {
      salto = true;
    } else if (!isConsecutiveCycle(cicloPrev, cicloCurr)) {
      salto = true;
    }
    
    bloqueReingreso[numCurr] = salto;
  }

  // 5. Asignación Final y Ordenamiento Interno por clave_legado
  const resultadoFinal: AnalisisMateriaDGAIR[] = [];
  
  // Recorremos los bloques en su orden cronológico
  numerosBloque.forEach(numBloque => {
    const materiasDelBloque = bloquesMap[numBloque];
    
    // Ordenar las materias dentro del bloque por clave_legado (ascendente)
    materiasDelBloque.sort((a, b) => {
      const claveA = a.asignatura?.clave_legado || '';
      const claveB = b.asignatura?.clave_legado || '';
      return claveA.localeCompare(claveB, undefined, { numeric: true, sensitivity: 'base' });
    });

    materiasDelBloque.forEach(materia => {
      const periodo = numBloque;
      const cicloLogico = bloqueCicloLogico[periodo];
      const cicloMateria = materia.ciclo?.nombre || 'SIN CICLO';
      const esReingreso = bloqueReingreso[periodo] || false;
      
      let id_observacion = 100;
      let observacion_texto = 'ORDINARIO';
      let requiereRevision = false;
      
      // Regla de Extraordinario explícito
      const tipoEval = (materia.tipo_evaluacion || '').toUpperCase();
      const esExtra = tipoEval.includes('EXTRAORDINARIO');

      if (esReingreso && cicloMateria === cicloLogico) {
        id_observacion = 75;
        observacion_texto = 'REINGRESO';
      } else if (cicloMateria === cicloLogico && !esExtra) {
        id_observacion = 100;
        observacion_texto = 'ORDINARIO';
      } else if (cicloMateria !== cicloLogico || esExtra) {
        // Si el ciclo es inconsistente, revisar tipo_evaluacion para asentar EXAMEN EXTRAORDINARIO
        if (esExtra && materia.calificacion_final) {
          id_observacion = 71;
          observacion_texto = 'EXAMEN EXTRAORDINARIO';
        } else {
          // Si es inconsistente pero no dice extraordinario en la base de datos, lo ponemos como sugerencia de revisión
          id_observacion = 71;
          observacion_texto = 'EXAMEN EXTRAORDINARIO';
          requiereRevision = true;
        }
      }
      
      resultadoFinal.push({
        materia,
        id_observacion,
        observacion_texto,
        requiereRevision,
        esReingreso,
        cicloLogico
      });
    });
  });

  return resultadoFinal;
}
