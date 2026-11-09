import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Search } from 'lucide-react';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { cuentaVinculable, nombreAdministrativo, ROLES_CUENTA_ADMINISTRATIVA, validarCuentaAdministrativa, type CuentaAdministrativo, type RevisionAdministrativo } from '../../personal/gestionAdministrativos';
import { gestionAdministrativosService as servicio } from '../../services/gestionAdministrativosService';

interface Props { id: string; modo: 'cuenta' | 'eliminar'; onClose: () => void; onSaved: () => Promise<void>; onFicha: () => void }
const campo = 'w-full min-h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1c2228] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800';
const boton = 'min-h-10 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed';

export default function GestionAdministrativo({ id, modo, onClose, onSaved, onFicha }: Props) {
  const [revision, setRevision] = useState<RevisionAdministrativo | null>(null), [cargando, setCargando] = useState(true), [error, setError] = useState(''), [intento, setIntento] = useState(0);
  const [tipo, setTipo] = useState<'crear' | 'vincular'>('crear'), [usuario, setUsuario] = useState(''), [password, setPassword] = useState(''), [email, setEmail] = useState(''), [rol, setRol] = useState('');
  const [motivo, setMotivo] = useState(''), [revisado, setRevisado] = useState(false), [busqueda, setBusqueda] = useState(''), [resultados, setResultados] = useState<CuentaAdministrativo[]>([]), [elegida, setElegida] = useState<CuentaAdministrativo | null>(null);
  const [busquedaEjecutada, setBusquedaEjecutada] = useState(false);
  const [guardando, setGuardando] = useState(false), [buscando, setBuscando] = useState(false), [visible, setVisible] = useState(false), [descartar, setDescartar] = useState(false), [irFicha, setIrFicha] = useState(false);
  useEffect(() => {
    let vigente = true; setCargando(true); setError('');
    void servicio.revisar(id).then(r => { if (vigente) setRevision(r); }).catch(e => { if (vigente) setError(e.message); }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id, intento]);
  const sucia = Boolean(usuario || password || email || rol || motivo || busqueda || elegida || revisado);
  const cerrar = () => { if (!guardando && !buscando) { if (sucia) setDescartar(true); else onClose(); } };
  const propias = revision?.cuentas || [];
  const seleccionada = propias.length === 1 ? propias[0] : elegida;
  const vinculada = propias.length === 1 && propias[0].empleado_id === id && (!revision?.docente_id || propias[0].docente_id === revision.docente_id);
  const puedeVincular = Boolean(revision && seleccionada && cuentaVinculable(seleccionada, revision) && !vinculada);
  const esCrear = propias.length === 0 && tipo === 'crear';
  const puedeActuar = Boolean(revision) && (modo === 'eliminar' ? Boolean(revision?.puede_eliminar) : esCrear || puedeVincular);
  const valido = revisado && motivo.trim().length >= 10 && (modo === 'eliminar' || !esCrear || !validarCuentaAdministrativa({ username: usuario, password, rol, email, motivo }).length);
  async function buscar() {
    setBuscando(true); setError(''); setElegida(null); setResultados([]); setBusquedaEjecutada(false);
    try { setResultados(await servicio.buscar(busqueda)); setBusquedaEjecutada(true); } catch (e) { setError((e as Error).message); } finally { setBuscando(false); }
  }
  async function confirmar() {
    if (!revision || !puedeActuar || !valido) return;
    setGuardando(true); setError('');
    try {
      if (modo === 'eliminar') await servicio.eliminar(revision, motivo);
      else if (esCrear) await servicio.crear(revision, { username: usuario, password, email, rol, motivo });
      else if (seleccionada) await servicio.vincular(revision, seleccionada, motivo);
      toast.success(modo === 'eliminar' ? 'Registro administrativo eliminado; la identidad compartida se conserva.' : esCrear ? 'Cuenta creada y vinculada al administrativo.' : 'Cuenta vinculada; su rol y estado de acceso se conservan.');
      onClose(); await onSaved();
    } finally { setGuardando(false); }
  }
  const contenido = <div className="space-y-4 text-left">
    {cargando ? <p role="status">Revisando cuentas e historial…</p> : <>
      {revision && <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3"><strong className="text-gray-900 dark:text-gray-100">{nombreAdministrativo(revision.empleado)}</strong><p className="text-xs mt-1">{revision.empleado.puesto || 'Cargo sin registrar'} · {revision.empleado.departamento || 'Área sin registrar'}</p><p className="text-xs mt-1">Situación administrativa: {revision.empleado.estatus || 'Sin registrar'}. La cuenta conserva su propio estado de acceso.</p>{revision.docente_id && <p className="text-xs mt-1">También tiene función docente. Se conserva su identidad compartida.</p>}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-red-800 dark:text-red-200"><p>{error}</p>{!revision && <button type="button" className={`${boton} mt-2`} onClick={() => setIntento(i => i + 1)}>Reintentar revisión</button>}</div>}
      {revision && (modo === 'eliminar' ? <>
        <p>Se elimina únicamente el registro administrativo. No se borrarán la identidad compartida ni su registro docente.</p>
        {revision.puede_eliminar ? <p className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-900 dark:text-amber-100">No se encontraron dependencias. La eliminación es permanente; si solo terminó su relación laboral, registra su baja desde la ficha.</p>
          : <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-900 dark:text-amber-100"><strong>Se conserva por su historial o dependencias</strong><ul className="list-disc pl-5 mt-2 space-y-1">{revision.dependencias.map((d, i) => <li key={i}>{d.tabla}{d.cantidad !== null ? `: ${d.cantidad}` : ''}{d.motivo ? ` · ${d.motivo}` : ''}</li>)}</ul><p className="mt-2">No se ejecutará ningún borrado en cascada. Para terminar su relación laboral, cambia su situación administrativa en la ficha.</p></div>}
        <button type="button" className={boton} onClick={() => { if (sucia) { setIrFicha(true); setDescartar(true); } else onFicha(); }}>Abrir ficha del administrativo</button>
      </> : <>
        {propias.length > 0 ? <div className="space-y-3"><p>Esta persona ya tiene {propias.length === 1 ? 'una cuenta' : 'varias cuentas para revisar'}. No se creará otra.</p>{propias.map(c => <div key={c.id} className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3"><strong>{c.username}</strong><p className="mt-1 text-xs break-words">Rol: {c.rol} · {c.activo === true && c.auth_id ? 'Cuenta activa' : c.activo === false ? 'Cuenta desactivada' : 'Cuenta por verificar'}</p><p className="mt-1 text-xs">{c.empleado_id === id ? 'Vinculada a este administrativo.' : 'Identificada por su función docente compartida.'}</p></div>)}<p className="text-xs">Los cambios de contraseña, rol, activación o desactivación se administran desde Configuración → Usuarios. Vincular no concede permisos adicionales.</p></div>
          : <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de cuenta"><button type="button" className={`${boton} ${tipo === 'crear' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : ''}`} disabled={guardando} aria-pressed={tipo === 'crear'} onClick={() => { setTipo('crear'); setRevisado(false); }}>Crear cuenta nueva</button><button type="button" className={`${boton} ${tipo === 'vincular' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : ''}`} disabled={guardando} aria-pressed={tipo === 'vincular'} onClick={() => { setTipo('vincular'); setRevisado(false); }}>Vincular cuenta existente</button></div>
            {tipo === 'crear' ? <fieldset disabled={guardando} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm font-semibold">Usuario de inicio de sesión<input className={`${campo} mt-1`} value={usuario} maxLength={50} autoComplete="off" onChange={e => setUsuario(e.target.value.toLowerCase())}/></label>
              <label className="text-sm font-semibold">Rol de acceso<select className={`${campo} mt-1`} value={rol} onChange={e => setRol(e.target.value)}><option value="">Elige los permisos</option>{ROLES_CUENTA_ADMINISTRATIVA.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
              <label className="text-sm font-semibold">Correo de la cuenta (opcional)<input type="email" autoComplete="off" className={`${campo} mt-1`} value={email} maxLength={254} onChange={e => setEmail(e.target.value)}/></label>
              <div><label className="text-sm font-semibold" htmlFor="password-administrativo">Contraseña inicial</label><div className="flex items-center gap-2 mt-1"><input id="password-administrativo" type={visible ? 'text' : 'password'} autoComplete="new-password" className={campo} value={password} minLength={8} maxLength={128} onChange={e => setPassword(e.target.value)}/><button type="button" className="shrink-0 p-2" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
              <p className="sm:col-span-2 text-xs font-normal">Usuario de 3–50 caracteres: minúsculas, números, punto, guion o guion bajo. Contraseña de al menos 8 caracteres. Sin correo se utiliza una dirección técnica interna. El cargo laboral no asigna permisos.</p>
            </fieldset> : <div className="space-y-3"><label className="block text-sm font-semibold">Buscar usuario existente<div className="flex flex-wrap gap-2 mt-1"><input className={`${campo} sm:flex-1 sm:w-auto`} value={busqueda} maxLength={100} disabled={guardando || buscando} onChange={e => { setBusqueda(e.target.value); setElegida(null); setResultados([]); setBusquedaEjecutada(false); }}/><button type="button" className={`${boton} inline-flex items-center gap-2`} disabled={guardando || buscando || busqueda.trim().length < 3} onClick={() => void buscar()}><Search size={15}/>{buscando ? 'Buscando…' : 'Buscar'}</button></div></label>{busquedaEjecutada && !resultados.length && <p role="status" className="text-sm">No se encontraron cuentas con ese usuario.</p>}{resultados.map(c => <label key={c.id} className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-600 p-3"><input type="radio" name="cuenta-existente" checked={elegida?.id === c.id} disabled={guardando || !cuentaVinculable(c, revision)} onChange={() => { setElegida(c); setRevisado(false); }}/><span className="min-w-0 break-words"><strong>{c.username}</strong><span className="block text-xs">{c.rol} · {c.activo === false ? 'Desactivada' : 'Revisar identidad'}{!cuentaVinculable(c, revision) ? ' · No vinculable: pertenece a otra persona o falta Auth' : ''}</span></span></label>)}</div>}
          </>}
      </>)}
      {revision && puedeActuar && <fieldset disabled={guardando} className="space-y-3"><label className="block text-sm font-semibold">{modo === 'eliminar' ? 'Motivo de eliminación' : 'Respaldo de identidad y motivo'}<textarea className={`${campo} mt-1 min-h-20`} value={motivo} minLength={10} maxLength={500} onChange={e => setMotivo(e.target.value)} placeholder={modo === 'eliminar' ? 'Explica por qué este registro debe eliminarse' : 'Explica cómo verificaste que la cuenta corresponde a esta persona'}/></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={revisado} onChange={e => setRevisado(e.target.checked)}/><span>{modo === 'eliminar' ? 'Revisé la identidad y entiendo que el registro administrativo se eliminará permanentemente.' : esCrear ? 'Verifiqué la identidad y los permisos del rol que tendrá esta cuenta.' : 'Verifiqué que esta cuenta pertenece a la misma persona. Se conservarán su rol y estado de acceso.'}</span></label></fieldset>}
    </>}
  </div>;
  return <><ModalConfirmacion isOpen wide title={modo === 'eliminar' ? 'Eliminar administrativo' : 'Cuenta de acceso del administrativo'} message={contenido} type={modo === 'eliminar' ? 'danger' : 'info'} busy={guardando || buscando} onCancel={cerrar} cancelText="Cerrar" onConfirm={puedeActuar ? confirmar : undefined} confirmDisabled={cargando || !valido} confirmText={modo === 'eliminar' ? 'Eliminar registro administrativo' : esCrear ? 'Crear cuenta y vincular' : 'Vincular cuenta existente'}/>
    <ModalConfirmacion isOpen={descartar} title="Descartar datos de la cuenta o eliminación" message="La operación no se ha realizado. Se descartarán los datos capturados en este formulario." confirmText="Descartar y cerrar" onCancel={() => { setDescartar(false); setIrFicha(false); }} onConfirm={irFicha ? onFicha : onClose}/></>;
}
