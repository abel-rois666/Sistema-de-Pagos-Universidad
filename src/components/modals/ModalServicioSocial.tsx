import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Plus, Search, Briefcase, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ServicioSocial, VarianteSS } from '../../types';

interface Props {
  alumnoId: string;
  registro?: ServicioSocial | null;
  empresasCatalogo: string[];
  onClose: () => void;
  onSaved: (r: ServicioSocial) => void;
  onEmpresaAgregada?: (e: string) => void;
}

const INPUT = 'w-full border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#181e25] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500 transition-shadow placeholder:text-gray-400';
const LABEL = 'block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1 uppercase tracking-wider';
const today = () => new Date().toISOString().split('T')[0];

const VARIANTES: { id: VarianteSS; label: string; desc: string }[] = [
  { id: 'ART_55', label: 'ART. 55', desc: 'LRART. 5 CONST.' },
  { id: 'ART_52', label: 'ART. 52', desc: 'LRART. 5 CONST.' },
  { id: 'ART_91', label: 'ART. 91', desc: 'RLRART. 5 CONST.' },
];

export default function ModalServicioSocial({ alumnoId, registro, empresasCatalogo, onClose, onSaved, onEmpresaAgregada }: Props) {
  const isEdit = !!registro;

  const [variante, setVariante] = useState<VarianteSS>(registro?.variante_legal ?? 'ART_55');
  const [empresa, setEmpresa] = useState(registro?.nombre_empresa ?? '');
  const [busqueda, setBusqueda] = useState(registro?.nombre_empresa ?? '');
  const [tipoEmpresa, setTipoEmpresa] = useState<'PRIVADA' | 'PUBLICA'>(registro?.tipo_empresa ?? 'PRIVADA');
  const [fechaRegistro, setFechaRegistro] = useState(registro?.fecha_registro ?? today());
  const [fechaInicio, setFechaInicio] = useState(registro?.fecha_inicio ?? '');
  const [fechaTermino, setFechaTermino] = useState(registro?.fecha_termino ?? '');
  const [horas, setHoras] = useState(registro?.horas_cubrir?.toString() ?? '');
  const [programa, setPrograma] = useState(registro?.nombre_programa ?? '');

  // ART. 52
  const [motivo52, setMotivo52] = useState<'EDAD' | 'ENFERMEDAD' | ''>(registro?.art52_motivo ?? '');
  const [docActa, setDocActa] = useState<'PENDIENTE' | 'ENTREGADO'>(registro?.art52_doc_acta ?? 'PENDIENTE');
  const [docExp, setDocExp] = useState<'PENDIENTE' | 'ENTREGADO'>(registro?.art52_doc_expediente ?? 'PENDIENTE');

  // ART. 91
  const [reqConstancia, setReqConstancia] = useState(registro?.art91_req_constancia ?? false);
  const [reqComprobantes, setReqComprobantes] = useState(registro?.art91_req_comprobantes ?? false);
  const [reqInforme, setReqInforme] = useState(registro?.art91_req_informe ?? false);
  const [fechaInicioLabores, setFechaInicioLabores] = useState(registro?.fecha_inicio ?? '');

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const sugerencias = empresasCatalogo.filter(e => e.toLowerCase().includes(busqueda.toLowerCase()) && busqueda.length > 0);
  const esNueva = busqueda.trim() !== '' && !empresasCatalogo.some(e => e.toLowerCase() === busqueda.trim().toLowerCase());

  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectEmpresa = (v: string) => { setEmpresa(v); setBusqueda(v); setShowSuggestions(false); };

  const agregarEmpresa = async () => {
    const v = busqueda.trim().toUpperCase();
    if (!v || empresasCatalogo.includes(v)) return;
    setSavingEmpresa(true);
    const { data, error } = await supabase.from('catalogos').insert({ tipo: 'empresa_ss', valor: v, orden: empresasCatalogo.length + 1, activo: true }).select().single();
    setSavingEmpresa(false);
    setEmpresa(v); setBusqueda(v); setShowSuggestions(false);
    if (!error && data) onEmpresaAgregada?.(v);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (variante === 'ART_55' || variante === 'ART_91') {
      if (!empresa.trim()) e.empresa = 'Requerido';
      if (!tipoEmpresa) e.tipoEmpresa = 'Requerido';
    }
    if (!fechaRegistro) e.fechaRegistro = 'Requerido';
    if (variante === 'ART_55') {
      if (!fechaInicio) e.fechaInicio = 'Requerido';
      if (!fechaTermino) e.fechaTermino = 'Requerido';
      if (fechaInicio && fechaTermino && fechaTermino < fechaInicio) e.fechaTermino = 'Debe ser posterior al inicio';
      const h = parseInt(horas, 10);
      if (!horas || isNaN(h) || h < 1) e.horas = 'Debe ser un entero positivo';
    }
    if (variante === 'ART_52') {
      if (!motivo52) e.motivo52 = 'Selecciona un motivo';
    }
    if (variante === 'ART_91') {
      if (!fechaInicioLabores) e.fechaInicioLabores = 'Requerido';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    setSaveError(null);

    let estatusCalculado: 'EN_CURSO' | 'LIBERADO' = 'EN_CURSO';
    if (variante === 'ART_52') estatusCalculado = 'LIBERADO';
    if (variante === 'ART_91' && reqConstancia && reqComprobantes && reqInforme) estatusCalculado = 'LIBERADO';

    const payload: any = {
      alumno_id: alumnoId,
      variante_legal: variante,
      fecha_registro: fechaRegistro,
      estatus: estatusCalculado,
      updated_at: new Date().toISOString(),
      // ART.55 / ART.91
      nombre_empresa: (variante !== 'ART_52') ? empresa.trim().toUpperCase() : (registro?.nombre_empresa ?? ''),
      tipo_empresa: (variante !== 'ART_52') ? tipoEmpresa : (registro?.tipo_empresa ?? 'PRIVADA'),
      // ART.55 specific
      fecha_inicio: variante === 'ART_55' ? fechaInicio : (variante === 'ART_91' ? fechaInicioLabores : (registro?.fecha_inicio ?? '')),
      fecha_termino: variante === 'ART_55' ? fechaTermino : (registro?.fecha_termino ?? fechaRegistro),
      horas_cubrir: variante === 'ART_55' ? parseInt(horas, 10) : 0,
      nombre_programa: variante === 'ART_55' ? (programa.trim() || null) : null,
      // ART.52
      art52_motivo: variante === 'ART_52' ? (motivo52 || null) : null,
      art52_doc_acta: variante === 'ART_52' ? docActa : 'PENDIENTE',
      art52_doc_expediente: variante === 'ART_52' ? docExp : 'PENDIENTE',
      // ART.91
      art91_req_constancia: variante === 'ART_91' ? reqConstancia : false,
      art91_req_comprobantes: variante === 'ART_91' ? reqComprobantes : false,
      art91_req_informe: variante === 'ART_91' ? reqInforme : false,
    };

    let result: ServicioSocial | null = null;
    let error = null;
    if (isEdit && registro) {
      const { data, error: err } = await supabase.from('servicio_social').update(payload).eq('id', registro.id).select().single();
      result = data; error = err;
    } else {
      const { data, error: err } = await supabase.from('servicio_social').insert(payload).select().single();
      result = data; error = err;
    }

    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    if (result) onSaved(result);
  };

  const art91Complete = reqConstancia && reqComprobantes && reqInforme;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1c2228] rounded-[24px] w-full max-w-lg shadow-2xl border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#f8f9ff] dark:bg-[#181e25] border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-[8px] text-purple-600 dark:text-purple-400"><Briefcase size={18} /></div>
            <div>
              <h2 className="font-semibold text-[#222222] dark:text-white text-base">{isEdit ? 'Editar Servicio Social' : 'Nuevo Registro de Servicio Social'}</h2>
              <p className="text-xs text-[#8e8e93]">Selecciona la variante legal que aplica</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 max-h-[78vh] overflow-y-auto">

          {/* Selector Variante */}
          <div>
            <label className={LABEL}>Fundamento Legal *</label>
            <div className="grid grid-cols-3 gap-2">
              {VARIANTES.map(v => (
                <button key={v.id} type="button" onClick={() => setVariante(v.id)}
                  className={`flex flex-col items-center py-3 px-2 rounded-[10px] border-2 text-center transition-all ${variante === v.id ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-[#45515e] dark:text-gray-400 hover:border-purple-300'}`}>
                  <span className="text-sm font-bold">{v.label}</span>
                  <span className="text-[9px] font-medium mt-0.5 leading-tight">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── ART. 55 y ART. 91: Empresa ── */}
          {(variante === 'ART_55' || variante === 'ART_91') && (
            <div ref={searchRef} className="relative">
              <label className={LABEL}>Nombre de Institución / Empresa *</label>
              <div className={`flex items-center gap-2 border ${errors.empresa ? 'border-red-400' : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)]'} rounded-[8px] px-3 py-2 bg-white dark:bg-[#181e25] focus-within:ring-2 focus-within:ring-purple-500 transition-shadow`}>
                <Search size={15} className="text-gray-400 shrink-0" />
                <input type="text" className="flex-1 bg-transparent outline-none text-sm text-[#222222] dark:text-gray-100 placeholder:text-gray-400"
                  placeholder="Buscar o escribir..." value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setEmpresa(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)} autoComplete="off" />
              </div>
              {errors.empresa && <p className="text-xs text-red-500 mt-1">{errors.empresa}</p>}
              {showSuggestions && busqueda.trim().length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] shadow-xl max-h-48 overflow-y-auto">
                  {sugerencias.map(s => (
                    <div key={s} onMouseDown={() => selectEmpresa(s)} className="px-4 py-2.5 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 cursor-pointer border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] last:border-0 font-medium text-[#222222] dark:text-gray-200">{s}</div>
                  ))}
                  {esNueva && (
                    <div onMouseDown={agregarEmpresa} className="px-4 py-2.5 text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400 hover:bg-purple-50 cursor-pointer font-semibold border-t border-purple-100">
                      {savingEmpresa ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Agregar "{busqueda.trim().toUpperCase()}" al catálogo
                    </div>
                  )}
                  {sugerencias.length === 0 && !esNueva && <div className="px-4 py-3 text-sm text-gray-400 text-center">Sin coincidencias</div>}
                </div>
              )}
            </div>
          )}

          {/* Tipo Empresa — ART. 55 y ART. 91 */}
          {(variante === 'ART_55' || variante === 'ART_91') && (
            <div>
              <label className={LABEL}>Tipo de Empresa *</label>
              <div className="flex gap-3">
                {(['PRIVADA', 'PUBLICA'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setTipoEmpresa(t)}
                    className={`flex-1 py-2 rounded-[8px] text-sm font-semibold border transition-all ${tipoEmpresa === t ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-[#181e25] text-[#45515e] dark:text-gray-300 border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] hover:border-purple-400'}`}>
                    {t === 'PRIVADA' ? 'Privada' : 'Pública'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fecha de Registro — Todos */}
          <div>
            <label className={LABEL}>Fecha de Registro *</label>
            <input type="date" className={`${INPUT} ${errors.fechaRegistro ? 'border-red-400' : ''}`} value={fechaRegistro} onChange={e => setFechaRegistro(e.target.value)} />
            {errors.fechaRegistro && <p className="text-xs text-red-500 mt-1">{errors.fechaRegistro}</p>}
          </div>

          {/* ── ART. 55: Fechas y Horas ── */}
          {variante === 'ART_55' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Fecha de Inicio *</label>
                  <input type="date" className={`${INPUT} ${errors.fechaInicio ? 'border-red-400' : ''}`} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                  {errors.fechaInicio && <p className="text-xs text-red-500 mt-1">{errors.fechaInicio}</p>}
                </div>
                <div>
                  <label className={LABEL}>Fecha de Término *</label>
                  <input type="date" className={`${INPUT} ${errors.fechaTermino ? 'border-red-400' : ''}`} value={fechaTermino} onChange={e => setFechaTermino(e.target.value)} min={fechaInicio || undefined} />
                  {errors.fechaTermino && <p className="text-xs text-red-500 mt-1">{errors.fechaTermino}</p>}
                </div>
              </div>
              <div>
                <label className={LABEL}>Horas a Cubrir *</label>
                <input type="number" min="1" step="1" className={`${INPUT} ${errors.horas ? 'border-red-400' : ''}`} placeholder="Ej. 480" value={horas} onChange={e => setHoras(e.target.value.replace(/[^0-9]/g, ''))} />
                {errors.horas && <p className="text-xs text-red-500 mt-1">{errors.horas}</p>}
              </div>
              <div>
                <label className={LABEL}>Nombre del Programa <span className="font-normal normal-case text-gray-400">(opcional)</span></label>
                <input type="text" className={INPUT} placeholder="Ej. Programa Nacional de Servicio Social en Salud" value={programa} onChange={e => setPrograma(e.target.value)} />
              </div>
            </>
          )}

          {/* ── ART. 52: Motivo y Documentos ── */}
          {variante === 'ART_52' && (
            <div className="flex flex-col gap-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-[10px] px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                Exención por condición personal. Solo puede aplicar <strong>uno</strong> de los dos motivos. Al registrar, quedará <strong>Liberado</strong> automáticamente.
              </div>
              <div>
                <label className={LABEL}>Motivo de Exención *</label>
                <div className="flex gap-3">
                  {[{ id: 'EDAD', label: 'Más de 60 años' }, { id: 'ENFERMEDAD', label: 'Enfermedad grave o incapacitante' }].map(m => (
                    <button key={m.id} type="button" onClick={() => setMotivo52(m.id as any)}
                      className={`flex-1 py-2.5 px-3 rounded-[8px] text-sm font-semibold border transition-all text-center ${motivo52 === m.id ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white dark:bg-[#181e25] text-[#45515e] dark:text-gray-300 border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] hover:border-amber-400'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {errors.motivo52 && <p className="text-xs text-red-500 mt-1">{errors.motivo52}</p>}
              </div>

              {/* Requisito según motivo */}
              {motivo52 === 'EDAD' && (
                <div>
                  <label className={LABEL}>Acta de Nacimiento</label>
                  <div className="flex gap-3">
                    {[{ id: 'PENDIENTE', label: 'Pendiente' }, { id: 'ENTREGADO', label: 'Entregada' }].map(d => (
                      <button key={d.id} type="button" onClick={() => setDocActa(d.id as any)}
                        className={`flex-1 py-2 rounded-[8px] text-sm font-semibold border transition-all ${docActa === d.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-[#181e25] text-[#45515e] dark:text-gray-300 border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] hover:border-purple-400'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {motivo52 === 'ENFERMEDAD' && (
                <div>
                  <label className={LABEL}>Expediente Médico</label>
                  <div className="flex gap-3">
                    {[{ id: 'PENDIENTE', label: 'Pendiente' }, { id: 'ENTREGADO', label: 'Entregado' }].map(d => (
                      <button key={d.id} type="button" onClick={() => setDocExp(d.id as any)}
                        className={`flex-1 py-2 rounded-[8px] text-sm font-semibold border transition-all ${docExp === d.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-[#181e25] text-[#45515e] dark:text-gray-300 border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] hover:border-purple-400'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error inline */}
          {saveError && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-[10px] px-4 py-3 text-sm">
              <span className="text-red-500 shrink-0 mt-0.5">✕</span>
              <div>
                <p className="font-semibold">No se pudo guardar el registro</p>
                <p className="text-xs mt-0.5 text-red-600 dark:text-red-400 opacity-80">{saveError}</p>
              </div>
              <button type="button" onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600 shrink-0">✕</button>
            </div>
          )}

          {/* ── ART. 91: Fecha inicio labores y requisitos ── */}
          {variante === 'ART_91' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className={LABEL}>Fecha de Inicio de Labores *</label>
                <input type="date" className={`${INPUT} ${errors.fechaInicioLabores ? 'border-red-400' : ''}`} value={fechaInicioLabores} onChange={e => setFechaInicioLabores(e.target.value)} />
                {errors.fechaInicioLabores && <p className="text-xs text-red-500 mt-1">{errors.fechaInicioLabores}</p>}
              </div>

              <div>
                <label className={LABEL}>Requisitos de Comprobación</label>
                {!art91Complete && <p className="text-xs text-[#8e8e93] mb-2">Si falta alguno, podrás completarlos editando el registro después.</p>}
                {art91Complete && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-[8px] px-3 py-2 mb-2">
                    <CheckCircle2 size={13} /> Los 3 requisitos completos — quedará Liberado al guardar.
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {[
                    { key: 'constancia', label: 'Constancia oficial de servicios', val: reqConstancia, set: setReqConstancia },
                    { key: 'comprobantes', label: 'Comprobantes de pago', val: reqComprobantes, set: setReqComprobantes },
                    { key: 'informe', label: 'Informe de actividades', val: reqInforme, set: setReqInforme },
                  ].map(r => (
                    <label key={r.key} className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => r.set(!r.val)}
                        className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all shrink-0 ${r.val ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-purple-400'}`}>
                        {r.val && <svg viewBox="0 0 12 10" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1,5 4.5,8.5 11,1" /></svg>}
                      </div>
                      <span className={`text-sm ${r.val ? 'text-[#222222] dark:text-gray-100 font-medium' : 'text-[#45515e] dark:text-gray-400'}`}>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] mt-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-[#45515e] dark:text-gray-400 hover:bg-[#f0f0f0] dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-[8px] shadow-md transition-colors disabled:opacity-60 active:scale-95">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isEdit ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
