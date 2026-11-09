import { participaEnPromedio } from '../../utils/promedioAcademico';
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import CabeceraHistorial from '../ficha/CabeceraHistorial';
import TablaHistorialAcademico from '../ficha/TablaHistorialAcademico';
import { COLUMNAS_INICIALES, resolverColumnasHistorial, type ColumnaHistorialId } from '../../utils/columnasHistorial';
import { situacionHistorial } from '../../utils/presentacionHistorial';
import ModalGenerarCarga from '../modals/ModalGenerarCarga';
import ModalReinscripcion from '../modals/ModalReinscripcion';
import { supabase } from '../../lib/supabase';
import type { Alumno, InscripcionAcademica } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { syncAlumnoKardex } from '../../utils/syncKardexUtils';
import toast from 'react-hot-toast';

interface TabHistorialAcademicoProps {
  key?: string;
  alumno: Alumno;
  ampliado?: boolean;
  onAmpliar?: () => void;
}

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

export default function TabHistorialAcademico({ alumno, ampliado = false, onAmpliar }: TabHistorialAcademicoProps) {
  const [columnasElegidas,setColumnasElegidas]=useState<ColumnaHistorialId[]>([...COLUMNAS_INICIALES]);
  const [ocultarColumnasVacias,setOcultarColumnasVacias]=useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModalCarga, setShowModalCarga] = useState(false);

  // Multi-Plan context
  const [programas, setProgramas] = useState<any[]>([]);
  const [planActivoId, setPlanActivoId] = useState<string | null>(null);
  const [showModalReinscripcion, setShowModalReinscripcion] = useState(false);
  
  const { ciclos, carreras, currentUser } = useAppStore();

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
  };

  const getCarreraFullName = (c: any) => {
    if (!c) return 'Desconocida';
    const nivel = toTitleCase((c.nivel_educativo || 'Licenciatura').trim());
    const nombre = toTitleCase(c.nombre.trim());
    if (nombre.toUpperCase().includes(nivel.toUpperCase())) return nombre;
    return `${nivel} en ${nombre}`;
  };

  const formatPlanOption = (prog: any) => {
    const plan = prog.planes_estudio;
    if (!plan) return 'Plan Desconocido';
    
    const carrera = carreras.find(c => c.id === plan.carrera_id);
    const claveReducida = plan.clave_legado ? plan.clave_legado.substring(0, 4) : '';
    
    if (carrera) {
      return `${getCarreraFullName(carrera)} (${claveReducida})`;
    }
    return `${plan.nombre} (${claveReducida})`;
  };

  // Filtros
  const OPCIONES_ESTATUS = ['Acreditadas', 'Reprobadas', 'Por acreditar / Cursando'];
  const [filtroEstatus, setFiltroEstatus] = useState<string[]>(OPCIONES_ESTATUS);
  const [ocultarComplementarias, setOcultarComplementarias] = useState(false);

  // Derivar la calificación mínima aprobatoria del plan activo
  const planActivoData = programas.find(p => p.plan_id === planActivoId);
  const carreraDelPlan = carreras.find(c => c.id === (planActivoData?.planes_estudio as any)?.carrera_id);
  const calificacionMinima = carreraDelPlan?.calificacion_minima_aprobatoria || 6;
  const esEspecialidad = carreraDelPlan?.nivel_educativo?.toLowerCase().includes('especialidad') || false;

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
              modelo,
              carrera_id
            )
          ),
          ciclo:ciclos_escolares (
            nombre
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

  const fetchProgramas = async () => {
    try {
      const { data } = await supabase
        .from('alumno_programas')
        .select('id, plan_id, es_vigente, estatus, planes_estudio(nombre, clave_legado, tipo_periodo, carrera_id)')
        .eq('alumno_id', alumno.id)
        .order('fecha_inscripcion', { ascending: false });
      
      if (data && data.length > 0) {
        setProgramas(data);
        
        // Buscar el plan que coincida con la licenciatura configurada en datos generales
        const licAlumno = alumno.licenciatura?.trim().toUpperCase() || '';
        const planPrincipal = data.find((p: any) => p.es_vigente) || data.find((p: any) => {
          const plan = p.planes_estudio as any;
          if (!plan || !licAlumno) return false;
          // Match por nombre del plan o clave_legado
          if (plan.nombre?.toUpperCase() === licAlumno) return true;
          if (plan.clave_legado?.toUpperCase() === licAlumno) return true;
          // Match por nombre de la carrera asociada
          if (plan.carrera_id) {
            const carrera = carreras.find(c => c.id === plan.carrera_id);
            if (carrera?.nombre?.trim().toUpperCase() === licAlumno) return true;
            // Match parcial (el campo licenciatura podría contener "PSICOLOGIA" y la carrera ser "PSICOLOGÍA")
            const nombreNorm = carrera?.nombre?.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
            const licNorm = licAlumno.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (nombreNorm && nombreNorm === licNorm) return true;
          }
        }) || ((alumno.estatus?.includes('EGRESADO') || alumno.estatus === 'TITULADO') ? data.find((p: any) => ['EGRESADO', 'TITULADO'].includes(p.estatus)) : null) || data.find((p: any) => p.estatus === 'CURSANDO') || data[0];

        setPlanActivoId(prev => {
          if (prev && data.some(d => d.plan_id === prev)) return prev;
          return planPrincipal.plan_id;
        });
      } else {
        setProgramas([]);
        setPlanActivoId('');
        toast.error('No hay un programa asociado. Revisa Programas en Datos Generales; consultar el historial no crea inscripciones.');
      }
    } catch (error) {
      console.error("Error fetching programas:", error);
    }
  };

  useEffect(() => {
    if (alumno?.id) {
      fetchHistorialLocal();
      fetchProgramas();
    }
  }, [alumno]);

  const handleSyncGES = async () => {
    if (!alumno.matricula) {
      toast.error('El alumno no tiene una matrícula asignada para buscar en GES 4.');
      return;
    }

    setIsSyncing(true);
    try {
      // Fetch Lookups from Supabase ONCE
      const { data: asignaturas } = await supabase.from('asignaturas').select('id, clave_legado, plan_id');
      const { data: planes } = await supabase.from('planes_estudio').select('id, clave_legado, tipo_periodo');

      if (!asignaturas || !planes) {
        throw new Error('Error al cargar los catálogos de asignaturas y planes de estudio.');
      }

      const result = await syncAlumnoKardex(
        { id: alumno.id, matricula: alumno.matricula, estatus: alumno.estatus },
        asignaturas,
        planes,
        calificacionMinima
      );

      if (!result.success) {
        toast.error(result.message);
        setIsSyncing(false);
        return;
      }

      toast.success(`Historial sincronizado: ${result.registrosAfectados} registros de ${result.planesAfectados} plan(es).`);
      await fetchHistorialLocal();
      await fetchProgramas();

    } catch (error: any) {
      console.error('Error sincronizando con GES 4:', error);
      toast.error('Ocurrió un error de conexión al intentar importar el historial.');
    } finally {
      setIsSyncing(false);
    }
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
          registros: [],
          mejor_calificacion: null,
          acreditada: false,
        });
      }
      
      const grupo = mapa.get(idAsig);
      grupo.registros.push(reg);
      
      const tipo = (reg.tipo_evaluacion || 'ORDINARIO').toUpperCase();
      if (tipo === 'ORDINARIO') {
        grupo.ordinario = reg;
      } else {
        grupo.extras.push(reg);
      }

      // Determinar la mejor calificación y si está acreditada
      const calif = reg.calificacion_final !== null ? parseFloat(reg.calificacion_final) : null;
      if (calif !== null) {
        if (calif >= calificacionMinima) {
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
  }, [historial, planActivoId, calificacionMinima]);

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
        const situacion = situacionHistorial(item, calificacionMinima);
        const isAcreditada = situacion === 'Acreditada';
        const isReprobada = situacion === 'Reprobada';
        const isPorAcreditar = situacion === 'Por acreditar / Cursando';
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
      }

      // REGLA: Calcular promedio con Obligatorias (263) y Optativas (264), INCLUYENDO reprobadas
      const clave = item.asignatura?.clasificacion_clave;
      if (participaEnPromedio(item.asignatura) && item.mejor_calificacion !== null) {
        const califNum = item.mejor_calificacion === -555 ? 0 : item.mejor_calificacion;
        sumPromedio += califNum;
        materiasParaPromedio++;
      }
    });

    // TRUNCADO SIN REDONDEO
    let promedioRaw = materiasParaPromedio > 0 ? (sumPromedio / materiasParaPromedio) : 0;
    const promedioGeneral = (Math.trunc(promedioRaw * 100) / 100).toFixed(2);
    
    // Extraer créditos del plan usando la primera materia que pertenezca al plan activo
    let creditosTotalesPlan = 325; // Default fallback
    const materiaDelPlan = historial.find(h => h.asignaturas?.plan_id === planActivoId);
    if (materiaDelPlan?.asignaturas?.planes_estudio?.creditos_obligatorios) {
        creditosTotalesPlan = Number(materiaDelPlan.asignaturas.planes_estudio.creditos_obligatorios);
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

    // 1. Agrupar todo estrictamente usando el historial COMPLETO para mantener los índices correctos
    historialAgrupado.forEach(item => {
      const planData = item.asignatura?.planes_estudio;
      const modelo = planData?.modelo || 'RIGIDO';
      const tipoPeriodo = planData?.tipo_periodo || 'Semestral';
      const clavePlan = planData?.clave_legado || 'DEFAULT';
      const numPeriodo = item.asignatura?.numero_periodo || 1;
      
      const carrera = carreras.find(c => c.id === planData?.carrera_id);
      const nivel = carrera?.nivel_educativo?.toLowerCase() || '';
      const esEspecialidadFlexible = (nivel.includes('especialidad') && modelo === 'FLEXIBLE');

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
            minCicloWeight: 999999,
            esEspecialidadFlexible: false
          };
        }
        
        grupos[groupKey].items.push(item);
        return; // 🛑 Se detiene aquí para no meterla en los semestres regulares
      }
      // --- FIN DE LA INTERCEPCIÓN ---

      let groupKey;
      let cicloAgrupador = null;
      let minCicloWeight = 999999;
      const ciclo = item.ordinario?.ciclo_legado || item.ordinario?.ciclo?.nombre;
      const isValidCiclo = (ciclo && ciclo !== '-');

      if (esEspecialidadFlexible) {
        cicloAgrupador = isValidCiclo ? ciclo : 'POR_CURSAR';
        groupKey = `${clavePlan}_CICLO_${cicloAgrupador}`;
        minCicloWeight = isValidCiclo ? getCicloWeight(ciclo) : 999999;
      } else {
        groupKey = `${clavePlan}_${numPeriodo}`;
      }

      if (!grupos[groupKey]) {
        grupos[groupKey] = {
          plan: clavePlan,
          modelo: modelo,
          tipoPeriodo: tipoPeriodo,
          numeroOriginal: numPeriodo, // El bloque configurado en la base de datos
          items: [],
          minCicloWeight: esEspecialidadFlexible ? minCicloWeight : 999999, // Utilizado para ordenar los flexibles
          cicloRepresentativo: esEspecialidadFlexible ? (isValidCiclo ? ciclo : null) : null,
          esEspecialidadFlexible,
          cicloAgrupador
        };
      }

      grupos[groupKey].items.push(item);

      // Para modelos flexibles regulares, encontrar el ciclo más antiguo cursado en este bloque
      if (modelo === 'FLEXIBLE' && !esEspecialidadFlexible) {
        if (isValidCiclo) {
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

      // Ordenar cronológicamente antes de asignar títulos
      gruposDelPlan.sort((a, b) => {
        if (a.modelo === 'ESPECIAL') return 1;
        if (b.modelo === 'ESPECIAL') return -1;
        if (a.minCicloWeight !== 999999 || b.minCicloWeight !== 999999) {
          if (a.minCicloWeight === b.minCicloWeight) return a.numeroOriginal - b.numeroOriginal;
          return a.minCicloWeight - b.minCicloWeight;
        }
        return a.numeroOriginal - b.numeroOriginal;
      });

      gruposDelPlan.forEach(grupo => {
        // 1. AISLAMIENTO DE COMPLEMENTARIAS
        if (grupo.modelo === 'ESPECIAL') {
          grupo.titulo = 'ASIGNATURAS COMPLEMENTARIAS';
          grupo.numeroParaOrden = 99999;
        } 
        // 2. LÓGICA ESPECIALIDAD FLEXIBLE
        else if (grupo.esEspecialidadFlexible) {
          if (grupo.cicloAgrupador !== 'POR_CURSAR') {
             const ordinal = obtenerNombrePeriodo(indiceCronologico, grupo.tipoPeriodo);
             grupo.titulo = `${ordinal} (${grupo.cicloAgrupador})`;
             grupo.numeroParaOrden = indiceCronologico;
             indiceCronologico++;
          } else {
             grupo.titulo = `Materias por cursar`;
             grupo.numeroParaOrden = 9999;
          }
          // Ordenar materias internamente alfabéticamente para Especialidad Flexible
          grupo.items.sort((a: any, b: any) => {
            const nameA = a.asignatura?.nombre || '';
            const nameB = b.asignatura?.nombre || '';
            return nameA.localeCompare(nameB);
          });
        }
        // 3. LÓGICA FLEXIBLE REGULAR
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
        // 4. LÓGICA RÍGIDA
        else {
          grupo.titulo = obtenerNombrePeriodo(grupo.numeroOriginal, grupo.tipoPeriodo);
          grupo.numeroParaOrden = grupo.numeroOriginal;
        }
      });

      // Asegurar orden final por numeroParaOrden
      gruposDelPlan.sort((a, b) => a.numeroParaOrden - b.numeroParaOrden);
      
      // Extraer el nombre del plan desde el primer item válido del grupo
      let nombrePlan = 'Plan Desconocido';
      for (const g of gruposDelPlan) {
        if (g.items.length > 0 && g.items[0].asignatura?.planes_estudio?.nombre) {
          nombrePlan = g.items[0].asignatura.planes_estudio.nombre;
          break;
        }
      }

      // Filtrar items dentro de cada grupo para mostrar solo los que pasan el filtro (datosFiltrados)
      gruposDelPlan.forEach(grupo => {
        grupo.items = grupo.items.filter((item: any) => datosFiltrados.includes(item));
      });
      const gruposConItems = gruposDelPlan.filter(g => g.items.length > 0);

      if (gruposConItems.length > 0) {
        resultadoFinal.push({
          planClave: clavePlan,
          planNombre: nombrePlan,
          grupos: gruposConItems
        });
      }
    });

    return resultadoFinal;
  }, [datosFiltrados]);

  const columnasVisibles=useMemo(()=>resolverColumnasHistorial(esEspecialidad,columnasElegidas,ocultarColumnasVacias,historialAgrupado),[esEspecialidad,columnasElegidas,ocultarColumnasVacias,historialAgrupado]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#1456f0]" />
      </div>
    );
  }

  return (
    <div className="historial-academico font-sans space-y-4">
      
      <CabeceraHistorial alumno={alumno} programas={programas} planActivoId={planActivoId} onPlanChange={setPlanActivoId}
        formatPlanOption={formatPlanOption} estadisticas={estadisticas} conHistorial={historial.length>0}
        especialidad={esEspecialidad} columnasElegidas={columnasElegidas} onColumnasChange={setColumnasElegidas}
        ocultarColumnasVacias={ocultarColumnasVacias} onOcultarColumnasVacias={setOcultarColumnasVacias} filtroEstatus={filtroEstatus} onEstatusChange={setFiltroEstatus}
        ocultarComplementarias={ocultarComplementarias} onOcultarComplementarias={setOcultarComplementarias}
        ampliado={ampliado} onAmpliar={onAmpliar} isSyncing={isSyncing} onSync={handleSyncGES}
        onGenerarCarga={()=>setShowModalCarga(true)}
        onPrepararAvance={(currentUser.rol === 'ADMINISTRADOR' || currentUser.rol === 'COORDINADOR CONTROL ESCOLAR')
          && !['BAJA','EGRESADO','TITULADO'].includes(alumno.estatus?.toUpperCase()||'') && planActivoId
          ? ()=>setShowModalReinscripcion(true) : undefined}/>

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
        <TablaHistorialAcademico datosAgrupados={datosAgrupados} cantidad={datosFiltrados.length} esEspecialidad={esEspecialidad} columnas={columnasVisibles} minimo={calificacionMinima}/>

      )}
      
      {/* MONTAJE EXPLÍCITO DEL MODAL DE REINSCRIPCIÓN */}
      {showModalReinscripcion && planActivoId && (
        <ModalReinscripcion
           alumnoId={alumno.id}
           alumnoGradoActual={alumno.grado_actual}
           alumnoEstatus={alumno.estatus || 'ACTIVO'}
           planActivoId={planActivoId}
           planActivoNombre={programas.find(p => p.plan_id === planActivoId)?.planes_estudio?.nombre || ''}
           planActivoTipoPeriodo={programas.find(p => p.plan_id === planActivoId)?.planes_estudio?.tipo_periodo || ''}
           ciclos={ciclos}
           onClose={() => setShowModalReinscripcion(false)}
           onSuccess={() => {
              setShowModalReinscripcion(false);
              fetchHistorialLocal();
              fetchProgramas();
           }}
        />
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
