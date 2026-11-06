import { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { useState } from 'react';
import type { Campo911, Respuesta911 } from '../../estadistica911/types';
import { valorRespuesta } from '../../estadistica911/types';
import { validarCampo911 } from '../../estadistica911/calculo';
import { estadistica911Service } from '../../services/estadistica911Service';
import toast from 'react-hot-toast';
import Modal911 from './Modal911';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { instruccionCampo911, type GuiaCampo911 } from '../../estadistica911/guia';
export default function Respuesta911Editor({
  campo,
  respuesta,
  derivada,
  guia,
  respuestasGrupo,
  onClose,
  onGuardar
}: {
  campo: Campo911;
  respuesta?: Respuesta911;
  derivada: boolean;
  guia?: GuiaCampo911;
  respuestasGrupo?:Record<string,Respuesta911>;
  onClose: () => void;
  onGuardar: (r: Respuesta911,seleccionGrupo?:string) => void;
}) {
  const [valor, setValor] = useState(String(valorRespuesta(respuesta) ?? '')),
    [justificacion, setJustificacion] = useState(respuesta?.justificacion || ''),
    [evidencia, setEvidencia] = useState(respuesta?.evidencia || ''),
    [busy, setBusy] = useState(false);
  const tipoNumerico = /INT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL/.test(campo.tipo);
  const [retirar,setRetirar]=useState<''|'RETIRAR'|'CALCULO'>('');
  const [seleccionGrupo,setSeleccionGrupo]=useState(guia?.opcion?.grupo?.find(g=>valorRespuesta(respuestasGrupo?.[g.codigo])===1)?.codigo||'');
  const [declarar,setDeclarar]=useState(respuesta?.declarado!==undefined || respuesta?.calculado==null);
  const guardar = () => {
    if(!declarar || derivada) {
      if(respuesta?.calculado==null)return toast.error('La cifra calculada sigue pendiente. Revisa las fuentes o registra una declaración documentada.');
      if(!declarar&&respuesta.declarado!==undefined){setRetirar('CALCULO');return;}
      onGuardar({...respuesta,revisada:true});return;
    }
    if(guia?.opcion?.grupo&&!seleccionGrupo)return toast.error('Selecciona una opción del grupo.');
    const v = guia?.opcion?.grupo ? (seleccionGrupo===campo.codigo?1:0) : valor === '' ? null : tipoNumerico ? Number(valor) : valor;
    const error = validarCampo911(v, campo.tipo);
    if (error) return toast.error(error);
    if (!derivada && (!justificacion.trim() || !evidencia.trim())) return toast.error('Registra justificación y evidencia documental');
    onGuardar(derivada ? {
      ...respuesta!,
      revisada: true
    } : {
      ...respuesta,
      calculado: respuesta?.calculado ?? null,
      origen: respuesta?.origen || 'Captura complementaria',
      declarado: v,
      justificacion,
      evidencia,
      revisada: true
    },seleccionGrupo||undefined);
  };
  return <Modal911 titulo={`${campo.codigo} · ${campo.descripcion}`} onClose={onClose}><div className="s911-body s911-stack"><p className="s911-note">Cifra calculada: {respuesta?.calculado ?? 'Pendiente de información'} · Procedencia: {respuesta?.origen || 'Captura del responsable'}</p><details><summary>Referencia técnica del campo oficial</summary><p>Formato: {campo.tipo} · Etapa oficial: {campo.fase}</p></details>
 <p className="s911-notice">{instruccionCampo911(campo,guia)}</p>
 {!derivada&&respuesta?.calculado!=null&&<label className="s911-check"><input type="checkbox" checked={declarar} onChange={e=>setDeclarar(e.target.checked)}/>Declarar una respuesta distinta del cálculo</label>}
 {declarar&&!derivada&&<CampoConAyuda etiqueta="Respuesta declarada" ayuda={ayuda.declarado}>{guia?.opcion?.grupo?<select value={seleccionGrupo} onChange={e=>setSeleccionGrupo(e.target.value)}><option value="">Selecciona una opción</option>{guia.opcion.grupo.map(g=><option key={g.codigo} value={g.codigo}>{g.etiqueta}</option>)}</select>:guia?.opcion?<select value={valor} onChange={e=>setValor(e.target.value)}><option value="">Pendiente</option><option value="1">Marcar «{guia.opcion.etiqueta}»</option><option value="0">No marcar «{guia.opcion.etiqueta}»</option></select>:<input type={tipoNumerico ? 'number' : 'text'} min={0} value={valor} onChange={e => setValor(e.target.value)} />}</CampoConAyuda>}
 {guia?.opcion&&declarar&&<p>Las opciones de esta pregunta se guardan juntas para evitar respuestas contradictorias.</p>}
 {derivada ? <p>Este total se deriva de sus componentes. Corrige o justifica las cifras componentes y vuelve a calcular.</p> : declarar&&<><CampoConAyuda etiqueta="Por qué se registra esta respuesta" ayuda={ayuda.declarado}><textarea value={justificacion} onChange={e => setJustificacion(e.target.value)} /></CampoConAyuda><CampoConAyuda etiqueta="Documento que respalda la respuesta" ayuda={ayuda.evidencia}><textarea value={evidencia} onChange={e => setEvidencia(e.target.value)} /></CampoConAyuda><label>Adjuntar evidencia privada<input type="file" disabled={busy} onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              setEvidencia(await estadistica911Service.adjuntar(f));
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }} /></label></>}
 <p className="s911-note">Una cifra declarada conserva el cálculo original. Su diferencia se muestra como ajuste agregado; no crea alumnos en el respaldo.</p>
 <footer><button onClick={onClose}>Cancelar</button>{respuesta?.declarado !== undefined && <button onClick={() => setRetirar('RETIRAR')}>Retirar ajuste</button>}<button className="s911-primary" disabled={busy || derivada && respuesta?.calculado == null} onClick={guardar}>{derivada || !declarar ? 'Confirmar cifra calculada' : 'Guardar respuesta'}</button></footer>
 <ModalConfirmacion isOpen={Boolean(retirar)} title={retirar==='CALCULO'?'Usar la cifra calculada':'Retirar ajuste declarado'} message={`Se retirarán la respuesta declarada, su justificación y su evidencia del borrador. ${retirar==='CALCULO'?'Se confirmará el cálculo original como respuesta revisada.':'Se conserva el cálculo original; tendrás que revisarlo nuevamente.'} Las versiones cerradas no cambian.`} onCancel={()=>setRetirar('')} onConfirm={()=>respuesta&&onGuardar({
          calculado: respuesta.calculado,
          origen: respuesta.origen,
          poblacion: respuesta.poblacion,
          revisada: retirar==='CALCULO'
        })}/></div></Modal911>;
}
