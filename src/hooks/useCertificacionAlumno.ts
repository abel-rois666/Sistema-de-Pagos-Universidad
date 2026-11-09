import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { FichaCertificacion } from '../types';
import { certificacionService, type ConsultaCertificacion } from '../services/certificacionService';
import { reabrirCertificado } from '../certificacion/seguimiento';

export const nuevaCertificacion = (alumnoId: string, programaId: string): FichaCertificacion => ({
  id: crypto.randomUUID(), alumno_id: alumnoId, alumno_programa_id: programaId, revision: 0,
  pago_certificado: 'SIN_INICIAR', tipo_certificado: null, doc_acta_nacimiento: 'SIN_INICIAR', doc_acta_nacimiento_nota: null,
  doc_curp: 'SIN_INICIAR', doc_curp_nota: null, doc_antecedente: 'SIN_INICIAR', doc_antecedente_nota: null,
  doc_titulo_profesional: 'SIN_INICIAR', doc_titulo_profesional_nota: null, doc_cedula_profesional: 'SIN_INICIAR', doc_cedula_profesional_nota: null,
  fecha_inicio_tramite: null, fecha_termino_tramite: null, tramite_completado: false, fecha_completado: null, enlace_drive: null
});
export function useCertificacionAlumno(alumnoId: string, programaInicialId?: string, onUpdate?: () => void) {
  const [consulta,setConsulta] = useState<ConsultaCertificacion>({ fichas: [], programas: [], disponible: false });
  const [programaId,setProgramaId] = useState(programaInicialId || '');
  const [draft,setDraft] = useState<FichaCertificacion | null>(null);
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [saving,setSaving] = useState(false), [revision,setRevision] = useState(0);
  const contexto = useRef(0), ocupado = useRef(false), actualizado = useRef(onUpdate); actualizado.current = onUpdate;
  const [alumnoCargado,setAlumnoCargado] = useState('');
  useEffect(() => {
    const control = new AbortController(), turno = ++contexto.current;
    setLoading(true); setError(''); setDraft(null); setConsulta({fichas:[],programas:[],disponible:false});
    void certificacionService.consultar(alumnoId,control.signal).then(data => {
      if (turno !== contexto.current || control.signal.aborted) return;
      setConsulta(data); setAlumnoCargado(alumnoId);
      setProgramaId(actual => data.programas.some(p => p.id === actual) ? actual
        : data.programas.some(p => p.id === programaInicialId) ? programaInicialId! : data.programas.length === 1 ? data.programas[0].id : '');
    }).catch(e => { if (!control.signal.aborted) setError(e.message || 'No se pudo consultar la certificación.'); })
      .finally(() => { if (!control.signal.aborted) setLoading(false); });
    return () => { contexto.current++; control.abort(); };
  },[alumnoId,programaInicialId,revision]);
  const ficha = consulta.fichas.find(f => f.alumno_programa_id === programaId) || null;
  const legado = consulta.fichas.filter(f => !f.alumno_programa_id);
  const programa = consulta.programas.find(p => p.id === programaId);
  const [fichaAnterior,setFichaAnterior] = useState(programaInicialId === '__legado__');
  useEffect(() => { setFichaAnterior(programaInicialId === '__legado__'); },[alumnoId,programaInicialId]);
  const visible = fichaAnterior ? legado[0] || null : ficha;
  const iniciar = () => { if (!ocupado.current && programaId && consulta.disponible) setDraft(visible ? { ...visible, alumno_programa_id: programaId } : nuevaCertificacion(alumnoId,programaId)); };
  const set = (campo: keyof FichaCertificacion, valor: unknown) => { if (!ocupado.current) setDraft(d => d ? { ...d, [campo]: valor } : d); };
  const guardar = async (motivo = '') => {
    if (!draft || ocupado.current) return;
    ocupado.current = true; setSaving(true); setError('');
    try {
      const guardada = await certificacionService.guardar(draft,motivo);
      setConsulta(c => ({ ...c, fichas: [...c.fichas.filter(f => f.id !== guardada.id),guardada] }));
      setDraft(null); setFichaAnterior(false); toast.success('Certificación guardada para este programa.'); actualizado.current?.();
    } catch (e) { setError((e as Error).message); toast.error('No se guardó la certificación. La captura se conserva.'); }
    finally { ocupado.current = false; setSaving(false); }
  };
  const archivar = async (motivo: string) => {
    if (!visible || ocupado.current) return;
    ocupado.current = true; setSaving(true);
    try { await certificacionService.archivar(visible,motivo); setConsulta(c=>({...c,fichas:c.fichas.filter(f=>f.id!==visible.id)})); setFichaAnterior(false); toast.success('Ficha archivada. Se conserva en auditoría.'); actualizado.current?.(); }
    finally { ocupado.current = false; setSaving(false); }
  };
  return { ...consulta, ficha: visible, legado, programaId, programa, setProgramaId, fichaAnterior,setFichaAnterior,
    draft,set, loading: loading || alumnoCargado !== alumnoId, error,saving, iniciar,guardar,archivar,
    reabrir: () => { if (draft) setDraft(reabrirCertificado(draft)); }, cancelar: () => { if (!ocupado.current) { setDraft(null);setError(''); } },
    recargar: useCallback(() => setRevision(r=>r+1),[]) };
}
