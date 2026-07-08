import React, { useState } from 'react';
import { X, Loader2, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const BATCH_SIZE = 500;

export default function ModalSincronizacionAcademica({ isOpen, onClose }: Props) {
  const [sincronizando, setSincronizando] = useState(false);
  const [log, setLog] = useState('');

  const appendLog = (msg: string) => {
    setLog(prev => prev + msg + '\n');
    console.log(msg);
  };

  const iniciarSincronizacion = async () => {
    setSincronizando(true);
    setLog('');
    appendLog('Iniciando sincronización académica desde el frontend...');

    const fetchAll = async (table: string, select: string, notNullColumn?: string) => {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        let query = supabase.from(table).select(select).range(from, from + step - 1);
        if (notNullColumn) query = query.not(notNullColumn, 'is', null);
        const { data, error } = await query;
        if (error) {
          appendLog(`[Error] fetchAll en ${table}: ${error.message}`);
          break;
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < step) break;
        from += step;
      }
      return allData;
    };

    
    try {
      const baseUrl = (import.meta.env.VITE_GES_API_URL || 'http://localhost:3001').trim().replace(/\/$/, '');
      
      // ==========================================
      // 1. MIGRAR DOCENTES
      // ==========================================
      appendLog('\n--- Obteniendo Docentes de Firebird ---');
      const resDocentes = await fetch(`${baseUrl}/api/legacy/academico/profesores`);
      if (!resDocentes.ok) {
        const errBody = await resDocentes.json().catch(() => ({ error: resDocentes.statusText }));
        throw new Error(`Error obteniendo profesores: ${errBody.error || resDocentes.statusText}`);
      }
      const dataDocentes = await resDocentes.json();
      
      appendLog(`Se encontraron ${dataDocentes.length} docentes. Insertando en Supabase...`);
      const docentesPayload = dataDocentes.map((row: any) => ({
        clave_legado: row.CLAVE,
        nombre_completo: row.NOMBRE_COMPLETO || '',
        rfc: row.RFC,
        curp: row.CURP,
        email: row.EMAIL || null,
        estatus: (row.ACTIVO === 'A' || row.ACTIVO === 'S') ? 'activo' : 'inactivo'
      }));

      for (let i = 0; i < docentesPayload.length; i += BATCH_SIZE) {
        const batch = docentesPayload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('docentes').upsert(batch, { onConflict: 'clave_legado' });
        if (error) appendLog(`[Error] Batch docentes: ${error.message}`);
      }
      appendLog('✓ Docentes sincronizados.');

      // ==========================================
      // 2. MIGRAR GRUPOS
      // ==========================================
      appendLog('\n--- Obteniendo Grupos de Firebird ---');
      const resGrupos = await fetch(`${baseUrl}/api/legacy/academico/grupos`);
      if (!resGrupos.ok) throw new Error('Error obteniendo grupos');
      const dataGrupos = await resGrupos.json();

      appendLog('Cargando diccionarios de Ciclos y Planes de Estudio...');
      const ciclosDb = await fetchAll('ciclos_escolares', 'id, anio, anio_fin, nombre, tipo_periodo');
      const planesDb = await fetchAll('planes_estudio', 'id, nombre, clave_legado');

      const ciclos = ciclosDb || [];
      const planes = planesDb || [];

      // Resolver ciclo usando nombre + tipo_periodo (Semestral/Cuatrimestral)
      const resolveCicloId = (row: any) => {
        // 1. Construir nombre del ciclo
        let nombreCiclo = '';
        if (row.CODIGO_CORTO) {
          const partes = row.CODIGO_CORTO.split('/');
          if (partes.length === 2 && partes[0].length === 2) {
            nombreCiclo = `20${partes[0]}-${partes[1]}`;
          }
        }
        if (!nombreCiclo) {
          const ini = Number(row.INICIAL);
          const fin = Number(row.FINAL);
          const per = Number(row.PERIODO);
          if (per === 1) nombreCiclo = `${fin}-1`;
          else if (per === 2) nombreCiclo = `${ini}-2`;
          else if (per === 3) nombreCiclo = `${ini}-3`;
          else if (per === 0) nombreCiclo = `${ini}-1`;
        }
        
        // 2. Determinar tipo_periodo desde DENOM_PERIODO de Firebird
        const denom = (row.DENOM_PERIODO || '').trim().toLowerCase();
        const tipoPeriodo = denom === 'cuatrimestre' ? 'Cuatrimestral' : 'Semestral';
        
        // 3. Buscar por nombre + tipo_periodo (match exacto)
        const matchExacto = ciclos.find(c => c.nombre === nombreCiclo && c.tipo_periodo === tipoPeriodo);
        if (matchExacto) return matchExacto.id;
        
        // 4. Fallback: buscar solo por nombre (para ciclos viejos que no tienen duplicado)
        const matchFallback = ciclos.find(c => c.nombre === nombreCiclo);
        return matchFallback ? matchFallback.id : null;
      };

      // Mapa NIVEL -> sufijo de clave_legado para opción A
      const MAPA_PLAN_NIVEL: Record<string, string> = {
        'LP': '_LP', 'LM': '_LM', 'LD': '_LD',
        'LCP': '_LCP', 'LA': '_LA', 'LSP': '_LSP',
        'ESPDU': '_ESPDU', 'ESPAN': '_ESPAN',
        'ESPDP': '_ESPDP'
      };

      // Resolver plan usando ID_PLAN o fallback Opción A con NIVEL
      const resolvePlanId = (row: any) => {
        if (row.ID_PLAN) {
          const match = planes.find(p => p.clave_legado?.trim() === row.ID_PLAN?.trim());
          if (match) return match.id;
        }
        if (row.NIVEL) {
          const sufijo = MAPA_PLAN_NIVEL[row.NIVEL?.toUpperCase()] || `_${row.NIVEL?.toUpperCase()}`;
          const match = planes.find(p => p.clave_legado?.toUpperCase().includes(sufijo));
          if (match) return match.id;
        }
        return planes.length > 0 ? planes[0].id : null;
      };

      appendLog(`Se encontraron ${dataGrupos.length} grupos. Resolviendo IDs e insertando...`);
      const gruposPayload = [];
      const gruposUnicos = new Map();
      let gruposSkipped = 0;
      for (const row of dataGrupos) {
        const ciclo_id = resolveCicloId(row);
        const plan_id = resolvePlanId(row);

        if (ciclo_id && plan_id) {
          const key = `${row.GRUPO}_${ciclo_id}`;
          if (!gruposUnicos.has(key)) {
            gruposUnicos.set(key, true);
            
            let parsedTurno = row.TURNO;
            if (parsedTurno === 'MA') parsedTurno = 'Matutino';
            else if (parsedTurno === 'VE') {
              if (row.GRUPO && row.GRUPO.toUpperCase().includes('MIX')) {
                parsedTurno = 'Mixto';
              } else {
                parsedTurno = 'Vespertino';
              }
            }
            
            gruposPayload.push({
              codigo_grupo: row.GRUPO,
              ciclo_id,
              plan_id,
              grado: Number(row.GRADO) || null,
              turno: parsedTurno,
              estatus: 'activo'
            });
          }
        } else {
          gruposSkipped++;
        }
      }

      for (let i = 0; i < gruposPayload.length; i += BATCH_SIZE) {
        const batch = gruposPayload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('grupos').upsert(batch, { onConflict: 'codigo_grupo,ciclo_id' });
        if (error) appendLog(`[Error] Batch grupos: ${error.message}`);
      }
      appendLog(`✓ Grupos sincronizados (${gruposPayload.length} válidos, ${gruposSkipped} omitidos por falta de ciclo/plan).`);

      // ==========================================
      // 3. MIGRAR RELACIONES DOCENTES-GRUPOS
      // ==========================================
      appendLog('\n--- Obteniendo Relaciones Docentes-Grupos ---');
      const resDocGrp = await fetch(`${baseUrl}/api/legacy/academico/profesores-grupos`);
      if (!resDocGrp.ok) throw new Error('Error obteniendo profesores-grupos');
      const dataDocGrp = await resDocGrp.json();

      appendLog('Cargando diccionarios actualizados (Docentes, Grupos, Asignaturas)...');
      const dictDocentes = await fetchAll('docentes', 'id, clave_legado');
      const dictGrupos = await fetchAll('grupos', 'id, codigo_grupo, ciclo_id');
      const dictAsignaturas = await fetchAll('asignaturas', 'id, clave_legado, plan_id');

      const mapDocentes = Object.fromEntries((dictDocentes || []).map(d => [d.clave_legado, d.id]));
      
      const mapGrupos: Record<string, string> = {};
      (dictGrupos || []).forEach(g => {
        if (g.ciclo_id) mapGrupos[`${g.codigo_grupo}_${g.ciclo_id}`] = g.id;
      });
      const mapAsignaturas = Object.fromEntries((dictAsignaturas || []).map(a => [`${a.clave_legado}_${a.plan_id}`, a.id]));

      const docGrpPayload = [];
      const docGrpUnicos = new Map();
      for (const row of dataDocGrp) {
        const docente_id = mapDocentes[row.DOCENTE];
        const ciclo_id = resolveCicloId(row);
        const plan_id = resolvePlanId(row);
        const grupo_id = ciclo_id ? mapGrupos[`${row.GRUPO}_${ciclo_id}`] : undefined;
        const asignatura_id = plan_id ? mapAsignaturas[`${row.ASIGNATURA}_${plan_id}`] : undefined;

        if (docente_id && grupo_id && asignatura_id) {
          const key = `${grupo_id}_${asignatura_id}_${docente_id}`;
          if (!docGrpUnicos.has(key)) {
            docGrpUnicos.set(key, true);
            docGrpPayload.push({ docente_id, grupo_id, asignatura_id });
          }
        }
      }

      for (let i = 0; i < docGrpPayload.length; i += BATCH_SIZE) {
        const batch = docGrpPayload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('docentes_grupos_asignaturas').upsert(batch, { onConflict: 'grupo_id,asignatura_id', ignoreDuplicates: true });
        if (error) appendLog(`[Error] Batch rel docentes: ${error.message}`);
      }
      appendLog(`✓ Relaciones Docentes-Grupos sincronizadas (${docGrpPayload.length} válidas).`);

      // ==========================================
      // 4. MIGRAR RELACIONES ALUMNOS-GRUPOS
      // ==========================================
      appendLog('\n--- Sincronizando Relaciones Alumnos-Grupos ---');

      // 4a. Obtener el mapa NUMEROALUMNO → MATRICULA desde Firebird
      appendLog('Obteniendo mapa de IDs internos de alumnos desde Firebird...');
      const resAlumnosMapa = await fetch(`${baseUrl}/api/legacy/academico/alumnos-mapa`);
      if (!resAlumnosMapa.ok) throw new Error('Error obteniendo mapa de alumnos');
      const dataAlumnosMapa = await resAlumnosMapa.json();
      appendLog(`✓ Mapa obtenido: ${dataAlumnosMapa.length} alumnos en Firebird.`);

      // 4b. Actualizar numero_legado en Supabase para los alumnos ya existentes
      appendLog('Actualizando campo numero_legado en Supabase...');
      const alumnosSupabase = await fetchAll('alumnos', 'id, matricula');
      const mapMatriculaToId = Object.fromEntries((alumnosSupabase || []).map((a: any) => [a.matricula, a.id]));

      let alumnosActualizados = 0;
      const updateBatches: Promise<any>[] = [];
      for (const item of dataAlumnosMapa) {
        if (item.matricula && mapMatriculaToId[item.matricula]) {
          const alumno_id = mapMatriculaToId[item.matricula];
          updateBatches.push(
            supabase.from('alumnos').update({ numero_legado: item.numero_alumno }).eq('id', alumno_id)
          );
          alumnosActualizados++;
        }
      }
      // Ejecutar en lotes de 50 promesas simultáneas
      for (let i = 0; i < updateBatches.length; i += 50) {
        await Promise.all(updateBatches.slice(i, i + 50));
      }
      appendLog(`✓ numero_legado actualizado en ${alumnosActualizados} alumnos.`);

      // 4c. Obtener relaciones ALUMNOS_GRUPOS desde Firebird
      appendLog('Obteniendo Relaciones Alumnos-Grupos de Firebird...');
      const resAlumGrp = await fetch(`${baseUrl}/api/legacy/academico/alumnos-grupos`);
      if (!resAlumGrp.ok) throw new Error('Error obteniendo alumnos-grupos');
      const dataAlumGrp = await resAlumGrp.json();
      appendLog(`Se encontraron ${dataAlumGrp.length} relaciones Alumnos-Grupos.`);

      // 4d. Recargar alumnos con su numero_legado para construir el mapa
      const dictAlumnosConLegado = await fetchAll('alumnos', 'id, numero_legado', 'numero_legado');
      const mapNumeroLegadoToAlumnoId = Object.fromEntries(
        (dictAlumnosConLegado || []).map((a: any) => [String(a.numero_legado), a.id])
      );

      // 4e. Construir el payload
      const alumGrpPayload: { alumno_id: string; grupo_id: string; asignatura_id: string }[] = [];
      const alumGrpUnicos = new Map();
      let alumGrpSkipped = 0;
      for (const row of dataAlumGrp) {
        const alumno_id = mapNumeroLegadoToAlumnoId[String(row.NUMERO_ALUMNO)];
        const ciclo_id = resolveCicloId(row);
        const plan_id = resolvePlanId(row);
        const grupo_id = ciclo_id ? mapGrupos[`${row.GRUPO}_${ciclo_id}`] : undefined;
        const asignatura_id = (row.ASIGNATURA && plan_id) ? mapAsignaturas[`${row.ASIGNATURA}_${plan_id}`] : null;

        if (alumno_id && grupo_id) {
          const key = `${alumno_id}_${grupo_id}_${asignatura_id || 'null'}`;
          if (!alumGrpUnicos.has(key)) {
            alumGrpUnicos.set(key, true);
            alumGrpPayload.push({ alumno_id, grupo_id, asignatura_id });
          }
        } else {
          alumGrpSkipped++;
        }
      }

      for (let i = 0; i < alumGrpPayload.length; i += BATCH_SIZE) {
        const batch = alumGrpPayload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('alumnos_grupos').upsert(batch, { onConflict: 'alumno_id,grupo_id,asignatura_id', ignoreDuplicates: true });
        if (error) appendLog(`[Error] Batch rel alumnos: ${error.message}`);
      }
      appendLog(`✓ Relaciones Alumnos-Grupos sincronizadas (${alumGrpPayload.length} válidas, ${alumGrpSkipped} omitidas).`);

      appendLog('\n\n¡SINCRONIZACIÓN EXITOSA COMPLETADA!');
      toast.success('Migración de datos académicos completada.');

    } catch (err: any) {
      console.error(err);
      appendLog('\n\nERROR CRÍTICO: ' + err.message);
      toast.error('Error durante la sincronización: ' + err.message);
    } finally {
      setSincronizando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100 flex items-center gap-2">
            <Database size={20} className="text-[#1456f0]" />
            Sincronización Estructural (GES 4)
          </h2>
          <button
            onClick={onClose}
            disabled={sincronizando}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-[#45515e] dark:text-gray-300 mb-4">
            Este proceso extraerá los datos desde Firebird y los cargará en la nube:
          </p>
          <ul className="list-disc list-inside text-sm text-[#45515e] dark:text-gray-300 mb-6 space-y-1 ml-2">
            <li>Catálogo de Docentes / Profesores.</li>
            <li>Grupos (resolviendo referencias de Ciclos y Planes de Estudio).</li>
            <li>Asignación de Materias a Docentes y Grupos.</li>
            <li>Inscripción de Alumnos a Grupos (Alumnos-Grupos).</li>
          </ul>

          <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg h-64 overflow-y-auto whitespace-pre-wrap shadow-inner flex flex-col-reverse">
            <div>
              {log || 'Presione "Iniciar Sincronización" para comenzar...'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sincronizando}
            className="px-4 py-2 text-sm font-medium text-[#45515e] dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={iniciarSincronizacion}
            disabled={sincronizando}
            className="px-4 py-2 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center min-w-[180px] disabled:opacity-50"
          >
            {sincronizando ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Sincronizando...
              </>
            ) : (
              'Iniciar Sincronización'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
