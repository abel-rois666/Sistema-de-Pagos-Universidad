import { useEffect, useState } from 'react';
import AyudaContextual from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import toast from 'react-hot-toast';
import type { Campo911, Instancia911, Valor911 } from '../../estadistica911/types';
import { BASE911 } from '../../estadistica911/fuentes';
import { validarCampo911 } from '../../estadistica911/calculo';
import ModalConfirmacion from '../ui/ModalConfirmacion';
export default function Bloques911Panel({
  instancia,
  editable,
  onChange
}: {
  instancia: Instancia911;
  editable: boolean;
  onChange: (i: Instancia911) => void;
}) {
  const [defs, setDefs] = useState<Record<string, Campo911[]>>({}),
    [bloque, setBloque] = useState(''),
    [fila, setFila] = useState<Record<string, Valor911>>({}),
    [editar, setEditar] = useState<number | null>(null),
    [quitar, setQuitar] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void fetch(BASE911 + 'bloques.json').then(r => {
      if (!r.ok) throw Error('No se pudo consultar el catálogo de bloques');
      return r.json();
    }).then(x => {
      if (alive) setDefs(x);
    }).catch(e => toast.error(e.message));
    return () => {
      alive = false;
    };
  }, []);
  const keys = Object.keys(defs).filter(k => instancia.cuestionario === 'infraestructura' ? k === 'edificios' : instancia.cuestionario === 'institucion' || ['carrera', 'posgrado'].includes(instancia.cuestionario) ? k !== 'edificios' : false);
  const actual = keys.includes(bloque) ? bloque : keys[0] || '';
  const nombres:Record<string,string>={edificios:'Edificios del plantel','movilidad-entidad-enviados':'Alumnos enviados a otra entidad','movilidad-entidad-recibidos':'Alumnos recibidos de otra entidad','movilidad-pais-enviados':'Alumnos enviados a otro país','movilidad-pais-recibidos':'Alumnos recibidos de otro país'};
  if (!actual) return null;
  const campos = defs[actual] || [],
    filas = instancia.bloques[actual] || [];
  function guardar() {
    for (const c of campos) {
      const e = validarCampo911(fila[c.codigo] ?? null, c.tipo);
      if (e) return toast.error(`${c.codigo}: ${e}`);
    }
    if (!Object.values(fila).some(v => v !== null && v !== '')) return toast.error('Captura al menos un dato del registro');
    const nuevas = [...filas];
    if (editar === null) nuevas.push(fila);else nuevas[editar] = fila;
    onChange({
      ...instancia,
      bloques: {
        ...instancia.bloques,
        [actual]: nuevas
      }
    });
    setFila({});
    setEditar(null);
  }
  return <section className="s911-card"><h2>Registros adicionales <AyudaContextual etiqueta="Registros adicionales" texto={ayuda.bloque}/></h2><p>Añade una fila por edificio o registro de movilidad. Se incluirán en hojas adicionales del PDF. Al terminar cada fila, pulsa «Añadir registro» y luego «Guardar expediente» para conservar el trabajo.</p><label>Tipo de registro<select disabled={Object.keys(fila).length > 0} value={actual} onChange={e => {
        setBloque(e.target.value);
        setEditar(null);
      }}>{keys.map(k => <option key={k} value={k}>{nombres[k]||k}</option>)}</select></label><div className="s911-grid">{campos.map(c => <label key={c.codigo}>{c.codigo} · {c.descripcion}<input disabled={!editable} type={/INT|DECIMAL|NUMERIC/.test(c.tipo) ? 'number' : 'text'} min={0} value={String(fila[c.codigo] ?? '')} onChange={e => setFila(x => ({
          ...x,
          [c.codigo]: e.target.value === '' ? null : /INT|DECIMAL|NUMERIC/.test(c.tipo) ? Number(e.target.value) : e.target.value
        }))} /></label>)}</div><div className="s911-toolbar"><button disabled={!editable} onClick={guardar}>{editar === null ? 'Añadir registro' : 'Guardar registro'}</button><button onClick={() => {
        setFila({});
        setEditar(null);
      }}>Cancelar captura</button></div><div className="s911-scroll"><table><thead><tr><th>Registro</th><th>Datos capturados</th><th>Acciones</th></tr></thead><tbody>{filas.map((r, n) => <tr key={n}><td>{n + 1}</td><td>{Object.entries(r).map(([k, v]) => `${k}: ${v ?? 'Pendiente'}`).join(' · ')}</td><td><button disabled={!editable} onClick={() => {
                setFila({
                  ...r
                });
                setEditar(n);
              }}>Editar</button><button disabled={!editable} onClick={() => setQuitar(n)}>Retirar</button></td></tr>)}</tbody></table></div><ModalConfirmacion isOpen={quitar !== null} title="Retirar registro del borrador" message="Este registro dejará de aparecer en las próximas continuaciones. Las versiones cerradas se conservan." onCancel={() => setQuitar(null)} onConfirm={() => {
      onChange({
        ...instancia,
        bloques: {
          ...instancia.bloques,
          [actual]: filas.filter((_, n) => n !== quitar)
        }
      });
      setQuitar(null);
    }} /></section>;
}
