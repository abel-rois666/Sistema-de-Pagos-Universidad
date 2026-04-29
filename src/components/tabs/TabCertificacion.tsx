import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Award, Loader2, Save, CheckCircle2, Clock, Ban,
  AlertCircle, ChevronDown, X, Edit3, CalendarDays, Flag, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { FichaCertificacion } from '../../types';
import DrivePicker from '../DrivePicker';

// ── Helpers ──────────────────────────────────────────────────────────────────
function addBusinessDays(start: Date, days: number): Date {
  let count = 0; const d = new Date(start);
  while (count < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) count++; }
  return d;
}
function businessDaysLeft(end: Date): number {
  const today = new Date(); today.setHours(0,0,0,0);
  if (today >= end) return 0;
  let count = 0; const c = new Date(today);
  while (c < end) { c.setDate(c.getDate() + 1); if (c.getDay() !== 0 && c.getDay() !== 6) count++; }
  return count;
}
function toInputDate(d: Date) { return d.toISOString().slice(0,10); }

function checkRequisitos(draft: typeof BLANK, esEspecialidad: boolean): boolean {
  const base =
    draft.pago_certificado    === 'COMPLETADO' &&
    draft.doc_acta_nacimiento === 'APROBADO'   &&
    draft.doc_curp            === 'APROBADO'   &&
    draft.doc_antecedente     === 'APROBADO'   &&
    !!draft.tipo_certificado;
  if (!base) return false;
  if (esEspecialidad) return draft.doc_titulo_profesional === 'APROBADO' && draft.doc_cedula_profesional === 'APROBADO';
  return true;
}

function getEstatus(ficha: FichaCertificacion | null, editing: boolean): 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO' {
  if (ficha?.tramite_completado) return 'COMPLETADO';
  if (ficha || editing) return 'EN_CURSO';
  return 'SIN_INICIAR';
}

// ── Badge maps ────────────────────────────────────────────────────────────────
const B_EST = {
  SIN_INICIAR: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  EN_CURSO:    'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700',
  COMPLETADO:  'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700',
};
const B_DOC = {
  SIN_INICIAR: B_EST.SIN_INICIAR,
  APROBADO:    B_EST.COMPLETADO,
  RECHAZADO:   'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700',
};

// ── Custom Dropdown (fixed position, dark-mode safe) ─────────────────────────
function CustomDrop({ opciones, value, onChange, badgeMap, disabled }: {
  opciones: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
  badgeMap: Record<string, string>; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const label = opciones.find(o => o.value === value)?.label ?? value;
  const badge = badgeMap[value] ?? B_EST.SIN_INICIAR;

  const handleOpen = () => {
    if (!btnRef.current) { setOpen(v => !v); return; }
    const r = btnRef.current.getBoundingClientRect();
    const panelH = opciones.length * 34 + 8;
    const openUp = window.innerHeight - r.bottom < panelH + 16;
    setStyle({ position:'fixed', zIndex:9999, left:r.left, minWidth:Math.max(r.width,140), ...(openUp ? {bottom:window.innerHeight-r.top+4} : {top:r.bottom+4}) });
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (disabled) return <span className={`inline-flex items-center pl-3 pr-3 py-1.5 text-xs font-semibold rounded-full border ${badge} opacity-80`}>{label}</span>;

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-xs font-semibold rounded-full border cursor-pointer outline-none focus:ring-2 focus:ring-blue-400 ${badge}`}>
        {label}<ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={panelRef} style={style} className="bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[10px] shadow-2xl overflow-hidden">
          {opciones.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${o.value === value ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-[#222222] dark:text-gray-200 hover:bg-[#f2f3f5] dark:hover:bg-[rgba(255,255,255,0.07)]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── SelectorReq ───────────────────────────────────────────────────────────────
function SelectorReq({ label, opciones, value, nota, conNota, onChange, onNota, badgeMap, disabled }: {
  label: string; opciones: { value: string; label: string }[];
  value: string; nota?: string | null; conNota?: boolean;
  onChange: (v: string) => void; onNota?: (v: string) => void;
  badgeMap: Record<string, string>; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#45515e] dark:text-gray-300 min-w-[200px]">{label}</label>
        <CustomDrop opciones={opciones} value={value} onChange={onChange} badgeMap={badgeMap} disabled={disabled} />
      </div>
      {conNota && value === 'RECHAZADO' && (
        <div className="ml-[212px] mt-1">
          <textarea rows={2} placeholder="Motivo del rechazo..." value={nota ?? ''}
            onChange={e => onNota?.(e.target.value)}
            className="w-full text-xs border border-red-200 dark:border-red-800 rounded-[8px] px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 outline-none focus:ring-2 focus:ring-red-400 resize-none" />
        </div>
      )}
    </div>
  );
}

// ── BLANK ─────────────────────────────────────────────────────────────────────
const BLANK = {
  pago_certificado: 'SIN_INICIAR' as const,
  doc_acta_nacimiento: 'SIN_INICIAR' as const, doc_acta_nacimiento_nota: null as string|null,
  doc_curp: 'SIN_INICIAR' as const,            doc_curp_nota: null as string|null,
  doc_antecedente: 'SIN_INICIAR' as const,     doc_antecedente_nota: null as string|null,
  doc_titulo_profesional: 'SIN_INICIAR' as const, doc_titulo_profesional_nota: null as string|null,
  doc_cedula_profesional: 'SIN_INICIAR' as const, doc_cedula_profesional_nota: null as string|null,
  tipo_certificado: null as 'TOTAL'|'PARCIAL'|null,
  fecha_inicio_tramite: null as string|null,
  fecha_termino_tramite: null as string|null,
  tramite_completado: false,
  fecha_completado: null as string|null,
  enlace_drive: null as string|null,
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  alumnoId: string;
  esEspecialidad: boolean;
  onEstatusChange?: (e: 'SIN_INICIAR'|'EN_CURSO'|'COMPLETADO') => void;
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function TabCertificacion({ alumnoId, esEspecialidad, onEstatusChange }: Props) {
  const [ficha, setFicha]       = useState<FichaCertificacion|null>(null);
  const [draft, setDraft]       = useState(BLANK);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editing, setEditing]   = useState(false);
  const [saved, setSaved]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('ficha_certificacion').select('*').eq('alumno_id', alumnoId).maybeSingle();
    if (data) {
      setFicha(data as FichaCertificacion);
      const { id: _i, alumno_id: _a, created_at: _c, updated_at: _u, ...rest } = data as FichaCertificacion;
      setDraft(rest as typeof BLANK);
    } else {
      setFicha(null); setDraft({ ...BLANK });
    }
    setLoading(false);
  }, [alumnoId]);

  useEffect(() => { load(); }, [load]);

  const estatus = getEstatus(ficha, editing);
  useEffect(() => { onEstatusChange?.(estatus); }, [estatus, onEstatusChange]);

  const set = (field: keyof typeof BLANK, val: unknown) =>
    setDraft(p => ({ ...p, [field]: val }));

  const handleFechaInicio = (val: string) => {
    setDraft(p => ({
      ...p,
      fecha_inicio_tramite: val || null,
      fecha_termino_tramite: val ? toInputDate(addBusinessDays(new Date(val + 'T12:00:00'), 70)) : null,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    if (ficha) {
      await supabase.from('ficha_certificacion').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', ficha.id);
    } else {
      const { data } = await supabase.from('ficha_certificacion').insert({ alumno_id: alumnoId, ...draft }).select().single();
      if (data) setFicha(data as FichaCertificacion);
    }
    setSaving(false); setEditing(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  };

  const handleCancel = () => {
    setEditing(false);
    if (ficha) {
      const { id: _i, alumno_id: _a, created_at: _c, updated_at: _u, ...r } = ficha;
      setDraft(r as typeof BLANK);
    } else setDraft({ ...BLANK });
  };

  // ── Derivados ──────────────────────────────────────────────────────────────
  const requisitosMet = editing
    ? checkRequisitos(draft, esEspecialidad)
    : (ficha ? checkRequisitos(ficha as unknown as typeof BLANK, esEspecialidad) : false);

  const diasRestantes = (() => {
    const f = ficha?.fecha_termino_tramite ?? draft.fecha_termino_tramite;
    return f ? businessDaysLeft(new Date(f + 'T23:59:59')) : null;
  })();

  const LABEL = { SIN_INICIAR:'Proceso sin iniciar', EN_CURSO:'En Curso', COMPLETADO:'Proceso completado' };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-sky-400" /></div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100 flex items-center gap-2">
            <span className="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 p-1.5 rounded-[8px]"><Award size={18} /></span>
            Ficha de Certificación
          </h3>
          <div className="ml-10 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${estatus === 'SIN_INICIAR' ? B_EST.SIN_INICIAR : estatus === 'EN_CURSO' ? B_EST.EN_CURSO : B_EST.COMPLETADO}`}>
              {estatus === 'SIN_INICIAR' ? <Ban size={12}/> : estatus === 'EN_CURSO' ? <Clock size={12}/> : <CheckCircle2 size={12}/>}
              {LABEL[estatus]}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {saved && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-[8px]"><CheckCircle2 size={13}/> Guardado</span>}
          {editing ? (
            <div className="flex gap-2">
              <button onClick={handleCancel} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[8px] transition-colors"><X size={14}/> Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-[8px] shadow-sm transition-colors active:scale-95">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-[8px] shadow-sm transition-colors active:scale-95">
              <Edit3 size={14}/> {ficha ? 'Editar' : 'Iniciar Registro'}
            </button>
          )}
        </div>
      </div>

      {/* Secciones — solo si hay ficha o se edita */}
      {(ficha || editing) && (
        <div className="bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[16px]">

          {/* Pago */}
          <div className="px-5 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-4">Pago</p>
            <SelectorReq label="Pago de Certificado"
              opciones={[{value:'SIN_INICIAR',label:'Sin iniciar'},{value:'EN_CURSO',label:'En curso'},{value:'COMPLETADO',label:'Completado'}]}
              value={draft.pago_certificado} onChange={v => set('pago_certificado', v)} badgeMap={B_EST} disabled={!editing} />
          </div>

          {/* Revisión documental */}
          <div className="px-5 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-4">Revisión Documental</p>
            <div className="space-y-3">
              {([
                {field:'doc_acta_nacimiento' as const, nota:'doc_acta_nacimiento_nota' as const, label:'Acta de Nacimiento'},
                {field:'doc_curp'            as const, nota:'doc_curp_nota'            as const, label:'CURP'},
                {field:'doc_antecedente'     as const, nota:'doc_antecedente_nota'     as const, label:'Antecedente Académico'},
              ]).map(({field, nota, label}) => (
                <SelectorReq key={field} label={label}
                  opciones={[{value:'SIN_INICIAR',label:'Sin iniciar'},{value:'APROBADO',label:'Aprobado'},{value:'RECHAZADO',label:'Rechazado'}]}
                  value={draft[field]} nota={draft[nota]} conNota
                  onChange={v => set(field, v)} onNota={v => set(nota, v)}
                  badgeMap={B_DOC} disabled={!editing} />
              ))}

              {esEspecialidad && ([
                {field:'doc_titulo_profesional' as const, nota:'doc_titulo_profesional_nota' as const, label:'Título Profesional'},
                {field:'doc_cedula_profesional' as const, nota:'doc_cedula_profesional_nota' as const, label:'Cédula Profesional'},
              ]).map(({field, nota, label}) => (
                <SelectorReq key={field} label={label}
                  opciones={[{value:'SIN_INICIAR',label:'Sin iniciar'},{value:'APROBADO',label:'Aprobado'},{value:'RECHAZADO',label:'Rechazado'}]}
                  value={draft[field]} nota={draft[nota]} conNota
                  onChange={v => set(field, v)} onNota={v => set(nota, v)}
                  badgeMap={B_DOC} disabled={!editing} />
              ))}
            </div>
          </div>

          {/* Tipo de Certificado */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-4">Tipo de Certificado</p>
            <SelectorReq label="Tipo de Certificado"
              opciones={[{value:'TOTAL',label:'Total'},{value:'PARCIAL',label:'Parcial'}]}
              value={draft.tipo_certificado ?? ''}
              onChange={v => set('tipo_certificado', v || null)}
              badgeMap={{TOTAL: B_EST.COMPLETADO, PARCIAL: B_EST.EN_CURSO}} disabled={!editing} />
          </div>
        </div>
      )}

      {/* Inicio de Trámite */}
      {(ficha || editing) && (
        <div className={`border rounded-[16px] transition-all duration-200 ${
          requisitosMet
            ? 'bg-white dark:bg-[#181e25] border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]'
            : 'bg-[#f8f9ff] dark:bg-[#1a1f26] border-dashed border-gray-200 dark:border-gray-700/50'
        }`}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
            <div className={`p-1.5 rounded-[8px] ${ficha?.tramite_completado ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : requisitosMet ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              <Flag size={16}/>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#222222] dark:text-gray-100">Inicio de Trámite</p>
              <p className="text-[11px] text-[#8e8e93]">{ficha?.tramite_completado ? 'Trámite finalizado' : requisitosMet ? 'Requisitos cubiertos — habilitado' : 'Se habilita al cubrir todos los requisitos'}</p>
            </div>
            {!requisitosMet && !ficha?.tramite_completado && <Lock size={14} className="ml-auto text-gray-400"/>}
          </div>

          {!requisitosMet && !draft.tramite_completado && (
            <div className="flex items-center gap-3 px-5 py-5 text-sm text-[#8e8e93]">
              <AlertCircle size={16} className="text-amber-400 shrink-0"/> Cubre todos los requisitos para habilitar esta sección.
            </div>
          )}

          {(requisitosMet || draft.tramite_completado) && (
            <div className="px-5 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider flex items-center gap-1.5"><CalendarDays size={12}/> Fecha de Inicio</label>
                  <input type="date" disabled={!editing} value={(draft.fecha_inicio_tramite as string) ?? ''} onChange={e => handleFechaInicio(e.target.value)}
                    className="px-3 py-2 text-sm rounded-[10px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider flex items-center gap-1.5"><CalendarDays size={12}/> Fecha de Término <span className="text-[10px] normal-case text-sky-500 font-normal">(70 días hábiles)</span></label>
                  <input type="date" disabled={!editing} value={(draft.fecha_termino_tramite as string) ?? ''} onChange={e => set('fecha_termino_tramite', e.target.value || null)}
                    className="px-3 py-2 text-sm rounded-[10px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60" />
                </div>
              </div>

              {draft.fecha_termino_tramite && diasRestantes !== null && !draft.tramite_completado && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border text-sm font-semibold ${diasRestantes <= 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : diasRestantes <= 15 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'}`}>
                  <Clock size={16} className="shrink-0"/>
                  {diasRestantes <= 0 ? 'Fecha de término vencida' : `${diasRestantes} días hábiles restantes`}
                </div>
              )}

              {/* Status Section */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                <div>
                  {draft.tramite_completado ? (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={16}/>
                      <span className="text-sm font-semibold">Proceso Completado</span>
                      {draft.fecha_completado && <span className="text-xs text-[#8e8e93] font-normal ml-1">(el {new Date(draft.fecha_completado).toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})})</span>}
                    </div>
                  ) : (
                    <span className="text-sm text-[#8e8e93] font-semibold">Proceso en trámite</span>
                  )}
                </div>

                {editing && (
                  <div>
                    {draft.tramite_completado ? (
                      <button type="button" onClick={() => { 
                          setDraft(prev => ({
                            ...prev,
                            tramite_completado: false,
                            fecha_completado: null,
                            pago_certificado: 'SIN_INICIAR',
                            doc_acta_nacimiento: 'SIN_INICIAR', doc_acta_nacimiento_nota: null,
                            doc_curp: 'SIN_INICIAR', doc_curp_nota: null,
                            doc_antecedente: 'SIN_INICIAR', doc_antecedente_nota: null,
                            doc_titulo_profesional: 'SIN_INICIAR', doc_titulo_profesional_nota: null,
                            doc_cedula_profesional: 'SIN_INICIAR', doc_cedula_profesional_nota: null
                          }));
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        Revertir a En Trámite
                      </button>
                    ) : (
                      <button type="button" onClick={() => { set('tramite_completado', true); set('fecha_completado', new Date().toISOString()); }}
                        disabled={!draft.fecha_inicio_tramite}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                        <CheckCircle2 size={14}/> Marcar como Completado
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DrivePicker
            label="Expediente Digital"
            value={draft.enlace_drive}
            onSelect={(url) => set('enlace_drive', url)}
            disabled={!draft.tramite_completado}
            isEditing={editing}
          />
        </div>
      )}

      {/* Empty state */}
      {!ficha && !editing && (
        <div className="flex flex-col items-center justify-center py-14 bg-[#f8f9ff] dark:bg-[#1c2228] rounded-[20px] border border-dashed border-sky-200 dark:border-sky-900/40">
          <div className="bg-sky-100 dark:bg-sky-900/30 p-4 rounded-[13px] text-sky-500 mb-4"><Award size={32}/></div>
          <p className="text-base font-semibold text-[#45515e] dark:text-gray-300">Sin proceso de certificación iniciado</p>
          <p className="text-sm text-[#8e8e93] mt-1">Usa <strong>"Iniciar Registro"</strong> para comenzar el seguimiento.</p>
        </div>
      )}
    </div>
  );
}
