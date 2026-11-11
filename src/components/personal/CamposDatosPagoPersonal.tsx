import { useId, useState, type ClipboardEvent } from 'react';
import { CAMPOS_PAGO_PERSONAL, ocultarDatoPago, type CampoPagoPersonal, type DatosPagoPersonal } from '../../personal/datosPago';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import Campo from './CampoPersonal';

interface Props {
  key?: string;
  datos: DatosPagoPersonal; onCambiar: (datos: DatosPagoPersonal) => void; lectura: boolean; disabled?: boolean;
  errores?: Partial<Record<CampoPagoPersonal, string>>;
}
const bancarios = CAMPOS_PAGO_PERSONAL.filter(c => c.campo !== 'nss');
export default function CamposDatosPagoPersonal({ datos, onCambiar, lectura, disabled = false, errores = {} }: Props) {
  const id = useId(), [mostrar, setMostrar] = useState(false);
  const [seleccion, setSeleccion] = useState<CampoPagoPersonal[]>(() => bancarios.filter(c => Boolean(datos[c.campo])).map(c => c.campo));
  const [quitar, setQuitar] = useState<CampoPagoPersonal | null>(null), [entrada, setEntrada] = useState<Partial<Record<CampoPagoPersonal, string>>>({});
  const comprobarEntrada = (campo: CampoPagoPersonal, valor: string) => {
    const regla = CAMPOS_PAGO_PERSONAL.find(c => c.campo === campo)!;
    if (!/^[0-9]*$/.test(valor)) return 'Admite únicamente dígitos del 0 al 9, sin espacios ni separadores.';
    if (valor.length > regla.maximo) return `Admite como máximo ${regla.maximo} dígitos. La captura anterior se conserva.`;
    return '';
  };
  const cambiar = (campo: CampoPagoPersonal, valor: string) => {
    const error = comprobarEntrada(campo, valor);
    setEntrada(prev => ({ ...prev, [campo]: error }));
    if (!error) onCambiar({ ...datos, [campo]: valor || null });
  };
  const pegar = (campo: CampoPagoPersonal, e: ClipboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget, valor = input.value.slice(0, input.selectionStart ?? input.value.length)
      + e.clipboardData.getData('text') + input.value.slice(input.selectionEnd ?? input.value.length);
    const error = comprobarEntrada(campo, valor);
    if (error) { e.preventDefault(); setEntrada(prev => ({ ...prev, [campo]: error })); }
  };
  const campo = (clave: CampoPagoPersonal) => {
    const regla = CAMPOS_PAGO_PERSONAL.find(c => c.campo === clave)!, error = entrada[clave] || errores[clave];
    return <div key={clave} className="min-w-0">
      <Campo etiqueta={`${regla.etiqueta} (opcional)`} valor={lectura && !mostrar ? ocultarDatoPago(datos[clave]) : datos[clave]}
        onCambiar={v => cambiar(clave, v)} lectura={lectura} disabled={disabled} inputMode="numeric" autoComplete="off"
        maxLength={regla.maximo} pattern={regla.exacto ? '[0-9]{11}' : `[0-9]{1,${regla.maximo}}`} onPaste={e => pegar(clave, e)}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-${clave}`} ayuda={regla.exacto ? 'Exactamente 11 dígitos, incluidos los ceros iniciales. Puedes dejarlo vacío.' : `Hasta ${regla.maximo} dígitos. Puedes dejarlo vacío. Se valida la estructura, no la titularidad bancaria.`}/>
      <p id={`${id}-${clave}`} className={error ? 'personal-error text-xs mt-1' : 'personal-nota text-xs mt-1'} role={error ? 'alert' : undefined}>{error || (!lectura ? `${(datos[clave] || '').length}/${regla.maximo} dígitos` : '')}</p>
    </div>;
  };
  const alternar = (clave: CampoPagoPersonal, marcado: boolean) => {
    if (marcado) setSeleccion(prev => [...new Set([...prev, clave])]);
    else if (datos[clave]) setQuitar(clave);
    else setSeleccion(prev => prev.filter(c => c !== clave));
  };
  return <>
    {lectura && Object.values(datos).some(Boolean) && <div className="personal-acciones"><button type="button" className="personal-boton" onClick={() => setMostrar(v => !v)}>{mostrar ? 'Ocultar datos' : 'Mostrar datos'}</button></div>}
    <div className="personal-grid">{campo('nss')}</div>
    {!lectura && <fieldset disabled={disabled} className="mt-4 mb-4"><legend className="text-sm font-semibold mb-2">Datos bancarios que deseas registrar (opcionales)</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{bancarios.map(c => <label key={c.campo} className="inline-flex items-center gap-2 min-h-10 text-sm"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={seleccion.includes(c.campo)} onChange={e => alternar(c.campo, e.target.checked)}/>{c.etiqueta}</label>)}</div><p className="personal-nota">Puedes registrar uno, varios o los tres datos.</p></fieldset>}
    <div className="personal-grid">{bancarios.filter(c => lectura ? Boolean(datos[c.campo]) : seleccion.includes(c.campo)).map(c => campo(c.campo))}</div>
    {lectura && !bancarios.some(c => datos[c.campo]) && <p className="personal-nota">No hay datos bancarios registrados.</p>}
    <ModalConfirmacion isOpen={Boolean(quitar)} title="Quitar dato bancario" type="warning" message={`Se quitará ${CAMPOS_PAGO_PERSONAL.find(c => c.campo === quitar)?.etiqueta || 'este dato'} cuando guardes esta sección. Puedes cancelar la edición para recuperar el valor anterior.`} confirmText="Quitar de la captura" cancelText="Conservar dato" onCancel={() => setQuitar(null)} onConfirm={() => { if (quitar) { onCambiar({ ...datos, [quitar]: null }); setSeleccion(prev => prev.filter(c => c !== quitar)); } setQuitar(null); }}/>
  </>;
}
