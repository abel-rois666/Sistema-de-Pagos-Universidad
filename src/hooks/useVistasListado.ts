import { useEffect, useRef, useState } from 'react';
import { firmaVista, type ConfiguracionVistaListado, type VistaListado } from '../reportes/vistasListado';
import { vistasListadoService as service } from '../services/vistasListadoService';

export function useVistasListado(propietario: string, actual: ConfiguracionVistaListado,
  aplicar: (config: ConfiguracionVistaListado) => void) {
  const [datos, setDatos] = useState<{ propietario: string; vistas: VistaListado[] } | null>(null);
  const [seleccion, setSeleccion] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const contexto = useRef(0), ocupado = useRef(false), inicializado = useRef(false);
  const actualRef = useRef(actual), aplicarRef = useRef(aplicar); actualRef.current = actual; aplicarRef.current = aplicar;
  useEffect(() => {
    const control = new AbortController(), turno = ++contexto.current, inicio = firmaVista(actualRef.current);
    const aplicarInicial = !inicializado.current;
    setLoading(true); setError('');
    void service.consultar(control.signal).then(vistas => {
      if (control.signal.aborted || turno !== contexto.current) return;
      setDatos({ propietario, vistas });
      if (aplicarInicial) {
        const predeterminada = vistas.find(v => v.predeterminada);
        // Una respuesta tardía nunca sustituye los filtros que el usuario ya ajustó.
        if (predeterminada && inicio === firmaVista(actualRef.current)) {
          aplicarRef.current(predeterminada.configuracion); setSeleccion(predeterminada.id);
        }
      }
      inicializado.current = true;
    }).catch(e => { if (!control.signal.aborted && turno === contexto.current) { inicializado.current = true; setError(e.message || 'No se pudieron consultar las vistas.'); } })
      .finally(() => { if (!control.signal.aborted && turno === contexto.current) setLoading(false); });
    return () => { contexto.current++; control.abort(); };
  }, [propietario, revision]);
  const vistas = datos?.propietario === propietario ? datos.vistas : [];
  const elegida = vistas.find(v => v.id === seleccion);
  const conCambios = Boolean(elegida && firmaVista(elegida.configuracion) !== firmaVista(actual));
  const mutar = async (operacion: () => Promise<VistaListado[]>, idSeleccionado: string) => {
    if (ocupado.current || loading || error || datos?.propietario !== propietario) throw new Error('Actualiza las vistas antes de guardar cambios.');
    const turno = contexto.current; ocupado.current = true; setBusy(true);
    try {
      const resultado = await operacion();
      if (turno !== contexto.current) throw new Error('La consulta cambió; actualiza las vistas antes de continuar.');
      setDatos({ propietario, vistas: resultado }); setSeleccion(idSeleccionado);
    } finally { ocupado.current = false; if (turno === contexto.current) setBusy(false); }
  };
  return { vistas, elegida, seleccion: elegida?.id || '', conCambios, loading, busy, error,
    aplicar: (vista: VistaListado) => { aplicarRef.current(vista.configuracion); setSeleccion(vista.id); },
    restablecer: (config: ConfiguracionVistaListado) => { aplicarRef.current(config); setSeleccion(''); },
    recargar: () => { if (!ocupado.current) setRevision(n => n + 1); },
    guardar: (id: string, original: VistaListado | undefined, nombre: string, config: ConfiguracionVistaListado, predeterminada: boolean) =>
      mutar(() => service.guardar(id, original?.revision || 0, nombre, config, predeterminada), id),
    eliminar: (vista: VistaListado) => mutar(() => service.eliminar(vista), seleccion === vista.id ? '' : seleccion),
  };
}
