import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Download, AlertCircle, BookOpen, GraduationCap, CheckCircle2, TrendingUp, CalendarDays, Filter } from 'lucide-react';
import { MultiSelectFilter } from '../MultiSelectFilter';
import ModalGenerarCarga from '../modals/ModalGenerarCarga';
import { supabase } from '../../lib/supabase';
import type { Alumno, InscripcionAcademica } from '../../types';
import toast from 'react-hot-toast';

interface TabHistorialAcademicoProps {
  alumno: Alumno;
  planActivoId?: string | null;
}

const renderCalif = (cal?: number | null): string | number => {
  if (cal === null || cal === undefined) return '-';
  if (cal === -555) return 'NP';
  return cal;
};

const calificacionALetras = (num?: number | null): string => {
  if (num === null || num === undefined || isNaN(num)) return '';
  if (num === -555) return 'NO PRESENTÓ';

  const enteros = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ'];
  const [enteroStr, decimalStr] = num.toString().split('.');
  
  const entero = parseInt(enteroStr);
  if (entero < 0 || entero > 10) return num.toString();
  
  let texto = enteros[entero] || '';
  if (decimalStr && parseInt(decimalStr) > 0) {
    texto += ` PUNTO ${enteros[parseInt(decimalStr.charAt(0))] || decimalStr.charAt(0)}`;
  }
  return texto;
};

const obtenerNombrePeriodo = (numero: number, tipo: string): string => {
  const ordinales = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Undécimo', 'Duodécimo'];
  const ordinal = ordinales[numero - 1] || `${numero}°`;
  const tipoLower = tipo?.toLowerCase() || '';
  if (tipoLower.includes('cuatrimestral')) return `${ordinal} Cuatrimestre`;
  if (tipoLower.includes('semestral')) return `${ordinal} Semestre`;
  return `Bloque ${numero}`;
};

const getCicloWeight = (cicloStr?: string | null): number => {
  if (!cicloStr || cicloStr === '-') return 999999;
  const parts = cicloStr.match(/(\d+)[-/](\d+)/);
  if (parts) {
    let year = parseInt(parts[1], 10);
    if (year < 100) year += 2000; // Asumir 2000s para años de 2 dígitos
    const period = parseInt(parts[2], 10);
    return year * 10 + period;
  }
  return 999999;
};

export default function TabHistorialAcademico({ alumno, planActivoId }: TabHistorialAcademicoProps) {
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModalCarga, setShowModalCarga] = useState(false);

  // Filtros
  const OPCIONES_ESTATUS = ['Acreditadas', 'Reprobadas', 'Por acreditar / Cursando'];
  const [filtroEstatus, setFiltroEstatus] = useState<string[]>(OPCIONES_ESTATUS);
  const [ocultarComplementarias, setOcultarComplementarias] = useState(false);

  const fetchHistorialLocal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inscripciones_academicas')
        .select(`
          *,
          asignaturas (
            nombre,
            clave_legado,
            creditos,
            clasificacion_clave,
            clasificacion_nombre,
            numero_periodo,
            plan_id,
            planes_estudio (
              nombre,
              clave_legado,
              creditos_obligatorios,
              tipo_periodo,
              modelo
            )
          )
        `)
        .eq('alumno_id', alumno.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setHistorial(data || []);
    } catch (error: any) {
      console.error('Error fetching historial:', error);
      toast.error('No se pudo cargar el historial académico local.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (alumno?.id) {
      fetchHistorialLocal();
    }
  }, [alumno]);

  const handleSyncGES = async () => {
    if (!alumno.matricula) {
      toast.error('El alumno no tiene una matrícula asignada para buscar en GES 4.');
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Fetch from legacy API
      const response = await fetch(`http://localhost:3001/api/legacy/kardex/${alumno.matricula}`);
      if (!response.ok) {
        throw new Error(`Error HTTP! status: ${response.status}`);
      }
      const dataGES = await response.json();

      if (!dataGES || dataGES.length === 0) {
        toast.error('No se encontraron registros en el historial del GES 4.');
        setIsSyncing(false);
        return;
      }

      // 2. Fetch Lookups from Supabase
      const { data: asignaturas } = await supabase.from('asignaturas').select('id, clave_legado, plan_id');
      const { data: planes } = await supabase.from('planes_estudio').select('id, clave_legado');

      if (!asignaturas || !planes) {
        throw new Error('Error al cargar los catálogos de asignaturas y planes de estudio.');
      }

      // 3. Map records
      const registrosMapeados: any[] = [];
      
      for (const item of dataGES) {
        const planMatch = planes.find(p => p.clave_legado === item.clave_plan);
        if (!planMatch) continue;

        const asigMatch = asignaturas.find(a => a.clave_legado === item.clave_asignatura && a.plan_id === planMatch.id);
        if (!asigMatch) continue;

        const califFinal = parseFloat(item.calificacion_final);
        let estatus = 'PENDIENTE';
        if (!isNaN(califFinal)) {
          estatus = califFinal >= 6 ? 'APROBADA' : 'REPROBADA';
        }

        const p1 = item.parcial_1 !== null ? parseFloat(item.parcial_1) : null;
        const p2 = item.parcial_2 !== null ? parseFloat(item.parcial_2) : null;
        const p3 = item.parcial_3 !== null ? parseFloat(item.parcial_3) : null;
        let promParc = item.promedio_calculado !== null ? parseFloat(item.promedio_calculado) : null;

        if (promParc === null) {
            let sum = 0, count = 0;
            if (p1 !== null) { sum += (p1 === -555 ? 0 : p1); count++; }
            if (p2 !== null) { sum += (p2 === -555 ? 0 : p2); count++; }
            if (p3 !== null) { sum += (p3 === -555 ? 0 : p3); count++; }
            if (count > 0) promParc = Number((sum / count).toFixed(2));
        }

        registrosMapeados.push({
          alumno_id: alumno.id,
          ciclo_id: null,
          ciclo_legado: item.ciclo_legado,
          asignatura_id: asigMatch.id,
          parcial_1: p1,
          parcial_2: p2,
          parcial_3: p3,
          promedio_calculado: promParc,
          calificacion_final: item.calificacion_final !== null ? parseFloat(item.calificacion_final) : null,
          tipo_evaluacion: item.tipo_evaluacion || 'ORDINARIO',
          estatus: estatus,
          modificada_manualmente: false,
          observaciones: 'Importado de GES 4'
        });
      }

      if (registrosMapeados.length === 0) {
        toast.error('No se pudo mapear ninguna materia. Verifica que los planes y materias existan en el sistema.');
        setIsSyncing(false);
        return;
      }

      // 4. Delete old records and insert new ones
      await supabase.from('inscripciones_academicas').delete().eq('alumno_id', alumno.id);
      const { error: insertError } = await supabase.from('inscripciones_academicas').insert(registrosMapeados);

      if (insertError) throw insertError;

      toast.success('Historial sincronizado exitosamente.');
      await fetchHistorialLocal();

    } catch (error: any) {
      console.error('Error sincronizando con GES 4:', error);
      toast.error('Ocurrió un error de conexión al intentar importar el historial.');
    } finally {
      setIsSyncing(false);
    }
  };

  const safeRender = (val: number | null | undefined) => {
    return renderCalif(val);
  };

  // Agrupa los registros por asignatura
  const historialAgrupado = useMemo(() => {
    const mapa = new Map<string, any>();

    historial.forEach((reg) => {
      // FILTRO DE CONTEXTO AISLADO
      if (planActivoId && reg.asignaturas?.plan_id !== planActivoId) return;

      const idAsig = reg.asignatura_id;
      if (!mapa.has(idAsig)) {
        mapa.set(idAsig, {
          asignatura: reg.asignaturas,
          ciclo_id: reg.ciclo_id,
          ciclo_legado: reg.ciclo_legado,
          ordinario: null,
          extras: [],
          mejor_calificacion: null,
          acreditada: false,
        });
      }
      
      const grupo = mapa.get(idAsig);
      
      const tipo = (reg.tipo_evaluacion || 'ORDINARIO').toUpperCase();
      if (tipo === 'ORDINARIO') {
        grupo.ordinario = reg;
      } else {
        grupo.extras.push(reg);
      }

      // Determinar la mejor calificación y si está acreditada
      const calif = reg.calificacion_final !== null ? parseFloat(reg.calificacion_final) : null;
      if (calif !== null) {
        if (calif >= 6) {
          grupo.acreditada = true;
          if (grupo.mejor_calificacion === null || calif > grupo.mejor_calificacion) {
            grupo.mejor_calificacion = calif;
          }
        } else if (!grupo.acreditada && (grupo.mejor_calificacion === null || calif > grupo.mejor_calificacion)) {
           grupo.mejor_calificacion = calif;
        }
      }
    });

    return Array.from(mapa.values());
  }, [historial]);

  // Aplica filtros y calcula estadísticas
  const { datosFiltrados, estadisticas } = useMemo(() => {
    let filtrados = historialAgrupado;

    // 1. Aplicar Filtro de Complementarias usando la clave o el nombre de la clasificación
    if (ocultarComplementarias) {
      filtrados = filtrados.filter(item => {
        const clave = item.asignatura?.clasificacion_clave;
        const nombreClasif = item.asignatura?.clasificacion_nombre?.toLowerCase() || '';
        
        // Ocultar si la clave es 266 o si el nombre contiene 'complementaria'
        const esComplementaria = clave === '266' || nombreClasif.includes('complementaria');
        
        return !esComplementaria; 
      });
    }

    // 2. Aplicar Filtro de Estatus (Multiselect)
    if (filtroEstatus.length > 0 && filtroEstatus.length < OPCIONES_ESTATUS.length) {
      filtrados = filtrados.filter(item => {
        const p1 = item.ordinario?.parcial_1;
        const p2 = item.ordinario?.parcial_2;
        const p3 = item.ordinario?.parcial_3;
        
        const finalCalif = item.mejor_calificacion;
        const isAcreditada = item.acreditada;
        
        // Helper: Un valor se considera "vacío" o "no capturado" si es null, undefined o exactamente 0.
        const isVacio = (v: any) => v === null || v === undefined || v === 0;
        
        // Verificamos si la captura del semestre está en curso (tiene huecos o ceros por defecto)
        const parcialesIncompletos = isVacio(p1) || isVacio(p2) || isVacio(p3);
        
        // --- REGLAS ESTRICTAS DE REPROBACIÓN ---
        
        // A) Final explícito: 5, NP (-555), o una calificación real entre 0.1 y 5.9
        const finalExplicito = finalCalif === 5 || finalCalif === -555 || (finalCalif !== null && finalCalif > 0 && finalCalif < 6);
        
        // B) Final en 0 legítimo: Tiene 0 en el final, PERO sus 3 parciales sí fueron capturados (ninguno está vacío). 
        // Esto diferencia un abandono real de un "0 de inicialización de sistema".
        const reprobadaConCero = finalCalif === 0 && !parcialesIncompletos;
        
        // C) Reprobada por parciales letales: No tiene final (o es 0), pero sus 3 parciales están capturados y todos son exactamente 5 o NP.
        const tresParcialesLetales = !isVacio(p1) && !isVacio(p2) && !isVacio(p3) && 
                                     [p1, p2, p3].every(p => p === 5 || p === -555);
                                     
        // Evaluación final de reprobación
        const isReprobada = !isAcreditada && (finalExplicito || reprobadaConCero || tresParcialesLetales);
        
        // --- REGLA DE CURSANDO ---
        // Si no está acreditada y no superó las reglas estrictas de reprobación (es decir, está llena de 0s, nulls, o faltan parciales), está en curso.
        const isPorAcreditar = !isAcreditada && !isReprobada;

        if (filtroEstatus.includes('Acreditadas') && isAcreditada) return true;
        if (filtroEstatus.includes('Reprobadas') && isReprobada) return true;
        if (filtroEstatus.includes('Por acreditar / Cursando') && isPorAcreditar) return true;
        
        return false;
      });
    }

    // 3. Calcular Estadísticas sobre el TOTAL agrupado
    let sumPromedio = 0;
    let materiasParaPromedio = 0;
    let materiasAprobadas = 0;
    let creditosCubiertos = 0;

    historialAgrupado.forEach(item => {
      if (item.acreditada) {
        materiasAprobadas++;
        creditosCubiertos += Number(item.asignatura?.creditos || 0);

        // REGLA: Solo calcular promedio con Obligatorias (263) y Optativas (264)
        const clave = item.asignatura?.clasificacion_clave;
        if (clave === '263' || clave === '264') {
          sumPromedio += item.mejor_calificacion;
          materiasParaPromedio++;
        }
      }
    });

    // TRUNCADO SIN REDONDEO
    let promedioRaw = materiasParaPromedio > 0 ? (sumPromedio / materiasParaPromedio) : 0;
    const promedioGeneral = (Math.trunc(promedioRaw * 100) / 100).toFixed(2);
    
    // Extraer créditos del plan desde la primera materia
    let creditosTotalesPlan = 325; // Default fallback
    if (historial.length > 0 && historial[0]?.asignaturas?.planes_estudio?.creditos_obligatorios) {
        creditosTotalesPlan = Number(historial[0].asignaturas.planes_estudio.creditos_obligatorios);
    }
    
    const porcentajeAvance = creditosTotalesPlan > 0 ? ((creditosCubiertos / creditosTotalesPlan) * 100).toFixed(1) : '0.0';

    return { 
      datosFiltrados: filtrados, 
      estadisticas: { 
        promedioGeneral, 
        creditosCubiertos, 
        creditosTotalesPlan, 
        porcentajeAvance, 
        totalMaterias: historialAgrupado.length, 
        aprobadas: materiasAprobadas 
      } 
    };
  }, [historialAgrupado, filtroEstatus, ocultarComplementarias, historial]);

  const datosAgrupados = useMemo(() => {
    const grupos: Record<string, any> = {};

    // 1. Agrupar todo estrictamente por el bloque/periodo configurado en el catálogo
    datosFiltrados.forEach(item => {
      const planData = item.asignatura?.planes_estudio;
      const modelo = planData?.modelo || 'RIGIDO';
      const tipoPeriodo = planData?.tipo_periodo || 'Semestral';
      const clavePlan = planData?.clave_legado || 'DEFAULT';
      const numPeriodo = item.asignatura?.numero_periodo || 1;

      // --- NUEVA REGLA: INTERCEPCIÓN DE COMPLEMENTARIAS ---
      const clasifClave = item.asignatura?.clasificacion_clave;
      const clasifNombre = item.asignatura?.clasificacion_nombre?.toLowerCase() || '';
      const esComplementaria = clasifClave === '266' || clasifNombre.includes('complementaria');

      if (esComplementaria) {
        const groupKey = `${clavePlan}_COMPLEMENTARIAS`;
        
        if (!grupos[groupKey]) {
          grupos[groupKey] = {
            plan: clavePlan,
            modelo: 'ESPECIAL',
            tipoPeriodo: tipoPeriodo,
            numeroOriginal: 99999, // Un número gigantesco para enviarlo al final de la retícula
            titulo: 'Asignaturas Complementarias (Inglés / Talleres)',
            numeroParaOrden: 99999,
            items: [],
            minCicloWeight: 999999
          };
        }
        
        grupos[groupKey].items.push(item);
        return; // 🛑 Se detiene aquí para no meterla en los semestres regulares
      }
      // --- FIN DE LA INTERCEPCIÓN ---

      const groupKey = `${clavePlan}_${numPeriodo}`;

      if (!grupos[groupKey]) {
        grupos[groupKey] = {
          plan: clavePlan,
          modelo: modelo,
          tipoPeriodo: tipoPeriodo,
          numeroOriginal: numPeriodo, // El bloque configurado en la base de datos
          items: [],
          minCicloWeight: 999999, // Utilizado para ordenar los flexibles
          cicloRepresentativo: null
        };
      }

      grupos[groupKey].items.push(item);

      // Para modelos flexibles, encontrar el ciclo más antiguo cursado en este bloque
      if (modelo === 'FLEXIBLE') {
        const ciclo = item.ordinario?.ciclo_legado || item.ordinario?.ciclo?.nombre;
        if (ciclo && ciclo !== '-') {
          const weight = getCicloWeight(ciclo);
          if (weight < grupos[groupKey].minCicloWeight) {
            grupos[groupKey].minCicloWeight = weight;
            grupos[groupKey].cicloRepresentativo = ciclo;
          }
        }
      }
    });

    // 2. Aplicar reglas de ordenamiento y nomenclatura por Plan
    let gruposArray = Object.values(grupos);
    const planesUnicos = Array.from(new Set(gruposArray.map(g => g.plan)));
    let resultadoFinal: any[] = [];

    planesUnicos.forEach(clavePlan => {
      const gruposDelPlan = gruposArray.filter(g => g.plan === clavePlan);
      
      // Buscar el modelo principal del plan (ignorando el cajón de complementarias)
      const grupoPrincipal = gruposDelPlan.find(g => g.modelo !== 'ESPECIAL');
      const modeloPlan = grupoPrincipal ? grupoPrincipal.modelo : 'RIGIDO';

      let indiceCronologico = 1;

      gruposDelPlan.forEach(grupo => {
        // 1. AISLAMIENTO DE COMPLEMENTARIAS
        if (grupo.modelo === 'ESPECIAL') {
          grupo.titulo = 'ASIGNATURAS COMPLEMENTARIAS';
          grupo.numeroParaOrden = 99999;
        } 
        // 2. LÓGICA FLEXIBLE
        else if (modeloPlan === 'FLEXIBLE') {
          if (grupo.minCicloWeight !== 999999) {
            // Bloque cursado (asume ordinal cronológico)
            const ordinal = obtenerNombrePeriodo(indiceCronologico, grupo.tipoPeriodo);
            grupo.titulo = `${ordinal} (${grupo.cicloRepresentativo})`;
            grupo.numeroParaOrden = indiceCronologico;
            indiceCronologico++;
          } else {
            // Bloque No Cursado (Mantiene nombre original del bloque)
            grupo.titulo = `Bloque ${grupo.numeroOriginal} (Por cursar)`;
            grupo.numeroParaOrden = 9999 + grupo.numeroOriginal; // Lo manda al final, pero antes de las complementarias
          }
        } 
        // 3. LÓGICA RÍGIDA
        else {
          grupo.titulo = obtenerNombrePeriodo(grupo.numeroOriginal, grupo.tipoPeriodo);
          grupo.numeroParaOrden = grupo.numeroOriginal;
        }
      });

      // Ordenar los grupos de este plan por su número de orden asignado
      gruposDelPlan.sort((a, b) => a.numeroParaOrden - b.numeroParaOrden);
      
      // Extraer el nombre del plan desde el primer item válido del grupo
      let nombrePlan = 'Plan Desconocido';
      for (const g of gruposDelPlan) {
        if (g.items.length > 0 && g.items[0].asignatura?.planes_estudio?.nombre) {
          nombrePlan = g.items[0].asignatura.planes_estudio.nombre;
          break;
        }
      }

      resultadoFinal.push({
        planClave: clavePlan,
        planNombre: nombrePlan,
        grupos: gruposDelPlan
      });
    });

    return resultadoFinal;
  }, [datosFiltrados]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#1456f0]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 font-sans space-y-6">
      
      {/* ── Encabezado y Acciones ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#222222] dark:text-gray-100 flex items-center gap-2">
             <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-[8px]">
              <BookOpen size={18} />
             </div>
             Historial Académico (Kardex)
          </h3>
          <p className="text-sm text-gray-500 mt-1">Sincroniza desde el GES 4 y visualiza el agrupamiento de calificaciones.</p>
        </div>
        
        <div className="flex gap-2">
            <button
            onClick={() => setShowModalCarga(true)}
            className="flex items-center gap-2 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.12)] text-[#222222] dark:text-gray-200 px-4 py-2 rounded-[8px] font-medium shadow-[var(--shadow-subtle)] hover:shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            title="Inscribir materias del plan actual"
            disabled={!planActivoId}
            >
            <CalendarDays size={16} className="text-gray-500" />
            <span className="hidden sm:inline">Generar Carga</span>
            </button>
            <button
            onClick={handleSyncGES}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white px-4 py-2 rounded-[8px] font-medium shadow-[var(--shadow-brand)] hover:shadow-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isSyncing ? 'Importando...' : 'Importar GES 4'}
            </button>
        </div>
      </div>

      {historial.length > 0 && (
          <>
            {/* ── Tarjetas Estadísticas ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#181e25] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] rounded-[16px] p-5 shadow-[var(--shadow-subtle)] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <GraduationCap size={24} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Promedio General</p>
                        <p className="text-2xl font-bold text-[#222222] dark:text-gray-100">{estadisticas.promedioGeneral}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#181e25] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] rounded-[16px] p-5 shadow-[var(--shadow-subtle)] flex items-center gap-4 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 z-10">
                        <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="z-10 flex-1">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Materias Aprobadas</p>
                        <div className="flex items-baseline gap-2">
                           <p className="text-2xl font-bold text-[#222222] dark:text-gray-100">{estadisticas.aprobadas}</p>
                           <p className="text-sm font-medium text-gray-400">/ {estadisticas.totalMaterias}</p>
                        </div>
                    </div>
                    {/* Barra de progreso de fondo */}
                    <div className="absolute bottom-0 left-0 h-1 bg-emerald-100 dark:bg-emerald-900/30 w-full z-0" />
                    <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-1000 z-0" style={{ width: `${(estadisticas.aprobadas / estadisticas.totalMaterias) * 100 || 0}%` }} />
                </div>

                <div className="bg-white dark:bg-[#181e25] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] rounded-[16px] p-5 shadow-[var(--shadow-subtle)] flex items-center gap-4 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0 z-10">
                        <TrendingUp size={24} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="z-10 flex-1">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avance Créditos</p>
                        <div className="flex items-baseline gap-2">
                           <p className="text-2xl font-bold text-[#222222] dark:text-gray-100">{estadisticas.porcentajeAvance}%</p>
                           <p className="text-sm font-medium text-gray-400">({estadisticas.creditosCubiertos} / {estadisticas.creditosTotalesPlan})</p>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-purple-100 dark:bg-purple-900/30 w-full z-0" />
                    <div className="absolute bottom-0 left-0 h-1 bg-purple-500 transition-all duration-1000 z-0" style={{ width: `${estadisticas.porcentajeAvance}%` }} />
                </div>
            </div>

            {/* ── Barra de Filtros ── */}
            <div className="bg-[#f8f9ff] dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[12px] p-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Filter size={16} className="text-gray-400 ml-1" />
                    <MultiSelectFilter
                       label="Estatus"
                       options={OPCIONES_ESTATUS}
                       selected={filtroEstatus}
                       onChange={setFiltroEstatus}
                    />
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-[#45515e] dark:text-gray-300 cursor-pointer select-none pr-2">
                    <input 
                       type="checkbox"
                       checked={ocultarComplementarias}
                       onChange={(e) => setOcultarComplementarias(e.target.checked)}
                       className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    Ocultar Complementarias
                </label>
            </div>
          </>
      )}

      {/* ── Tabla de Datos ── */}
      {historial.length === 0 ? (
        <div className="bg-white dark:bg-[#181e25] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] rounded-[16px] p-10 text-center flex flex-col items-center shadow-[var(--shadow-subtle)]">
           <AlertCircle size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
           <p className="text-gray-600 dark:text-gray-300 font-semibold text-base mb-1">Sin Registros Académicos</p>
           <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm leading-relaxed">
             No hay historial académico guardado en la base de datos para este alumno. Presiona "Importar GES 4" para sincronizar.
           </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181e25] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] rounded-[16px] overflow-hidden shadow-[var(--shadow-subtle)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#1c2228] border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="px-4 py-3 sticky left-0 bg-gray-50 dark:bg-[#1c2228] z-10 border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">Asignatura</th>
                  <th className="px-3 py-3 text-center border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">Ciclo</th>
                  <th className="px-2 py-3 text-center">P1</th>
                  <th className="px-2 py-3 text-center">P2</th>
                  <th className="px-2 py-3 text-center">P3</th>
                  <th className="px-2 py-3 text-center text-gray-400">Prom.</th>
                  <th className="px-3 py-3 text-center border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">Final Ord.</th>
                  <th className="px-2 py-3 text-center">Ext. 1</th>
                  <th className="px-2 py-3 text-center">Ext. 2</th>
                  <th className="px-2 py-3 text-center border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">Recur.</th>
                  <th className="px-3 py-3 text-center text-[#1456f0] dark:text-[#60a5fa] text-xs">Final</th>
                  <th className="px-3 py-3 text-center">Letra</th>
                  <th className="px-3 py-3 text-center">Créd.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f3f5] dark:divide-[rgba(255,255,255,0.04)] text-sm">
                {datosAgrupados.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                      No hay registros académicos con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  datosAgrupados.map((planEstructurado) => (
                    <React.Fragment key={planEstructurado.planClave}>
                      {/* SÚPER CABECERA DEL PLAN DE ESTUDIOS */}
                      <tr className="bg-[#1456f0] dark:bg-blue-900 text-white">
                        <td colSpan={13} className="px-4 py-3 text-sm font-black uppercase tracking-wider shadow-inner">
                          🎓 {planEstructurado.planNombre} <span className="font-normal text-blue-200 text-xs ml-2">(CLAVE: {planEstructurado.planClave})</span>
                        </td>
                      </tr>

                      {/* ITERACIÓN DE LOS SEMESTRES/BLOQUES DE ESE PLAN */}
                      {planEstructurado.grupos.map((grupo: any) => (
                        <React.Fragment key={grupo.titulo}>
                          <tr className="bg-gray-100 dark:bg-gray-800/60 border-y border-gray-200 dark:border-gray-700">
                            <td colSpan={13} className="px-4 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                              {grupo.titulo}
                              {grupo.modelo === 'FLEXIBLE' && <span className="text-xs font-normal text-gray-500 lowercase ml-2">(orden cronológico)</span>}
                            </td>
                          </tr>
                          
                          {/* ITERACIÓN DE MATERIAS (Mantener el map(item => ...) original aquí adentro exactamente como estaba) */}
                          {grupo.items.map((item: any, idx: number) => {
                          const rowClass = item.acreditada 
                              ? 'hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors' 
                              : (item.mejor_calificacion !== null)
                                  ? 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors'
                                  : 'hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors';

                          return (
                              <tr key={item.asignatura?.id || idx} className={`${rowClass} text-[#45515e] dark:text-gray-300`}>
                            {/* Asignatura */}
                            <td className="px-4 py-2.5 font-medium sticky left-0 bg-white dark:bg-[#181e25] border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col max-w-[250px]">
                                <span className={`text-[#222222] dark:text-gray-100 truncate ${!item.acreditada && item.mejor_calificacion !== null ? 'text-red-700 dark:text-red-400' : ''}`}>
                                    {item.asignatura?.nombre || 'Desconocida'}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5 tracking-wide uppercase">CLAVE: {item.asignatura?.clave_legado || '-'}</span>
                            </div>
                            </td>
                            
                            {/* Ciclo */}
                            <td className="px-3 py-2.5 text-center font-semibold text-[12px] border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                                {item.ordinario?.ciclo?.nombre || item.ordinario?.ciclo_legado || '-'}
                            </td>
                            
                            {/* Ordinario */}
                            <td className="px-2 py-2.5 text-center font-mono text-[13px]">{safeRender(item.ordinario?.parcial_1)}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-[13px]">{safeRender(item.ordinario?.parcial_2)}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-[13px]">{safeRender(item.ordinario?.parcial_3)}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-[13px] text-gray-400">
                                {item.ordinario?.promedio_calculado !== null && item.ordinario?.promedio_calculado !== undefined 
                                    ? renderCalif(item.ordinario.promedio_calculado) === 'NP' ? 'NP' : Number(item.ordinario.promedio_calculado).toFixed(2)
                                    : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[13px] font-semibold border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                                {safeRender(item.ordinario?.calificacion_final)}
                            </td>

                            {/* Extraordinarios y Recursamiento */}
                            <td className="px-2 py-2.5 text-center font-mono text-[13px] text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                                {safeRender(item.extras[0]?.calificacion_final)}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-[13px] text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                                {safeRender(item.extras[1]?.calificacion_final)}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-[13px] text-purple-700 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-900/10 border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                                {safeRender(item.extras[2]?.calificacion_final)}
                            </td>

                            {/* Final, Letra y Créditos */}
                            <td className={`px-3 py-2.5 text-center font-mono font-bold text-[14px] ${
                                item.acreditada ? 'text-emerald-600 dark:text-emerald-400' : 
                                item.mejor_calificacion !== null ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
                            }`}>
                                {safeRender(item.mejor_calificacion)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                {calificacionALetras(item.mejor_calificacion)}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[12px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-900/20">
                                {item.asignatura?.creditos || '-'}
                            </td>
                        </tr>
                    );
                })}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 dark:bg-[#1c2228] border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Mostrando {datosFiltrados.length} asignaturas</span>
              <div className="flex gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Acreditadas</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Reprobadas</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Extraordinario</span>
              </div>
          </div>
        </div>
      )}
      
      {showModalCarga && planActivoId && (
        <ModalGenerarCarga 
          alumnoId={alumno.id} 
          planId={planActivoId} 
          onClose={() => setShowModalCarga(false)}
          onSuccess={() => {
            setShowModalCarga(false);
            fetchHistorialLocal();
          }}
        />
      )}
    </div>
  );
}
