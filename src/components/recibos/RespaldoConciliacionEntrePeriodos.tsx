import { MOTIVOS_CONCILIACION, type RespaldoConciliacion } from '../../finanzas/conciliacionEntrePeriodos';
import { CampoConAyuda } from '../ui/AyudaContextual';

export default function RespaldoConciliacionEntrePeriodos({ value, onChange }: { value: RespaldoConciliacion; onChange: (value: RespaldoConciliacion) => void }) {
  const campo = 'w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
  return <section className="space-y-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100" aria-label="Conciliación entre periodos">
    <h3 className="font-semibold">El recibo y el plan pertenecen a periodos distintos</h3>
    <p>Administración o Coordinación Financiera debe documentar por qué este pago corresponde al plan elegido. El recibo conserva su ciclo original y sus datos fiscales.</p>
    <CampoConAyuda className="sm:max-w-sm [&_.campo-con-ayuda-etiqueta]:text-sm" etiqueta="Motivo de conciliación" ayuda="Elige la causa de la asociación entre ciclos. El motivo y el respaldo se guardarán con el usuario, origen, destino e importe.">
      <select className={`${campo} h-[42px]`} value={value.motivo} onChange={e => onChange({ ...value, motivo: e.target.value })}>
        <option value="">Selecciona un motivo</option>
        {MOTIVOS_CONCILIACION.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
      </select>
    </CampoConAyuda>
    <CampoConAyuda className="[&_.campo-con-ayuda-etiqueta]:text-sm" etiqueta="Respaldo de la conciliación" ayuda="Anota la referencia verificable y explica cómo comprobaste el destino del pago. Por ejemplo: solicitud de anticipo, convenio o revisión del expediente. Si eliges Otro, explica la causa. No basta con que coincidan los nombres de los conceptos.">
      <textarea className={`${campo} min-h-24 py-2`} value={value.evidencia} maxLength={2000} onChange={e => onChange({ ...value, evidencia: e.target.value })} placeholder="Referencia y resultado de la revisión del pago" />
    </CampoConAyuda>
    <p className="text-xs">La revisión del servidor comprobará los importes registrados. Si este dinero ya está en el monedero, úsalo desde el flujo de cobro con monedero.</p>
  </section>;
}
