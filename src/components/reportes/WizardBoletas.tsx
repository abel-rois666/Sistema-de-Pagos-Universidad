import React, { useState, useEffect, useRef } from 'react';
import { supabase, getAppConfig } from '../../lib/supabase';
import { Search, ChevronRight, FileText, ChevronLeft, UserPlus, X, Settings, Printer, Calendar, ChevronDown, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import type { AppConfig, Empleado, CicloEscolar } from '../../types';
import { renderBoletasHTML } from '../../utils/boletasExportUtils';

const getCicloWeight = (cicloStr?: string | null): number => {
  if (!cicloStr || cicloStr === '-') return 999999;
  const parts = cicloStr.match(/(\d+)[-/](\d+)/);
  if (parts) {
    let year = parseInt(parts[1], 10);
    if (year < 100) year += 2000;
    const period = parseInt(parts[2], 10);
    return year * 10 + period;
  }
  return 999999;
};
export const WizardBoletas: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0, status: '' });
  const [mode, setMode] = useState<'individual' | 'masivo' | null>(null);
  const [masivoType, setMasivoType] = useState<'ciclo' | 'carrera' | 'grupo'>('ciclo');
  const [carreras, setCarreras] = useState<any[]>([]);
  const [selectedCarreraIds, setSelectedCarreraIds] = useState<string[]>([]);
  
  // Step 2: Busqueda (Individual)
  const [searchTerm, setSearchTerm] = useState('');
  const [alumnosSearchResults, setAlumnosSearchResults] = useState<any[]>([]);
  const [selectedAlumnos, setSelectedAlumnos] = useState<any[]>([]);
  
  // Step 2: Configuracion
  const [ciclos, setCiclos] = useState<CicloEscolar[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selectedCicloId, setSelectedCicloId] = useState('');
  const [showCicloMenu, setShowCicloMenu] = useState(false);
  const cicloMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú de ciclos al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cicloMenuRef.current && !cicloMenuRef.current.contains(event.target as Node)) {
        setShowCicloMenu(false);
      }
    }
    if (showCicloMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCicloMenu]);
  const [selectedFirmanteId, setSelectedFirmanteId] = useState('');
  const [formatoCopia, setFormatoCopia] = useState<'1' | '2'>('2');
  const [incluirSello, setIncluirSello] = useState(true);
  const [incluirFirma, setIncluirFirma] = useState(true);
  const [ciclosDisponibles, setCiclosDisponibles] = useState<CicloEscolar[]>([]);
  const [planesEstudio, setPlanesEstudio] = useState<any[]>([]);

  // Grupos y Planes Activos
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupoIds, setSelectedGrupoIds] = useState<string[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [activePlanIds, setActivePlanIds] = useState<Set<string>>(new Set());

  // AppConfig
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: ciclosData } = await supabase.from('ciclos_escolares').select('*').order('nombre', { ascending: false });
      if (ciclosData) setCiclos(ciclosData);
      
      const { data: empData } = await supabase.from('empleados').select('*').eq('estatus', 'activo').eq('firmante_boletas', true);
      if (empData) setEmpleados(empData);
      
      const config = await getAppConfig();
      if (config) setAppConfig(config);
      
      const { data: carrerasData } = await supabase.from('carreras').select('id, nombre, nivel_educativo').order('nombre');
      if (carrerasData) setCarreras(carrerasData);

      const { data: planesData } = await supabase.from('planes_estudio').select('id, carrera_id, tipo_periodo');
      if (planesData) setPlanesEstudio(planesData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedCicloId) {
      setLoadingGrupos(true);
      
      const fetchGrupos = supabase
        .from('grupos')
        .select('id, codigo_grupo, turno, ciclo_id')
        .eq('ciclo_id', selectedCicloId)
        .order('codigo_grupo', { ascending: true });
        
      const fetchInscripciones = supabase
        .from('inscripciones_academicas')
        .select('asignaturas(plan_id)')
        .eq('ciclo_id', selectedCicloId);
        
      Promise.all([fetchGrupos, fetchInscripciones]).then(([gruposRes, inscRes]) => {
        if (gruposRes.data) setGrupos(gruposRes.data);
        
        if (inscRes.data) {
           const activePlanes = new Set<string>();
           inscRes.data.forEach((d: any) => {
              const asig = Array.isArray(d.asignaturas) ? d.asignaturas[0] : d.asignaturas;
              if (asig?.plan_id) activePlanes.add(asig.plan_id);
           });
           setActivePlanIds(activePlanes);
        }
        
        setLoadingGrupos(false);
      });
    } else {
      setGrupos([]);
      setActivePlanIds(new Set());
    }
  }, [selectedCicloId]);

  useEffect(() => {
    if (selectedAlumnos.length > 0) {
      const fetchCiclos = async () => {
        const alumnosIds = selectedAlumnos.map(a => a.id);
        const { data } = await supabase.from('inscripciones_academicas').select('ciclo_id, ciclo_legado').in('alumno_id', alumnosIds);
        
        const validIds = new Set<string>();
        const validLegado = new Set<string>();
        
        data?.forEach(d => {
          if (d.ciclo_id) validIds.add(d.ciclo_id);
          if (d.ciclo_legado) validLegado.add(d.ciclo_legado.trim().toUpperCase());
        });

        // Identify allowed tipo_periodo from students
        const tiposPermitidos = new Set(selectedAlumnos.map(al => {
          const plan = al.programas?.find((p: any) => p.plan_id === al.selectedPlanId)?.planes_estudio;
          return plan?.tipo_periodo?.toUpperCase();
        }).filter(Boolean));
        
        const filtered = ciclos.filter(c => {
          if (tiposPermitidos.size > 0 && c.tipo_periodo && !tiposPermitidos.has(c.tipo_periodo.toUpperCase())) {
            return false;
          }
          return validIds.has(c.id) || validLegado.has(c.nombre.trim().toUpperCase());
        });
        
        // Ordenar de más reciente a más antiguo
        filtered.sort((a, b) => b.nombre.localeCompare(a.nombre));
        setCiclosDisponibles(filtered);
      };
      fetchCiclos();
    } else {
      setCiclosDisponibles([]);
    }
  }, [selectedAlumnos, ciclos]);

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 3) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('alumnos')
      .select('id, matricula, nombres, apellido_paterno, apellido_materno, nombre_completo, licenciatura, turno, estatus, alumno_programas(plan_id, estatus, planes_estudio(modelo, nombre, rvoe, tipo_periodo, carreras(nombre)))')
      .or(`nombre_completo.ilike.%${searchTerm.toUpperCase()}%,matricula.ilike.%${searchTerm}%`)
      .limit(20);
    
    if (error) {
      toast.error('Error buscando alumnos');
    } else {
      setAlumnosSearchResults((data || []).map((a: any) => ({ ...a, programas: a.alumno_programas })));
    }
    setLoading(false);
  };

  const fetchAll = async (queryFn: (start: number, end: number) => any) => {
    let allData: any[] = [];
    let start = 0;
    const limit = 1000;
    while (true) {
      const { data, error } = await queryFn(start, start + limit - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < limit) break;
      start += limit;
    }
    return { data: allData, error: null };
  };

  const handleLoadMasivo = async () => {
    if (!selectedCicloId) return toast.error('Selecciona un ciclo escolar');
    setLoadingGrupos(true);
    let alumnosData: any[] = [];
    let mapAlumnoPlan = new Map<string, string>();
    
    try {
      if (masivoType === 'ciclo') {
        const queryFn = (start: number, end: number) => supabase
          .from('inscripciones_academicas')
          .select('asignaturas(plan_id), alumnos(id, matricula, nombres, apellido_paterno, apellido_materno, nombre_completo, licenciatura, turno, estatus, alumno_programas(plan_id, estatus, planes_estudio(modelo, nombre, rvoe, tipo_periodo, carreras(nombre))))')
          .eq('ciclo_id', selectedCicloId)
          .range(start, end);
        
        const { data, error } = await fetchAll(queryFn);
          
        if (!error && data) {
           alumnosData = data.map(d => {
             const al = d.alumnos as any;
             let asig: any = d.asignaturas;
             if (Array.isArray(asig)) asig = asig[0];

             if (al && asig?.plan_id) {
               mapAlumnoPlan.set(al.id, asig.plan_id);
             }
             return al;
           }).filter(Boolean);
        }
      }
      else if (masivoType === 'carrera') {
        if (selectedCarreraIds.length === 0) {
          setLoadingGrupos(false);
          return toast.error('Selecciona una carrera');
        }
        
                const queryFn = (start: number, end: number) => supabase
          .from('inscripciones_academicas')
          .select(`
            asignaturas(plan_id),
            alumnos(id, matricula, nombres, apellido_paterno, apellido_materno, nombre_completo, licenciatura, turno, estatus, alumno_programas(plan_id, estatus, planes_estudio(modelo, nombre, rvoe, tipo_periodo, carreras(nombre))))
          `)
          .eq('ciclo_id', selectedCicloId)
          .range(start, end);
          
        const { data, error } = await fetchAll(queryFn);
          
        if (!error && data) {
           const queryProgsFn = (start: number, end: number) => supabase
             .from('alumno_programas')
             .select('alumno_id, planes_estudio!inner(carrera_id, id)')
             .in('planes_estudio.carrera_id', selectedCarreraIds)
             .range(start, end);
             
           const { data: progs } = await fetchAll(queryProgsFn);
           const validAlumnosIds = new Set(progs?.map(p => p.alumno_id) || []);
           const validPlanIds = new Set(progs?.map(p => (p as any).planes_estudio?.id) || []);
           
           alumnosData = data.map(d => {
             const al = d.alumnos as any;
             let asig: any = d.asignaturas;
             if (Array.isArray(asig)) asig = asig[0];
             
             // Si la inscripción actual no pertenece a las carreras seleccionadas, la omitimos
             if (!asig?.plan_id || !validPlanIds.has(asig.plan_id)) {
               return null;
             }
             
             if (al) {
               mapAlumnoPlan.set(al.id, asig.plan_id);
               al.programas = al.alumno_programas; 
             }
             return al; 
           }).flat().filter(Boolean);
        }
      }
      else if (masivoType === 'grupo') {
        if (selectedGrupoIds.length === 0) {
          setLoadingGrupos(false);
          return toast.error('Selecciona un grupo');
        }
        const { data, error } = await supabase
          .from('alumnos_grupos')
          .select('alumnos(id, matricula, nombres, apellido_paterno, apellido_materno, nombre_completo, licenciatura, turno, estatus, alumno_programas(plan_id, estatus, planes_estudio(modelo, nombre, rvoe, tipo_periodo, carreras(nombre))))')
          .in('grupo_id', selectedGrupoIds);
        if (!error && data) alumnosData = data.map(d => { const a = d.alumnos as any; if(a) a.programas = a.alumno_programas; return a; }).filter(Boolean);
      }

      if (alumnosData.length === 0) {
        toast.error('No se encontraron alumnos para esta selección');
        setLoadingGrupos(false);
        return;
      }

      const uniqueAlumnos = [];
      const ids = new Set();
      for (const a of alumnosData) {
        const estatus = a.estatus?.toLowerCase();
        if (!ids.has(a.id) && (estatus === 'activo' || estatus === 'egresado' || estatus === 'egresado titulado')) {
          ids.add(a.id);
          uniqueAlumnos.push(a);
        }
      }

      const { data: programas } = await supabase
        .from('alumno_programas')
        .select('alumno_id, plan_id, estatus, planes_estudio(nombre, rvoe, tipo_periodo, carreras(nombre))')
        .in('alumno_id', Array.from(ids));
        
      const fullAlumnos = uniqueAlumnos.map((alumno: any) => {
        let progs = programas?.filter(p => p.alumno_id === alumno.id) || [];
        let initialPlanId = mapAlumnoPlan.get(alumno.id);
        
        let cur = progs.filter(p => p.estatus === 'CURSANDO');
        if (cur.length === 0) cur = progs;
        
        if (!initialPlanId && cur.length > 0) {
           initialPlanId = cur[0].plan_id;
        }
        
        return {
          ...alumno,
          programas: cur,
          selectedPlanId: initialPlanId || null
        };
      });
      
      setSelectedAlumnos(fullAlumnos);
      toast.success(`Se prepararon ${fullAlumnos.length} alumnos`);
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || 'Error cargando alumnos');
    }
    setLoadingGrupos(false);
  };

  const toggleAlumno = async (alumno: any) => {
    // Individual mode only allows 1 student
    if (mode === 'individual') {
      const { data: programas } = await supabase
        .from('alumno_programas')
        .select('plan_id, estatus, planes_estudio(nombre, rvoe, tipo_periodo, carreras(nombre))')
        .eq('alumno_id', alumno.id);
      
      let allProgramas = programas || [];
      let cur = allProgramas.filter(p => p.estatus === 'CURSANDO');
      if (cur.length === 0) cur = allProgramas;
      
      const newAlumno = { 
        ...alumno, 
        programas: cur, 
        selectedPlanId: cur.length > 0 ? cur[0].plan_id : null 
      };
      
      setSelectedAlumnos([newAlumno]);
      setStep(3);
    }
  };

  const handleGenerate = async () => {
    if (selectedAlumnos.length === 0) return toast.error('Agrega al menos un alumno');
    if (!selectedCicloId) return toast.error('Selecciona el ciclo escolar');
    
    setLoading(true);
    const toastId = toast.loading('Recopilando calificaciones...');
    
    try {
      const cicloSeleccionado = ciclos.find(c => c.id === selectedCicloId);
      const firmante = empleados.find(e => e.id === selectedFirmanteId);

      const alumnosIds = selectedAlumnos.map(a => a.id);
      const queryFn = (start: number, end: number) => supabase
        .from('inscripciones_academicas')
        .select(`id, alumno_id, ciclo_id, ciclo_legado, asignatura_id, calificacion_final, estatus, asignaturas (nombre, clave_legado, creditos, numero_periodo, plan_id, planes_estudio (modelo))`)
        .in('alumno_id', alumnosIds)
        .range(start, end);

      const { data: todasInscripciones, error } = await fetchAll(queryFn);

      if (error) throw error;
      
      const inscripciones = (todasInscripciones || []).filter((ins: any) => 
        ins.ciclo_id === selectedCicloId || 
        (ins.ciclo_legado && cicloSeleccionado?.nombre && ins.ciclo_legado.trim().toUpperCase() === cicloSeleccionado.nombre.trim().toUpperCase())
      );

      if (!inscripciones || inscripciones.length === 0) {
        toast.error('No se encontraron calificaciones para estos alumnos en este ciclo.', { id: toastId });
        setLoading(false);
        return;
      }
      
      // Obtener el grupo del alumno en este ciclo
      const queryGruposFn = (start: number, end: number) => supabase
        .from('alumnos_grupos')
        .select(`alumno_id, grupos!inner(codigo_grupo, ciclo_id, grado)`)
        .in('alumno_id', alumnosIds)
        .eq('grupos.ciclo_id', selectedCicloId)
        .range(start, end);
      const { data: alumnosGruposData } = await fetchAll(queryGruposFn);
      
      const grupoMap = new Map();
      const gradoMap = new Map();
      if (alumnosGruposData) {
         alumnosGruposData.forEach((ag: any) => {
            if (ag.grupos) {
               grupoMap.set(ag.alumno_id, ag.grupos.codigo_grupo);
               gradoMap.set(ag.alumno_id, ag.grupos.grado);
            }
         });
      }
      // Obtener historial completo para calcular cuatrimestre cronologico
      const queryHistorialFn = (start: number, end: number) => supabase
        .from('inscripciones_academicas')
        .select('alumno_id, ciclo_legado, ciclo_id')
        .in('alumno_id', alumnosIds)
        .range(start, end);
      const { data: historialData } = await fetchAll(queryHistorialFn);
        
      const gradosCronologicos = new Map();
      if (historialData) {
         alumnosIds.forEach(id => {
            const insAlumno = historialData.filter(h => h.alumno_id === id);
            const uniqueCiclos = new Set<string>();
            insAlumno.forEach(ins => {
               let nombreCiclo = ins.ciclo_legado;
               if (!nombreCiclo && ins.ciclo_id) {
                 const c = ciclos.find(c => c.id === ins.ciclo_id);
                 if (c) nombreCiclo = c.nombre;
               }
               if (nombreCiclo && nombreCiclo !== '-' && !nombreCiclo.toUpperCase().includes('EXT')) {
                  uniqueCiclos.add(nombreCiclo.trim());
               }
            });
            const sortedCiclos = Array.from(uniqueCiclos).sort((a, b) => getCicloWeight(a) - getCicloWeight(b));
            const currentCicloStr = cicloSeleccionado?.nombre?.trim();
            if (currentCicloStr) {
               const idx = sortedCiclos.findIndex(c => c.toUpperCase() === currentCicloStr.toUpperCase());
               if (idx !== -1) {
                  gradosCronologicos.set(id, idx + 1);
               }
            }
         });
      }
      
      
      const alumnosParaBoleta = selectedAlumnos.map(al => {
         const insAlumno = inscripciones.filter((ins: any) => ins.alumno_id === al.id);
         let activePlanId = al.selectedPlanId;
         if (insAlumno.length > 0 && insAlumno[0].asignaturas) {
            const asig: any = Array.isArray(insAlumno[0].asignaturas) ? insAlumno[0].asignaturas[0] : insAlumno[0].asignaturas;
            if (asig?.plan_id) activePlanId = asig.plan_id;
         }

         const plan = al.programas?.find((p: any) => p.plan_id === activePlanId)?.planes_estudio;
         let carreraName = null;
         if (plan?.carreras) {
           carreraName = Array.isArray(plan.carreras) ? plan.carreras[0]?.nombre : plan.carreras.nombre;
         }
         
         let modelo = plan?.modelo;
         if (!modelo && insAlumno.length > 0 && insAlumno[0].asignaturas) {
            const asig: any = Array.isArray(insAlumno[0].asignaturas) ? insAlumno[0].asignaturas[0] : insAlumno[0].asignaturas;
            if (asig?.planes_estudio?.modelo) modelo = asig.planes_estudio.modelo;
         }
         
         return {
            ...al,
            selectedPlanId: activePlanId,
            licenciatura: carreraName || plan?.nombre || al.licenciatura,
            rvoe: plan?.rvoe || '',
            tipo_periodo: plan?.tipo_periodo || '',
            grupo: grupoMap.get(al.id) || 'S/A',
            grado_grupo: (modelo === 'FLEXIBLE' && gradosCronologicos.has(al.id)) ? gradosCronologicos.get(al.id) : gradoMap.get(al.id)
         };
      });

      const htmlContent = renderBoletasHTML({
        alumnos: alumnosParaBoleta,
        inscripciones: inscripciones as any[],
        ciclo: cicloSeleccionado as CicloEscolar,
        config: appConfig,
        firmante: firmante,
        opciones: {
          copias: formatoCopia === '2' ? 2 : 1,
          incluirSello,
          incluirFirma
        }
      });
      
      toast.success('Generación completada', { id: toastId });
      
      // Abrir ventana de impresión
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 1000); // Esperar a que carguen imágenes
      } else {
        toast.error('El navegador bloqueó la ventana emergente', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Error generando boletas: ' + err.message, { id: toastId });
    }
    setLoading(false);
  };

  const handleGenerateZip = async () => {
    if (selectedAlumnos.length === 0) return toast.error('Agrega al menos un alumno');
    if (!selectedCicloId) return toast.error('Selecciona el ciclo escolar');
    
    setLoading(true);
    setZipProgress({ current: 0, total: selectedAlumnos.length, status: 'Recopilando calificaciones...' });
    
    try {
      const cicloSeleccionado = ciclos.find(c => c.id === selectedCicloId);
      const firmante = empleados.find(e => e.id === selectedFirmanteId);
      const alumnosIds = selectedAlumnos.map(a => a.id);
      const queryFn = (start: number, end: number) => supabase
        .from('inscripciones_academicas')
        .select(`id, alumno_id, ciclo_id, ciclo_legado, asignatura_id, calificacion_final, estatus, asignaturas (nombre, clave_legado, creditos, numero_periodo, plan_id, planes_estudio (modelo))`)
        .in('alumno_id', alumnosIds)
        .eq('ciclo_id', selectedCicloId)
        .range(start, end);

      const { data: inscripciones, error } = await fetchAll(queryFn);

      if (error) throw error;

      if (!inscripciones || inscripciones.length === 0) {
        toast.error('No se encontraron calificaciones para estos alumnos en este ciclo.');
        setLoading(false);
        setZipProgress({ current: 0, total: 0, status: '' });
        return;
      }
      
      // Obtener el grupo del alumno en este ciclo
      const queryGruposFn = (start: number, end: number) => supabase
        .from('alumnos_grupos')
        .select(`alumno_id, grupos!inner(codigo_grupo, ciclo_id, grado)`)
        .in('alumno_id', alumnosIds)
        .eq('grupos.ciclo_id', selectedCicloId)
        .range(start, end);
      const { data: alumnosGruposData } = await fetchAll(queryGruposFn);
      
      const grupoMap = new Map();
      const gradoMap = new Map();
      if (alumnosGruposData) {
         alumnosGruposData.forEach((ag: any) => {
            if (ag.grupos) {
               grupoMap.set(ag.alumno_id, ag.grupos.codigo_grupo);
               gradoMap.set(ag.alumno_id, ag.grupos.grado);
            }
         });
      }
      // Obtener historial completo para calcular cuatrimestre cronologico
      const queryHistorialFn = (start: number, end: number) => supabase
        .from('inscripciones_academicas')
        .select('alumno_id, ciclo_legado, ciclo_id')
        .in('alumno_id', alumnosIds)
        .range(start, end);
      const { data: historialData } = await fetchAll(queryHistorialFn);
        
      const gradosCronologicos = new Map();
      if (historialData) {
         alumnosIds.forEach(id => {
            const insAlumno = historialData.filter(h => h.alumno_id === id);
            const uniqueCiclos = new Set<string>();
            insAlumno.forEach(ins => {
               let nombreCiclo = ins.ciclo_legado;
               if (!nombreCiclo && ins.ciclo_id) {
                 const c = ciclos.find(c => c.id === ins.ciclo_id);
                 if (c) nombreCiclo = c.nombre;
               }
               if (nombreCiclo && nombreCiclo !== '-' && !nombreCiclo.toUpperCase().includes('EXT')) {
                  uniqueCiclos.add(nombreCiclo.trim());
               }
            });
            const sortedCiclos = Array.from(uniqueCiclos).sort((a, b) => getCicloWeight(a) - getCicloWeight(b));
            const currentCicloStr = cicloSeleccionado?.nombre?.trim();
            if (currentCicloStr) {
               const idx = sortedCiclos.findIndex(c => c.toUpperCase() === currentCicloStr.toUpperCase());
               if (idx !== -1) {
                  gradosCronologicos.set(id, idx + 1);
               }
            }
         });
      }
      
      
      const alumnosParaBoleta = selectedAlumnos.map(al => {
         const insAlumno = inscripciones.filter((ins: any) => ins.alumno_id === al.id);
         let activePlanId = al.selectedPlanId;
         if (insAlumno.length > 0 && insAlumno[0].asignaturas) {
            const asig: any = Array.isArray(insAlumno[0].asignaturas) ? insAlumno[0].asignaturas[0] : insAlumno[0].asignaturas;
            if (asig?.plan_id) {
               activePlanId = asig.plan_id;
            }
         }

         const plan = al.programas?.find((p: any) => p.plan_id === activePlanId)?.planes_estudio;
         let carreraName = null;
         if (plan?.carreras) {
           carreraName = Array.isArray(plan.carreras) ? plan.carreras[0]?.nombre : plan.carreras.nombre;
         }
         
         let modelo = plan?.modelo;
         if (!modelo && insAlumno.length > 0 && insAlumno[0].asignaturas) {
            const asig: any = Array.isArray(insAlumno[0].asignaturas) ? insAlumno[0].asignaturas[0] : insAlumno[0].asignaturas;
            if (asig?.planes_estudio?.modelo) modelo = asig.planes_estudio.modelo;
         }
         
         return {
            ...al,
            selectedPlanId: activePlanId,
            licenciatura: carreraName || plan?.nombre || al.licenciatura,
            rvoe: plan?.rvoe || '',
            tipo_periodo: plan?.tipo_periodo || '',
            grupo: grupoMap.get(al.id) || 'S/A',
            grado_grupo: (modelo === 'FLEXIBLE' && gradosCronologicos.has(al.id)) ? gradosCronologicos.get(al.id) : gradoMap.get(al.id)
         };
      });

      const { generateBoletasZip } = await import('../../utils/boletasExportUtils');

      let customFilename = `Boletas_Ciclo_${cicloSeleccionado?.nombre || 'General'} (${alumnosParaBoleta.length}).zip`;
      let folderByOption: 'carrera' | 'grupo' | 'none' = 'none';

      if (masivoType === 'grupo' && selectedGrupoIds.length > 0) {
         folderByOption = 'grupo';
         if (selectedGrupoIds.length === 1) {
           const g = grupos.find(gr => gr.id === selectedGrupoIds[0]);
           if (g) {
              customFilename = `Boletas_${g.codigo_grupo}_${cicloSeleccionado?.nombre} (${alumnosParaBoleta.length}).zip`;
           }
         } else {
           customFilename = `Boletas_MultiplesGrupos_${cicloSeleccionado?.nombre} (${alumnosParaBoleta.length}).zip`;
         }
      } else if (masivoType === 'carrera' && selectedCarreraIds.length > 0) {
         folderByOption = 'carrera';
         if (selectedCarreraIds.length === 1) {
           const c = carreras.find(c => c.id === selectedCarreraIds[0]);
           if (c) {
              const safeLic = c.nombre.replace(/\\s+/g, '_');
              customFilename = `Boletas_${safeLic}_${cicloSeleccionado?.nombre} (${alumnosParaBoleta.length}).zip`;
           }
         } else {
           customFilename = `Boletas_MultiplesLicenciaturas_${cicloSeleccionado?.nombre} (${alumnosParaBoleta.length}).zip`;
         }
      }

      await generateBoletasZip({
        alumnos: alumnosParaBoleta,
        inscripciones: inscripciones as any[],
        ciclo: cicloSeleccionado as CicloEscolar,
        config: appConfig,
        firmante: firmante,
        opciones: {
          copias: formatoCopia === '2' ? 2 : 1,
          incluirSello,
          incluirFirma,
          filename: customFilename,
          folderBy: folderByOption
        },
        onProgress: (current, total, status) => {
          setZipProgress({ current, total, status });
        }
      });
      
      toast.success('Descarga de ZIP completada exitosamente');
    } catch (err: any) {
      toast.error('Error generando ZIP: ' + err.message);
    }
    setLoading(false);
    setZipProgress({ current: 0, total: 0, status: '' });
  };

  const handleGenerateIndividualPDF = async () => {
    if (selectedAlumnos.length === 0) return toast.error('Agrega al menos un alumno');
    if (!selectedCicloId) return toast.error('Selecciona el ciclo escolar');
    
    setLoading(true);
    setZipProgress({ current: 0, total: 1, status: 'Preparando PDF...' });
    
    try {
      const cicloSeleccionado = ciclos.find(c => c.id === selectedCicloId);
      const firmante = empleados.find(e => e.id === selectedFirmanteId);
      const alumnosIds = selectedAlumnos.map(a => a.id);
      const { data: todasInscripciones, error } = await supabase
        .from('inscripciones_academicas')
        .select(`id, alumno_id, ciclo_id, ciclo_legado, asignatura_id, calificacion_final, estatus, asignaturas (nombre, clave_legado, creditos, numero_periodo, plan_id, planes_estudio (modelo))`)
        .in('alumno_id', alumnosIds);

      if (error) throw error;
      
      const inscripciones = (todasInscripciones || []).filter(ins => 
        ins.ciclo_id === selectedCicloId || 
        (ins.ciclo_legado && cicloSeleccionado?.nombre && ins.ciclo_legado.trim().toUpperCase() === cicloSeleccionado.nombre.trim().toUpperCase())
      );

      if (!inscripciones || inscripciones.length === 0) {
        toast.error('No se encontraron calificaciones para este alumno en este ciclo.');
        setLoading(false);
        setZipProgress({ current: 0, total: 0, status: '' });
        return;
      }
      
      // Obtener el grupo del alumno en este ciclo
      const queryGruposFn = (start: number, end: number) => supabase
        .from('alumnos_grupos')
        .select(`alumno_id, grupos!inner(codigo_grupo, ciclo_id, grado)`)
        .in('alumno_id', alumnosIds)
        .eq('grupos.ciclo_id', selectedCicloId)
        .range(start, end);
      const { data: alumnosGruposData } = await fetchAll(queryGruposFn);
      
      const grupoMap = new Map();
      const gradoMap = new Map();
      if (alumnosGruposData) {
         alumnosGruposData.forEach((ag: any) => {
            if (ag.grupos) {
               grupoMap.set(ag.alumno_id, ag.grupos.codigo_grupo);
               gradoMap.set(ag.alumno_id, ag.grupos.grado);
            }
         });
      }
      // Obtener historial completo para calcular cuatrimestre cronologico
      const queryHistorialFn = (start: number, end: number) => supabase
        .from('inscripciones_academicas')
        .select('alumno_id, ciclo_legado, ciclo_id')
        .in('alumno_id', alumnosIds)
        .range(start, end);
      const { data: historialData } = await fetchAll(queryHistorialFn);
        
      const gradosCronologicos = new Map();
      if (historialData) {
         alumnosIds.forEach(id => {
            const insAlumno = historialData.filter(h => h.alumno_id === id);
            const uniqueCiclos = new Set<string>();
            insAlumno.forEach(ins => {
               let nombreCiclo = ins.ciclo_legado;
               if (!nombreCiclo && ins.ciclo_id) {
                 const c = ciclos.find(c => c.id === ins.ciclo_id);
                 if (c) nombreCiclo = c.nombre;
               }
               if (nombreCiclo && nombreCiclo !== '-' && !nombreCiclo.toUpperCase().includes('EXT')) {
                  uniqueCiclos.add(nombreCiclo.trim());
               }
            });
            const sortedCiclos = Array.from(uniqueCiclos).sort((a, b) => getCicloWeight(a) - getCicloWeight(b));
            const currentCicloStr = cicloSeleccionado?.nombre?.trim();
            if (currentCicloStr) {
               const idx = sortedCiclos.findIndex(c => c.toUpperCase() === currentCicloStr.toUpperCase());
               if (idx !== -1) {
                  gradosCronologicos.set(id, idx + 1);
               }
            }
         });
      }
      
      
      const alumnosParaBoleta = selectedAlumnos.map(al => {
         const insAlumno = inscripciones.filter((ins: any) => ins.alumno_id === al.id);
         let activePlanId = al.selectedPlanId;
         if (insAlumno.length > 0 && insAlumno[0].asignaturas) {
            const asig: any = Array.isArray(insAlumno[0].asignaturas) ? insAlumno[0].asignaturas[0] : insAlumno[0].asignaturas;
            if (asig?.plan_id) activePlanId = asig.plan_id;
         }

         const plan = al.programas?.find((p: any) => p.plan_id === activePlanId)?.planes_estudio;
         let carreraName = null;
         if (plan?.carreras) {
           carreraName = Array.isArray(plan.carreras) ? plan.carreras[0]?.nombre : plan.carreras.nombre;
         }
         
         let modelo = plan?.modelo;
         if (!modelo && insAlumno.length > 0 && insAlumno[0].asignaturas) {
            const asig: any = Array.isArray(insAlumno[0].asignaturas) ? insAlumno[0].asignaturas[0] : insAlumno[0].asignaturas;
            if (asig?.planes_estudio?.modelo) modelo = asig.planes_estudio.modelo;
         }
         
         return {
            ...al,
            selectedPlanId: activePlanId,
            licenciatura: carreraName || plan?.nombre || al.licenciatura,
            rvoe: plan?.rvoe || '',
            tipo_periodo: plan?.tipo_periodo || '',
            grupo: grupoMap.get(al.id) || 'S/A',
            grado_grupo: (modelo === 'FLEXIBLE' && gradosCronologicos.has(al.id)) ? gradosCronologicos.get(al.id) : gradoMap.get(al.id)
         };
      });

      const { generateSingleBoletaPDF } = await import('../../utils/boletasExportUtils');

      await generateSingleBoletaPDF({
        alumnos: alumnosParaBoleta,
        inscripciones: inscripciones as any[],
        ciclo: cicloSeleccionado as CicloEscolar,
        config: appConfig,
        firmante: firmante,
        opciones: {
          copias: formatoCopia === '2' ? 2 : 1,
          incluirSello,
          incluirFirma
        },
        onProgress: (current, total, status) => {
          setZipProgress({ current, total, status });
        }
      });
      
      toast.success('PDF descargado exitosamente');
    } catch (err: any) {
      toast.error('Error generando PDF: ' + err.message);
    }
    setLoading(false);
    setZipProgress({ current: 0, total: 0, status: '' });
  };

  const cicloSeleccionado = ciclos.find(c => c.id === selectedCicloId);
  const tipoPeriodoCiclo = cicloSeleccionado?.tipo_periodo?.toUpperCase() || '';
  
  const carrerasFiltradas = carreras.filter(c => {
     if (activePlanIds.size > 0) {
        // Excluir si la carrera no tiene ningun plan con inscripciones activas en este ciclo
        const hasActivePlan = planesEstudio.some(p => p.carrera_id === c.id && activePlanIds.has(p.id));
        if (!hasActivePlan) return false;
     }
     if (!tipoPeriodoCiclo) return true;
     return planesEstudio.some(p => p.carrera_id === c.id && p.tipo_periodo?.toUpperCase() === tipoPeriodoCiclo);
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1c2228] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
            <FileText className="text-emerald-600 dark:text-emerald-400" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Generador de Boletas</h2>
            <p className="text-gray-500 dark:text-gray-400">Paso {step} de 4</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
                {step === 1 && (
          <div className="flex flex-col items-center justify-center h-[500px] space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">¿Qué modalidad de impresión deseas?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
              <button 
                onClick={() => { setMode('individual'); setStep(2); }}
                className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
              >
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800/50">
                  <UserPlus size={32} className="text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Individual</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Genera la boleta de un solo alumno específico buscándolo por nombre o matrícula.</p>
              </button>

              <button 
                onClick={() => { setMode('masivo'); setStep(2); }}
                className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
              >
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800/50">
                  <Printer size={32} className="text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Masivo</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Genera decenas de boletas al mismo tiempo filtrando por ciclo, carrera o grupo.</p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && mode === 'individual' && (
          <div className="max-w-2xl mx-auto space-y-6 py-4 h-[500px] flex flex-col">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setStep(1)} className="text-gray-500 hover:text-emerald-600"><ChevronLeft size={24} /></button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Búsqueda Individual</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ingresa Nombre o Matrícula..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
              />
              <button onClick={handleSearch} disabled={loading} className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">
                Buscar
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700 p-2">
              {alumnosSearchResults.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-gray-400">Realiza una búsqueda para continuar</div>
              ) : (
                alumnosSearchResults.map(al => (
                  <div key={al.id} className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 mb-2 rounded-lg shadow-sm">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">{al.nombres} {al.apellido_paterno} {al.apellido_materno}</div>
                      <div className="text-sm text-gray-500">{al.matricula} - {al.licenciatura}</div>
                    </div>
                    <button 
                      onClick={() => toggleAlumno(al)}
                      className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg font-medium transition-colors"
                    >
                      Seleccionar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 2 && mode === 'masivo' && (
          <div className="max-w-3xl mx-auto space-y-6 py-4">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setStep(1)} className="text-gray-500 hover:text-emerald-600"><ChevronLeft size={24} /></button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Selección Masiva</h3>
            </div>
            
            <div className="bg-white dark:bg-[#252d36] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6 min-h-[450px]">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">1. Selecciona el Ciclo Escolar</label>
                <div className="relative" ref={cicloMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowCicloMenu(prev => !prev)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 flex justify-between items-center"
                  >
                    <span>
                      {selectedCicloId 
                        ? (() => {
                            const c = ciclos.find(x => x.id === selectedCicloId);
                            return c ? `${c.nombre} ${c.tipo_periodo ? `(${c.tipo_periodo})` : ''}` : '-- Elija un Ciclo --';
                          })()
                        : '-- Elija un Ciclo --'}
                    </span>
                    <ChevronDown size={18} className={`transition-transform duration-200 ${showCicloMenu ? 'rotate-180' : ''} text-gray-500`} />
                  </button>

                  <AnimatePresence>
                    {showCicloMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#252d36] rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 flex flex-col"
                      >
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
                          <input
                            type="text"
                            placeholder="Buscar ciclo..."
                            autoFocus
                            className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700 dark:text-gray-300 placeholder-gray-400"
                            onChange={(e) => {
                              const q = e.target.value.toLowerCase();
                              const items = document.querySelectorAll('[data-wizard-ciclo-item]');
                              items.forEach((el) => {
                                const name = el.getAttribute('data-wizard-ciclo-item') || '';
                                (el as HTMLElement).style.display = name.includes(q) ? '' : 'none';
                              });
                            }}
                          />
                        </div>

                        <div className="overflow-y-auto max-h-64 py-1 custom-scrollbar">
                          {[...ciclos]
                            .sort((a, b) => {
                              const anioA = a.anio || 0;
                              const anioB = b.anio || 0;
                              if (anioB !== anioA) return anioB - anioA;
                              return b.nombre.localeCompare(a.nombre);
                            })
                            .map(c => {
                              const isActive = c.id === selectedCicloId;
                              const label = `${c.nombre} ${c.tipo_periodo ? `(${c.tipo_periodo})` : ''}`;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  data-wizard-ciclo-item={label.toLowerCase()}
                                  onClick={() => {
                                    setSelectedCicloId(c.id);
                                    setSelectedCarreraIds([]);
                                    setSelectedGrupoIds([]);
                                    setShowCicloMenu(false);
                                  }}
                                  className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between transition-colors
                                    ${isActive 
                                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                  <span>{label}</span>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    {isActive && <CheckCircle size={16} />}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {selectedCicloId && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">2. ¿Qué deseas imprimir?</label>
                  <div className="flex gap-4 mb-6">
                    {(['ciclo', 'carrera', 'grupo'] as const).map(type => (
                      <button 
                        key={type}
                        onClick={() => setMasivoType(type)}
                        className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all border ${masivoType === type ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
                      >
                        {type === 'ciclo' ? 'Todo el Ciclo' : type === 'carrera' ? 'Por Carrera' : 'Por Grupo'}
                      </button>
                    ))}
                  </div>

                  {masivoType === 'carrera' && (
                    <div className="mb-6 animate-fadeIn">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Selecciona la Carrera</label>
                        <div className="space-x-3">
                          <button type="button" onClick={() => setSelectedCarreraIds(carrerasFiltradas.map(c => c.id))} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">Seleccionar Todas</button>
                          <button type="button" onClick={() => setSelectedCarreraIds([])} className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline">Deseleccionar</button>
                        </div>
                      </div>
                      <div className="w-full max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-2 space-y-1">
                        {carrerasFiltradas.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 p-2">No hay carreras disponibles</p>}
                        {carrerasFiltradas.map(c => (
                          <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedCarreraIds.includes(c.id)} 
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCarreraIds([...selectedCarreraIds, c.id]);
                                else setSelectedCarreraIds(selectedCarreraIds.filter(id => id !== c.id));
                              }}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" 
                            />
                            <span className="text-sm text-gray-800 dark:text-gray-200">{c.nombre} ({c.nivel_educativo})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {masivoType === 'grupo' && (
                    <div className="mb-6 animate-fadeIn">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Selecciona el Grupo</label>
                        <div className="space-x-3">
                          <button type="button" onClick={() => setSelectedGrupoIds(grupos.filter(g => g.ciclo_id === selectedCicloId).map(g => g.id))} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">Seleccionar Todos</button>
                          <button type="button" onClick={() => setSelectedGrupoIds([])} className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline">Deseleccionar</button>
                        </div>
                      </div>
                      <div className="w-full max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl p-2 space-y-1">
                        {grupos.filter(g => g.ciclo_id === selectedCicloId).length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 p-2">No hay grupos disponibles</p>}
                        {grupos.filter(g => g.ciclo_id === selectedCicloId).map(g => (
                          <label key={g.id} className="flex items-center gap-3 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedGrupoIds.includes(g.id)} 
                              onChange={(e) => {
                                if (e.target.checked) setSelectedGrupoIds([...selectedGrupoIds, g.id]);
                                else setSelectedGrupoIds(selectedGrupoIds.filter(id => id !== g.id));
                              }}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" 
                            />
                            <span className="text-sm text-gray-800 dark:text-gray-200">{g.codigo_grupo} ({g.turno})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleLoadMasivo}
                    disabled={loadingGrupos}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50 text-lg"
                  >
                    {loadingGrupos ? 'Buscando Alumnos...' : 'Preparar Boletas'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            <div className="flex items-center gap-4 mb-2">
              <button onClick={() => setStep(2)} className="text-gray-500 hover:text-emerald-600"><ChevronLeft size={24} /></button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configuración del Documento</h3>
            </div>
            <div className="bg-white dark:bg-[#252d36] p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
              
              <div className="space-y-4">
                {mode === 'individual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ciclo Escolar a Imprimir</label>
                    <select 
                      value={selectedCicloId} 
                      onChange={e => setSelectedCicloId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Selecciona el Ciclo --</option>
                      {ciclosDisponibles.map(c => (
                         <option key={c.id} value={c.id}>
                           {c.nombre} {c.tipo_periodo ? `(${c.tipo_periodo})` : ''}
                         </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Formato de Impresión</label>
                  <select 
                    value={formatoCopia} 
                    onChange={e => setFormatoCopia(e.target.value as '1'|'2')}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1">1 Copia por Hoja (Solo Original)</option>
                    <option value="2">2 Copias por Hoja (Original y Acuse)</option>
                  </select>
                  {formatoCopia === '2' && (
                    <p className="text-xs text-amber-600 mt-2">NOTA: El acuse y el original se acomodarán perfectamente en una hoja Carta Vertical.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Firmante Autorizado</label>
                  <select 
                    value={selectedFirmanteId} 
                    onChange={e => setSelectedFirmanteId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Selecciona un Firmante --</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellido_paterno}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={incluirSello} 
                      onChange={e => setIncluirSello(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Incluir Sello Institucional (Si está configurado)</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={incluirFirma} 
                      onChange={e => setIncluirFirma(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Incluir Firma del Empleado (Si la tiene subida)</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setStep(4)}
                disabled={mode === 'individual' && !selectedCicloId}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 text-lg shadow-md"
              >
                Continuar <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center justify-center h-[500px] text-center max-w-md mx-auto">
            {zipProgress.total > 0 ? (
              <div className="w-full space-y-4">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{mode === 'individual' ? 'Generando PDF Individual...' : 'Generando Archivo ZIP...'}</h3>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {mode === 'individual' ? 'Procesando Documento' : (zipProgress.current > 0 ? `Boleta ${zipProgress.current} de ${zipProgress.total}` : 'Preparando...')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate px-4">
                  {zipProgress.status}
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${zipProgress.current > 0 ? (zipProgress.current / zipProgress.total) * 100 : 5}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-4 italic">Por favor no cierres esta pestaña hasta que finalice la descarga.</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                  <Printer size={40} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Listo para Generar</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                  {mode === 'individual' ? 'Se generará la boleta para el alumno seleccionado.' : `Se generarán boletas para ${selectedAlumnos.length} alumnos.`}
                </p>
                
                <div className="flex flex-col gap-3 w-full">
                  {mode === 'individual' ? (
                    <>
                      <button 
                        onClick={handleGenerate}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 w-full"
                      >
                        {loading && !zipProgress.total ? 'Generando...' : 'Previsualizar / Imprimir'}
                      </button>
                      <button 
                        onClick={handleGenerateIndividualPDF}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 w-full"
                      >
                        {loading && zipProgress.total ? 'Generando PDF...' : 'Descargar PDF Directo'}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={handleGenerateZip}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm hover:shadow transition-all disabled:opacity-50 w-full"
                    >
                      {loading ? 'Generando...' : 'Descargar ZIP (PDFs Individuales)'}
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setStep(3)}
                    disabled={loading}
                    className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 w-full mt-2"
                  >
                    Regresar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
