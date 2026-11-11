import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AlumnoPrograma } from '../../types';
import { retiroAsociacionProgramaService as service, type RevisionRetiroPrograma } from '../../services/retiroAsociacionProgramaService';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { CampoConAyuda } from '../ui/AyudaContextual';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import './retiroAsociacionPrograma.css';

export default function RetirarAsociacionPrograma({ alumnoId, programa, onCerrar, onRetirado }: {
  alumnoId: string; programa: AlumnoPrograma; onCerrar: () => void; onRetirado: (id: string) => Promise<void>;
}) {
  const [revision, setRevision] = useState<RevisionRetiroPrograma | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false), [descartar, setDescartar] = useState(false), [recarga, setRecarga] = useState(0);
  const enCurso = useRef(false);
  const [prueba, setPrueba] = useState(false), [frase, setFrase] = useState('');
  useProteccionCaptura(Boolean(motivo.trim()) || confirmado || Boolean(frase), busy);
  useEffect(() => {
    const control = new AbortController(); setLoading(true); setError(''); setRevision(null); setConfirmado(false); setFrase('');
    void service.revisar(alumnoId, programa.id, control.signal, prueba).then(r => { if (!control.signal.aborted) setRevision(r); })
      .catch(e => { if (!control.signal.aborted) setError(e.message || 'No se pudo revisar la asociación.'); })
      .finally(() => { if (!control.signal.aborted) setLoading(false); });
    return () => control.abort();
  }, [alumnoId, programa.id, recarga, prueba]);
  const antecedentesOrdenados = useMemo(() => {
    if (!revision?.antecedentes) return [];
    return [...revision.antecedentes].sort((a, b) => Number(Boolean(b.bloquea)) - Number(Boolean(a.bloquea)));
  }, [revision]);
  const antecedentesBloqueantes = useMemo(
    () => antecedentesOrdenados.filter(a => a.bloquea),
    [antecedentesOrdenados]
  );
  const cerrar = useCallback(() => { if (enCurso.current) return; if (motivo.trim() || confirmado || frase) setDescartar(true); else onCerrar(); }, [motivo, confirmado, frase, onCerrar]);
  const retirar = async () => {
    if (enCurso.current || !revision?.puedeRetirar || !confirmado) return;
    enCurso.current = true; setBusy(true);
    try {
      await service.retirar(revision, motivo, frase);
      toast.success('Asociación retirada. El plan del catálogo se conserva.');
      try { await onRetirado(programa.id); } catch { toast.error('Se retiró la asociación, pero falta actualizar la ficha. Usa Actualizar antes de continuar.'); }
      onCerrar();
    } catch (e) { setConfirmado(false); setError(e instanceof Error ? e.message : 'No se pudo confirmar el retiro. Actualiza la revisión.'); toast.error('No se confirmó el retiro. Revisa el aviso antes de continuar.'); }
    finally { enCurso.current = false; setBusy(false); }
  };
  return <>
    <ModalConfirmacion isOpen title="Revisar asociación añadida por error" type="danger" wide busy={busy}
      onCancel={cerrar} onConfirm={retirar} confirmText={prueba ? 'Retirar asociación de prueba' : 'Retirar asociación de este alumno'}
      confirmDisabled={loading || Boolean(error) || !revision?.puedeRetirar || !confirmado || motivo.trim().length < 10 || (prueba && frase !== 'RETIRAR PRUEBA')}
      message={<div className="retiro-programa">
        <div className="retiro-programa-contexto"><span>Programa que se revisa</span><strong>{revision?.programa || [programa.planes_estudio?.clave_legado, programa.planes_estudio?.nombre].filter(Boolean).join(' · ') || 'Programa seleccionado'}</strong></div>
        <p>{prueba ? 'Esta opción retira la asociación de prueba y sus materias vacías revisadas.' : 'Esta acción retira únicamente la asociación del alumno.'} El plan del catálogo y los programas de otros alumnos se conservan.</p>
        <label className="retiro-programa-check"><input type="checkbox" checked={prueba} disabled={busy || loading} onChange={e => setPrueba(e.target.checked)} />Revisar materias vacías y certificaciones creadas como prueba</label>
        {prueba && <p>Se revisarán los registros sin notas ni otra información académica. Un cero o NP cuenta como calificación. Las certificaciones descartadas se conservarán archivadas con respaldo en auditoría. El programa principal, los pagos y los recibos se conservan.</p>}
        {loading && <p role="status" className="retiro-programa-cargando"><Loader2 size={16} className="animate-spin" />Revisando antecedentes en el servidor…</p>}
        {error && <p role="alert" className="retiro-programa-error">{error}</p>}
        {revision && <>
          {revision.esPrueba && <div className="retiro-programa-contexto"><strong>Alcance de la revisión de prueba</strong><span>Materias vacías: {revision.materiasVacias} · Certificaciones asociadas: {revision.certificacionesPrueba}. Revisa este alcance antes de declararlas de prueba.</span></div>}
          {revision.motivos.length > 0 && <div className="retiro-programa-bloqueo"><strong>La asociación necesita revisión individual</strong><ul>{revision.motivos.map(m => <li key={m}>{m}</li>)}{antecedentesBloqueantes.map(a => <li key={`bloq-${a.clave}`}><strong>{a.etiqueta}:</strong> {a.cantidad === null ? 'Requiere revisión' : `${a.cantidad} registro(s) que impiden el retiro`}</li>)}</ul></div>}
          <h4>Antecedentes revisados</h4>
          <ul className="retiro-programa-antecedentes">{antecedentesOrdenados.map(a => <li key={a.clave} className={a.bloquea ? 'retiro-programa-antecedente-bloquea' : undefined}><span>{a.etiqueta}</span><strong>{a.cantidad === null ? 'Requiere revisión' : a.cantidad}</strong></li>)}</ul>
          {!revision.antecedentes.length && <p>Sin referencias adicionales registradas.</p>}
          {revision.puedeRetirar && <>
            {!error && <p className="retiro-programa-apto">{revision.esPrueba ? 'La revisión permite depurar los registros declarados de prueba.' : 'La revisión no encontró antecedentes que impidan retirar esta asociación.'} El servidor volverá a comprobarlos al confirmar.</p>}
            <CampoConAyuda etiqueta="Motivo del retiro" ayuda="Describe qué asociación se añadió por error y qué comprobaste. Se conservarán el motivo y los datos anteriores en la auditoría.">
              <textarea disabled={busy} rows={3} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por ejemplo: asociación añadida por error al capturar el programa…" />
            </CampoConAyuda>
            <label className="retiro-programa-check"><input type="checkbox" disabled={busy} checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Revisé el programa y confirmo que esta asociación se añadió por error.</label>
            {prueba && <CampoConAyuda etiqueta="Confirmar datos de prueba" ayuda="Confirma que las materias vacías y las certificaciones de esta asociación son de prueba. Se guardará su información anterior en auditoría."><input disabled={busy} className="retiro-programa-frase" autoComplete="off" value={frase} onChange={e => setFrase(e.target.value)} placeholder="Escribe RETIRAR PRUEBA" /></CampoConAyuda>}
          </>}
        </>}
        <button type="button" className="retiro-programa-recargar" disabled={loading || busy} onClick={() => setRecarga(n => n + 1)}><RefreshCw size={14} />Actualizar revisión</button>
      </div>} />
    <ModalConfirmacion isOpen={descartar} title="Cerrar revisión de asociación" message="Se descartará el motivo capturado y no se retirará la asociación." onCancel={() => setDescartar(false)} onConfirm={() => { setDescartar(false); onCerrar(); }} confirmText="Descartar captura" />
  </>;
}
