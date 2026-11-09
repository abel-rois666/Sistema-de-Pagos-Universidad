import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, AlertCircle, X, History, Lock, Check, Save, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import type { GestionProgramasAlumno } from '../../hooks/useGestionProgramasAlumno';
import { fechaCapturaPrograma, fechaCivilPrograma as formatFecha } from '../../utils/fechasProgramaAlumno';

export default function ModalGestionProgramas({gestion:g}:{gestion:GestionProgramasAlumno}) {
  const {alumno,carreras,isAdmin,programas,progVigente,vigentePlanId,showModalInscripcion,setShowModalInscripcion,modoModalProg,setModoModalProg,
    submittingPrograma,desbloquearTitulado,setDesbloquearTitulado,planesDisponibles,nuevoPrograma,setNuevoPrograma,carreraInscripcionId,setCarreraInscripcionId,
    formatPlanName,getCarreraFullName,handleGuardarPrograma,systemConfirmModal,setSystemConfirmModal,confirmarSalida,setConfirmarSalida,solicitarCierre}=g;
  const dialogo=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!showModalInscripcion)return;const anterior=document.activeElement as HTMLElement|null;
    dialogo.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    return()=>{if(anterior?.isConnected)anterior.focus({preventScroll:true});};
  },[showModalInscripcion]);
  const manejarTeclado=(e:React.KeyboardEvent)=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();solicitarCierre();}
    if(e.key==='Tab'){const campos=(Array.from(dialogo.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]) as HTMLElement[]).filter(n=>n.getClientRects().length>0);
      const primero=campos[0],ultimo=campos.at(-1);if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo?.focus();}else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero?.focus();}}
  };
  if(!g.canManageProgramas)return null;
  return <>
      {/* ── Modal de Inscripción / Cambio de Programa ─────────────────── */}
      {showModalInscripcion && typeof document !== 'undefined' && (() => {
        const programaActivo = progVigente;
        const programaExistente = nuevoPrograma.plan_id ? programas.find(p => p.plan_id === nuevoPrograma.plan_id) : null;
        const planYaEnHistorial = Boolean(programaExistente);
        const esVigenteEfectivo = programas.length <= 1 ? true : nuevoPrograma.es_vigente;

        const sinCambios = Boolean(
          programaExistente &&
          programaExistente.estatus === nuevoPrograma.estatus &&
          (programaExistente.es_vigente ?? true) === esVigenteEfectivo &&
          (programaExistente.motivo_estatus || 'REGULAR') === (nuevoPrograma.motivo_estatus || 'REGULAR') &&
          (programaExistente.fecha_inscripcion || '') === (nuevoPrograma.fecha_inscripcion || '')
        );

        const botonDeshabilitado = !nuevoPrograma.plan_id || submittingPrograma || (modoModalProg === 'existente' && sinCambios);

        return createPortal(
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
            <div ref={dialogo} role="dialog" aria-modal="true" aria-labelledby="titulo-gestionar-programas" tabIndex={-1} onKeyDown={manejarTeclado} className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-full sm:max-w-xl md:max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Cabecera */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800/60 flex items-center justify-between bg-gray-50/50 dark:bg-[#181e25] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#1456f0] dark:text-blue-400">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <h3 id="titulo-gestionar-programas" className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                      Administrar programas
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {alumno.nombre_completo || [alumno.nombres, alumno.apellido_paterno, alumno.apellido_materno].filter(Boolean).join(' ')} ({alumno.matricula || 'Sin matrícula'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar administración de programas"
                  onClick={solicitarCierre}
                  disabled={submittingPrograma}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Banner de Programa Vigente */}
              <div className="px-4 sm:px-5 pt-3 sm:pt-4 shrink-0">
                {programaActivo ? (
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-xl flex items-start gap-3 shadow-2xs">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-[#1456f0] dark:text-blue-300 mt-0.5 shrink-0">
                      <GraduationCap size={16} />
                    </div>
                    <div className="text-xs space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider text-[10px]">
                          {programaActivo.es_vigente?'Programa principal del expediente':'Programa de referencia del expediente'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold ${
                          programaActivo.estatus === 'CURSANDO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                          programaActivo.estatus === 'EGRESADO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                          (programaActivo.estatus === 'TITULADO' || programaActivo.estatus === 'EGRESADO TITULADO') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                          programaActivo.estatus === 'BAJA' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {programaActivo.estatus}
                        </span>
                      </div>
                      <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">
                        {formatPlanName(programaActivo)}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px] flex items-center gap-2">
                        <span>Clave: <strong className="font-mono text-gray-700 dark:text-gray-300">{programaActivo.planes_estudio?.clave_legado || 'S/C'}</strong></span>
                        <span>•</span>
                        <span>Referencia anterior de asociación: <strong className="text-gray-700 dark:text-gray-300">{formatFecha(programaActivo.fecha_inscripcion)}</strong></span>
                        {programaActivo.motivo_estatus && programaActivo.motivo_estatus !== 'REGULAR' && (
                          <>
                            <span>•</span>
                            <span className="italic text-blue-600 dark:text-blue-400">
                              {programaActivo.motivo_estatus === 'REINGRESO' ? 'Reingreso' : programaActivo.motivo_estatus}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>Sin programa oficial registrado actualmente en el expediente.</span>
                  </div>
                )}
              </div>

              {/* Pestañas de Selección (si hay programas previos registrados) */}
              {programas.length > 0 && (
                <div className="px-4 sm:px-5 pt-3 shrink-0">
                  <div className="flex p-1 bg-gray-100 dark:bg-[#151a20] rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setModoModalProg('existente');
                        const target = programaActivo || programas[0];
                        if (target) {
                          const isTargetBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(target.estatus);
                          const isTargetConcluido = ['EGRESADO', 'TITULADO'].includes(target.estatus);
                          const estatusCalculado = (isTargetBaja && (target.es_vigente ?? true)) ? 'CURSANDO' : target.estatus;
                          const motivoCalculado = isTargetConcluido
                            ? 'PLAN_CONCLUIDO'
                            : (isTargetBaja && (target.es_vigente ?? true))
                            ? 'REINGRESO'
                            : (target.motivo_estatus || (target.es_vigente ? 'REGULAR' : 'CAMBIO_DE_CARRERA'));

                          setNuevoPrograma({
                            plan_id: target.plan_id,
                            estatus: estatusCalculado,
                            es_vigente: target.es_vigente ?? true,
                            fecha_inscripcion: target.fecha_inscripcion || new Date().toISOString().split('T')[0],
                            motivo_estatus: motivoCalculado,
                            estatus_previo: isTargetBaja ? target.estatus : (target.estatus_previo || null)
                          });
                        }
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        modoModalProg === 'existente'
                          ? 'bg-white dark:bg-[#1c2228] text-[#1456f0] dark:text-blue-400 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      <History size={13} />
                      Programas registrados ({programas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoModalProg('nuevo');
                        setCarreraInscripcionId('');
                        const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO');
                        const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
                        setNuevoPrograma({
                          plan_id: '',
                          estatus: 'CURSANDO',
                          fecha_inscripcion: new Date().toISOString().split('T')[0],
                          es_vigente: true,
                          motivo_estatus: hasCursando ? 'CARRERA_SIMULTANEA' : (esAlumnoEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR'),
                          estatus_previo: null
                        });
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        modoModalProg === 'nuevo'
                          ? 'bg-white dark:bg-[#1c2228] text-[#1456f0] dark:text-blue-400 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      <GraduationCap size={13} />
                      Agregar programa
                    </button>
                  </div>
                </div>
              )}

              {/* Contenido del Formulario */}
              <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
                {modoModalProg === 'existente' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      Selecciona un plan del historial para gestionar o activar:
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {[...programas].sort((a,b)=>formatPlanName(a).localeCompare(formatPlanName(b),'es',{numeric:true})).map((prog) => {
                        const isSelected = nuevoPrograma.plan_id === prog.plan_id;
                        const isVigente = prog.es_vigente;
                        return (
                          <div
                            key={prog.id}
                            role="button" tabIndex={0} aria-pressed={isSelected} aria-label={`Gestionar ${formatPlanName(prog)}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click();}}}
                            onClick={() => {
                              const isTargetBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(prog.estatus);
                              const isTargetConcluido = ['EGRESADO', 'TITULADO'].includes(prog.estatus);
                              const willBeVigente = isSelected ? nuevoPrograma.es_vigente : Boolean(prog.es_vigente);
                              const estatusCalculado = (isTargetBaja && willBeVigente) ? 'CURSANDO' : prog.estatus;
                              const motivoCalculado = isTargetConcluido
                                ? 'PLAN_CONCLUIDO'
                                : (isTargetBaja && willBeVigente)
                                ? 'REINGRESO'
                                : (prog.motivo_estatus || (willBeVigente ? 'REGULAR' : 'CAMBIO_DE_CARRERA'));

                              setDesbloquearTitulado(false);
                              setNuevoPrograma({
                                plan_id: prog.plan_id,
                                estatus: estatusCalculado,
                                fecha_inscripcion: prog.fecha_inscripcion || new Date().toISOString().split('T')[0],
                                es_vigente: willBeVigente,
                                motivo_estatus: motivoCalculado,
                                estatus_previo: isTargetBaja ? prog.estatus : (prog.estatus_previo || null)
                              });
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-xs'
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181e25] hover:border-gray-300 dark:hover:border-gray-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1 basis-full sm:basis-0">
                              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {prog.planes_estudio?.clave_legado || 'S/C'}
                                </span>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 wrap-break-word">
                                  {formatPlanName(prog)}
                                </span>
                                {isVigente && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                    PRINCIPAL
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                <span>Captura: {fechaCapturaPrograma(prog.created_at)}</span>
                                {prog.motivo_estatus && prog.motivo_estatus !== 'REGULAR' && (
                                  <>
                                    <span>•</span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      {prog.motivo_estatus === 'CARRERA_SIMULTANEA' ? 'Simultánea' :
                                       prog.motivo_estatus === 'SEGUNDA_CARRERA' ? '2ª Carrera' :
                                       prog.motivo_estatus === 'REINGRESO' ? 'Reingreso' :
                                       prog.motivo_estatus === 'PLAN_CONCLUIDO' ? 'Concluido' :
                                       prog.motivo_estatus === 'CAMBIO_DE_CARRERA' ? 'Cambio de Plan' :
                                       prog.motivo_estatus}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                prog.estatus === 'CURSANDO'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                  : prog.estatus === 'EGRESADO'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                  : (prog.estatus === 'TITULADO' || prog.estatus === 'EGRESADO TITULADO')
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                                {prog.estatus === 'BAJA_POR_CAMBIO' ? 'BAJA POR CAMBIO' : prog.estatus}
                              </span>
                              <input
                                type="radio"
                                tabIndex={-1}
                                aria-label={`Seleccionar ${formatPlanName(prog)}`}
                                checked={isSelected}
                                onChange={() => {}}
                                className="text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {nuevoPrograma.plan_id && (
                      <div className="p-3.5 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold">
                            <GraduationCap size={14} /> Situación Curricular y Trayectoria:
                          </span>
                        </div>

                        {/* Alerta de reactivación si era baja y se activa */}
                        {(nuevoPrograma.estatus_previo || (programaExistente && ['BAJA', 'BAJA_POR_CAMBIO'].includes(programaExistente.estatus))) && nuevoPrograma.es_vigente && nuevoPrograma.estatus === 'CURSANDO' && (
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                            <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <div>
                              <strong>Reactivación del programa:</strong> Este plan estaba en estatus <em>{nuevoPrograma.estatus_previo || programaExistente?.estatus}</em>. Al establecerlo como principal, pasa automáticamente a <strong>CURSANDO</strong> con motivo <strong>REINGRESO</strong>. Su estatus anterior queda respaldado por si deja de ser principal.
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Estatus en este Plan
                            </label>
                            {nuevoPrograma.estatus === 'TITULADO' && !desbloquearTitulado ? (
                              <div className="space-y-1">
                                <div className="p-2 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <Lock size={13} className="text-purple-600 shrink-0" />
                                    <span>TITULADO (Grado Obtenido)</span>
                                  </div>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => setDesbloquearTitulado(true)}
                                      className="text-[10px] text-purple-700 dark:text-purple-300 hover:underline cursor-pointer font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50"
                                      title="Permite a un administrador reclasificar el estatus de este plan"
                                    >
                                      Desbloquear
                                    </button>
                                  )}
                                </div>
                                <p className="text-[10px] text-purple-600 dark:text-purple-400 leading-tight">
                                  Gobernado por la pestaña Titulación (con Libro, Foja y Acta).
                                </p>
                              </div>
                            ) : (
                              <select
                                value={nuevoPrograma.estatus}
                                onChange={e => {
                                  const newEstatus = e.target.value;
                                  const isEgresado = ['EGRESADO', 'TITULADO', 'EGRESADO TITULADO'].includes(newEstatus);
                                  setNuevoPrograma(p => {
                                    let nextMotivo = p.motivo_estatus;
                                    if (isEgresado) {
                                      nextMotivo = 'PLAN_CONCLUIDO';
                                    } else if (newEstatus === 'BAJA') {
                                      nextMotivo = 'DESERCION_VOLUNTARIA';
                                    } else if (newEstatus === 'BAJA_POR_CAMBIO') {
                                      nextMotivo = 'CAMBIO_DE_CARRERA';
                                    } else if (newEstatus === 'CURSANDO' && p.motivo_estatus === 'PLAN_CONCLUIDO') {
                                      nextMotivo = 'REGULAR';
                                    }
                                    return { ...p, estatus: newEstatus, motivo_estatus: nextMotivo };
                                  });
                                }}
                                className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100 font-medium"
                              >
                                <option value="CURSANDO">CURSANDO (Activo)</option>
                                <option value="EGRESADO">EGRESADO (Créditos Concluidos)</option>
                                <option value="TITULADO">TITULADO (Grado Obtenido)</option>
                                <option value="BAJA">BAJA (Deserción)</option>
                                <option value="BAJA_POR_CAMBIO">BAJA POR CAMBIO (Carrera Previa)</option>
                              </select>
                            )}
                          </div>

                          {(() => {
                            const isConcluido = ['EGRESADO', 'TITULADO'].includes(nuevoPrograma.estatus);
                            const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoPrograma.estatus);

                            return (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                                    Modalidad de Trayectoria / Motivo
                                  </label>
                                  {isConcluido && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/60">
                                      🔒 Logro Concluido
                                    </span>
                                  )}
                                </div>
                                <select
                                  disabled={isConcluido}
                                  value={isConcluido ? 'PLAN_CONCLUIDO' : (nuevoPrograma.motivo_estatus || 'REGULAR')}
                                  onChange={e => setNuevoPrograma(p => ({ ...p, motivo_estatus: e.target.value }))}
                                  className={`w-full border rounded-lg p-2 text-xs outline-none font-medium transition-all ${
                                    isConcluido
                                      ? 'bg-gray-100 dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-90'
                                      : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500'
                                  }`}
                                >
                                  {isConcluido ? (
                                    <option value="PLAN_CONCLUIDO">PLAN CONCLUIDO (Logro completado)</option>
                                  ) : isBaja ? (
                                    <>
                                      <option value="DESERCION_VOLUNTARIA">DESERCIÓN VOLUNTARIA (Baja del alumno)</option>
                                      <option value="CAMBIO_DE_CARRERA">CAMBIO DE CARRERA (Transferencia a otro plan)</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="REGULAR">REGULAR (Carrera única ordinaria)</option>
                                      <option value="CARRERA_SIMULTANEA">CARRERA SIMULTÁNEA (2 carreras a la vez)</option>
                                      <option value="SEGUNDA_CARRERA">SEGUNDA CARRERA (Egresado de carrera previa)</option>
                                      <option value="REINGRESO">REINGRESO (Reactivado tras baja académica)</option>
                                    </>
                                  )}
                                </select>
                                {isConcluido && (
                                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 leading-tight italic">
                                    Protegido: Al ser un plan acreditado como egresado/titulado, su modalidad oficial queda fijada como Plan Concluido.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {nuevoPrograma.estatus === 'EGRESADO' && (
                          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2">
                            <GraduationCap size={15} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                            <div>
                              <strong>🎓 Protocolo Oficial de Titulación:</strong> Para titular formalmente este plan de estudios asentando Libro, Foja, Folio de Control y Acta/Examen oficial, realiza el trámite en la pestaña <strong>Titulación</strong>.
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                              Fecha anterior de asociación (referencia)
                            </label>
                            <input
                              type="date"
                              title="Referencia de la asociación anterior. El ingreso acreditado se revisa en Trayectoria; este campo no modifica inscripciones por ciclo."
                              value={nuevoPrograma.fecha_inscripcion}
                              onChange={e => setNuevoPrograma(p => ({ ...p, fecha_inscripcion: e.target.value }))}
                              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                            /><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Referencia de la asociación anterior. El ingreso acreditado se revisa en Trayectoria; editar aquí no modifica inscripciones por ciclo.</p>
                          </div>

                          {nuevoPrograma.estatus_previo && (
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                Estatus Previo Respaldado
                              </label>
                              <div className="p-2 border border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-800/60 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300">
                                {nuevoPrograma.estatus_previo}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                          {programas.length <= 1 ? (
                            <div className="flex items-start gap-2.5 p-2.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl">
                              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                  Plan Rector Oficial del Expediente
                                </span>
                                <p className="text-[11px] text-blue-700 dark:text-blue-300/80 leading-tight mt-0.5">
                                  Al ser el único plan registrado, se mantiene automáticamente como el plan rector del alumno para reportes y constancias. Para cambiarlo, inscribe primero la nueva carrera.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={nuevoPrograma.es_vigente}
                                onChange={e => {
                                  const isChecked = e.target.checked;
                                  const planOriginal = programas.find(p => p.plan_id === nuevoPrograma.plan_id);
                                  const eraBajaOriginal = ['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoPrograma.estatus_previo || planOriginal?.estatus || '');

                                  setNuevoPrograma(p => {
                                    if (isChecked && eraBajaOriginal) {
                                      return {
                                        ...p,
                                        es_vigente: true,
                                        estatus: 'CURSANDO',
                                        motivo_estatus: 'REINGRESO',
                                        estatus_previo: p.estatus_previo || planOriginal?.estatus
                                      };
                                    } else if (!isChecked && p.estatus_previo && p.motivo_estatus !== 'CARRERA_SIMULTANEA') {
                                      return {
                                        ...p,
                                        es_vigente: false,
                                        estatus: p.estatus_previo,
                                        motivo_estatus: 'DESERCION_VOLUNTARIA'
                                      };
                                    }
                                    return { ...p, es_vigente: isChecked };
                                  });
                                }}
                                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                  Establecer como programa principal
                                </span>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                                  Define este plan como la carrera oficial activa del expediente universitario.
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Alertas Inteligentes para Modo Nuevo */}
                    {programas.some(p => p.estatus === 'CURSANDO') && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-300 flex items-start gap-2.5">
                        <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>⚡ Detección de Carrera Simultánea:</strong> El alumno ya tiene un plan en estatus <em>CURSANDO</em>. Si cursará ambas carreras al mismo tiempo, selecciona la modalidad <strong>CARRERA SIMULTÁNEA</strong>. Si abandona el plan previo para cursar este nuevo, selecciona <strong>CAMBIO DE CARRERA</strong>.
                        </div>
                      </div>
                    )}

                    {programas.some(p => ['EGRESADO', 'TITULADO'].includes(p.estatus)) && !programas.some(p => p.estatus === 'CURSANDO') && (
                      <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 rounded-xl text-xs text-teal-900 dark:text-teal-300 flex items-start gap-2.5">
                        <GraduationCap size={16} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>🎓 Detección de Segunda Carrera:</strong> El alumno ya completó un programa académico previamente. Se asigna la modalidad <strong>SEGUNDA CARRERA</strong> manteniendo intacto el título de su plan anterior.
                        </div>
                      </div>
                    )}

                    {/* Cascada 1: Selección de Carrera */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        1. Carrera Oficial <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={carreraInscripcionId}
                        onChange={e => {
                          const cId = e.target.value;
                          setCarreraInscripcionId(cId);
                          const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO');
                          const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
                          setNuevoPrograma(prev => ({
                            ...prev,
                            plan_id: '',
                            estatus: 'CURSANDO',
                            motivo_estatus: hasCursando ? 'CARRERA_SIMULTANEA' : (esAlumnoEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR'),
                            fecha_inscripcion: new Date().toISOString().split('T')[0]
                          }));
                        }}
                        className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                      >
                        <option value="">-- Selecciona Carrera --</option>
                        {[...carreras].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cascada 2: Plan de Estudios */}
                    {/* Cascada 2: Plan de Estudios */}
                    {(() => {
                      const planesDeCarrera = planesDisponibles.filter(p => p.carrera_id === carreraInscripcionId);
                      const planesInscritosIds = new Set(programas.map(p => p.plan_id));
                      const planesNuevosDisponibles = planesDeCarrera.filter(p => !planesInscritosIds.has(p.id));
                      const todosLosPlanesYaInscritos = Boolean(carreraInscripcionId && planesDeCarrera.length > 0 && planesNuevosDisponibles.length === 0);

                      return (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            2. Plan de Estudios <span className="text-red-500">*</span>
                          </label>
                          <select
                            disabled={!carreraInscripcionId || todosLosPlanesYaInscritos || planesDeCarrera.length === 0}
                            value={nuevoPrograma.plan_id}
                            onChange={e => {
                              const pId = e.target.value;
                              if (!pId) {
                                setNuevoPrograma(prev => ({ ...prev, plan_id: '' }));
                                return;
                              }
                              const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO');
                              const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
                              setNuevoPrograma(prev => ({
                                ...prev,
                                plan_id: pId,
                                estatus: 'CURSANDO',
                                motivo_estatus: hasCursando ? 'CARRERA_SIMULTANEA' : (esAlumnoEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR'),
                                fecha_inscripcion: new Date().toISOString().split('T')[0]
                              }));
                            }}
                            className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50"
                          >
                            <option value="">
                              {!carreraInscripcionId
                                ? '-- Primero selecciona una carrera --'
                                : todosLosPlanesYaInscritos
                                ? '-- Todos los planes de esta carrera ya están registrados --'
                                : planesDeCarrera.length === 0
                                ? '-- Sin planes en catálogo para esta carrera --'
                                : '-- Selecciona Plan Curricular --'}
                            </option>
                            {planesNuevosDisponibles.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.clave_legado ? `${p.clave_legado} - ` : ''}{p.nombre} ({p.total_periodos || 10} periodos)
                              </option>
                            ))}
                          </select>

                          {/* Aviso si todos los planes ya están en el historial */}
                          {todosLosPlanesYaInscritos && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 mt-2">
                              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                              <div>
                                <strong>Carrera ya en el expediente:</strong> Todos los planes de estudio registrados para esta carrera ya se encuentran en el historial del alumno. Si deseas reactivar o cambiar su estatus, dirígete a la pestaña <strong>"Planes Registrados"</strong>.
                              </div>
                            </div>
                          )}

                          {carreraInscripcionId && planesDeCarrera.length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              No hay planes registrados para esta carrera en el catálogo institucional. Crea uno en Configuración Académica primero.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                          Fecha anterior de asociación (referencia)
                        </label>
                        <input
                          type="date"
                          title="Referencia de la asociación anterior. El ingreso acreditado se revisa en Trayectoria; este campo no modifica inscripciones por ciclo."
                              value={nuevoPrograma.fecha_inscripcion}
                          onChange={e => setNuevoPrograma(p => ({ ...p, fecha_inscripcion: e.target.value }))}
                          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                        /><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Referencia de la asociación anterior. El ingreso acreditado se revisa en Trayectoria; editar aquí no modifica inscripciones por ciclo.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                          Estatus Curricular
                        </label>
                        <select
                          value={nuevoPrograma.estatus}
                          onChange={e => {
                            const newEstatus = e.target.value;
                            const isEgresado = ['EGRESADO', 'TITULADO'].includes(newEstatus);
                            setNuevoPrograma(p => {
                              let nextMotivo = p.motivo_estatus;
                              if (isEgresado) {
                                nextMotivo = 'PLAN_CONCLUIDO';
                              } else if (newEstatus === 'BAJA') {
                                nextMotivo = 'DESERCION_VOLUNTARIA';
                              } else if (newEstatus === 'BAJA_POR_CAMBIO') {
                                nextMotivo = 'CAMBIO_DE_CARRERA';
                              } else if (newEstatus === 'CURSANDO' && p.motivo_estatus === 'PLAN_CONCLUIDO') {
                                const hasCursando = programas.some(pr => pr.estatus === 'CURSANDO');
                                const hasEgresado = programas.some(pr => ['EGRESADO', 'TITULADO'].includes(pr.estatus));
                                nextMotivo = hasCursando ? 'CARRERA_SIMULTANEA' : (hasEgresado ? 'SEGUNDA_CARRERA' : 'REGULAR');
                              }
                              return { ...p, estatus: newEstatus, motivo_estatus: nextMotivo };
                            });
                          }}
                          className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-gray-100"
                        >
                          <option value="CURSANDO">CURSANDO (Cursando materias)</option>
                          <option value="EGRESADO">EGRESADO (Créditos concluidos)</option>
                          <option value="TITULADO">TITULADO (Grado obtenido)</option>
                          <option value="BAJA">BAJA (Baja académica)</option>
                          <option value="BAJA_POR_CAMBIO">BAJA POR CAMBIO (Transferido a otro plan)</option>
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const isConcluido = ['EGRESADO', 'TITULADO'].includes(nuevoPrograma.estatus);
                      const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoPrograma.estatus);

                      return (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                              Modalidad de Trayectoria / Motivo
                            </label>
                            {isConcluido && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800/60">
                                🔒 Logro Concluido
                              </span>
                            )}
                          </div>
                          <select
                            disabled={isConcluido}
                            value={isConcluido ? 'PLAN_CONCLUIDO' : (nuevoPrograma.motivo_estatus || 'REGULAR')}
                            onChange={e => setNuevoPrograma(p => ({ ...p, motivo_estatus: e.target.value }))}
                            className={`w-full border rounded-xl p-2.5 text-sm outline-none font-medium transition-all ${
                              isConcluido
                                ? 'bg-gray-100 dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-90'
                                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500'
                            }`}
                          >
                            {isConcluido ? (
                              <option value="PLAN_CONCLUIDO">PLAN CONCLUIDO (Logro completado)</option>
                            ) : isBaja ? (
                              <>
                                <option value="DESERCION_VOLUNTARIA">DESERCIÓN VOLUNTARIA (Baja del alumno)</option>
                                <option value="CAMBIO_DE_CARRERA">CAMBIO DE CARRERA (Transferencia a este nuevo plan)</option>
                              </>
                            ) : (
                              <>
                                <option value="REGULAR">REGULAR (Carrera única ordinaria)</option>
                                <option value="CARRERA_SIMULTANEA">CARRERA SIMULTÁNEA (2 carreras a la vez)</option>
                                <option value="SEGUNDA_CARRERA">SEGUNDA CARRERA (Egresado de carrera previa)</option>
                                <option value="REINGRESO">REINGRESO (Reactivado tras baja académica)</option>
                                <option value="CAMBIO_DE_CARRERA">CAMBIO DE CARRERA (Transferencia a este nuevo plan)</option>
                              </>
                            )}
                          </select>
                          {isConcluido && (
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 leading-tight italic">
                              Protegido: Al ser un plan acreditado como egresado/titulado, su modalidad oficial queda fijada como Plan Concluido.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-3 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-xl">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={nuevoPrograma.es_vigente}
                          onChange={e => setNuevoPrograma(p => ({ ...p, es_vigente: e.target.checked }))}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            Establecer como programa principal
                          </span>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                            Define este plan como la carrera oficial activa del expediente universitario.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="p-3.5 sm:p-4 bg-gray-50/70 dark:bg-[#181e25] border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between gap-2.5 shrink-0">
                <div>
                  {modoModalProg === 'existente' && sinCambios && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                      Sin cambios pendientes.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={solicitarCierre}
                    disabled={submittingPrograma}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarPrograma}
                    disabled={botonDeshabilitado}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer ${
                      botonDeshabilitado
                        ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-[#1456f0] hover:bg-[#1d4ed8] dark:bg-blue-600 dark:hover:bg-blue-700 text-white'
                    }`}
                  >
                    {submittingPrograma ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Guardando...
                      </>
                    ) : !nuevoPrograma.plan_id ? (
                      <>
                        <GraduationCap size={15} />
                        Selecciona un Plan
                      </>
                    ) : modoModalProg === 'nuevo' ? (
                      <>
                        <GraduationCap size={15} />
                        {nuevoPrograma.es_vigente ? 'Agregar como principal' : 'Agregar programa'}
                      </>
                    ) : sinCambios ? (
                      <>
                        <Check size={14} />
                        Plan Registrado (Sin Cambios)
                      </>
                    ) : nuevoPrograma.es_vigente && (!programaExistente || !programaExistente.es_vigente) ? (
                      <>
                        <GraduationCap size={15} />
                        Establecer como principal
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        Actualizar Plan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

    <ModalConfirmacion {...systemConfirmModal}/>
    <ModalConfirmacion isOpen={confirmarSalida} title="Descartar cambios del programa" message="Se cerrará el formulario sin guardar los cambios capturados." onCancel={()=>setConfirmarSalida(false)} onConfirm={()=>{setConfirmarSalida(false);setShowModalInscripcion(false);}}/>
  </>;
}
