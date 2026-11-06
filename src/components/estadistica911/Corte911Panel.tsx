import { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { useState } from 'react';
import type { Expediente911 } from '../../estadistica911/types';
import { CORTE_EDICION911, cortePendiente911 } from '../../estadistica911/corte';
import { fechaValida911 } from '../../estadistica911/calculo';
import ModalConfirmacion from '../ui/ModalConfirmacion';

export default function Corte911Panel({ exp, editable, onChange }: {
  exp: Expediente911; editable: boolean; onChange: (e: Expediente911) => void;
}) {
  const [propuesta, setPropuesta] = useState<{ corte: string; personalizado: boolean } | null>(null);
  const c = exp.config;
  function solicitar(corte: string, personalizado: boolean) {
    if (!editable || !fechaValida911(corte)) return;
    if (corte !== c.corte) setPropuesta({ corte, personalizado });
    else aplicar(corte, personalizado);
  }
  function aplicar(corte: string, personalizado: boolean) {
    onChange({ ...exp, config: { ...c, corte, cortePersonalizado: personalizado,
      motivoCorte: personalizado ? c.motivoCorte : '' }, revisiones: {} });
    setPropuesta(null);
  }
  return <section className="s911-card">
    <h2>Fecha de corte de matrícula</h2>
    <p>Referencia de la edición 2026–2027: <strong>30/09/2026</strong>. Puedes usar otra fecha para este expediente; las plantillas originales conservarán su fecha impresa.</p>
    <fieldset disabled={!editable} className="s911-grid">
      <label className="s911-check s911-span"><input type="checkbox" checked={c.cortePersonalizado === true}
        onChange={e => solicitar(e.target.checked ? c.corte : CORTE_EDICION911, e.target.checked)} />Usar una fecha de corte personalizada</label>
      <CampoConAyuda etiqueta="Fecha a la que se contará la matrícula" ayuda={ayuda.corte}><input type="date" value={c.corte} readOnly={!c.cortePersonalizado}
        onChange={e => solicitar(e.target.value, true)} /></CampoConAyuda>
      {c.cortePersonalizado && <label className="s911-span">Motivo del corte personalizado (20–2000 caracteres)
        <textarea maxLength={2000} value={c.motivoCorte || ''} onChange={e => onChange({ ...exp,
          config: { ...c, motivoCorte: e.target.value }, revisiones: {} })} /></label>}
    </fieldset>
    <p className="s911-note">La fecha para calcular edades, los ciclos y los periodos anteriores se revisan por separado. Al cambiar el corte se conservan las capturas justificadas y se requiere un nuevo cálculo.</p>
    {cortePendiente911(exp) && <p className="s911-warning" role="status">Cálculo pendiente para este corte. Acredita nuevamente matrícula, primer ingreso actual y personal; después ve a «Calcular y revisar», pulsa «Recalcular» y aplica las diferencias antes de exportar o cerrar.</p>}
    <ModalConfirmacion isOpen={Boolean(propuesta)} title="Cambiar fecha de corte"
      message={`Se cambiará de ${c.corte} a ${propuesta?.corte}. Se retirarán las cifras calculadas, sus revisiones y la acreditación de cobertura de matrícula, primer ingreso actual y personal. Se conservarán las capturas justificadas y las versiones cerradas. Deberás acreditar la cobertura y recalcular.`}
      confirmText="Cambiar corte" onCancel={() => setPropuesta(null)}
      onConfirm={() => propuesta && aplicar(propuesta.corte, propuesta.personalizado)} />
  </section>;
}
