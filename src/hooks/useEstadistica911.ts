import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Expediente911, Respaldo911 } from '../estadistica911/types';
import { cargarFuentes911, crearExpediente911 } from '../estadistica911/fuentes';
import { calcular911, diagnosticoCierre911 } from '../estadistica911/calculo';
import { aplicarReglas911, pendientesReglas911, excepcionAcreditada911 } from '../estadistica911/reglas';
import { consolidar911 } from '../estadistica911/consolidacion';
import { estadistica911Service as service } from '../services/estadistica911Service';
import { useAppStore } from '../store/useAppStore';
import { cortePendiente911, invalidarCorte911 } from '../estadistica911/corte';
import { aplicarPertinencia911,instanciaAplica911 } from '../estadistica911/guia';
export function useEstadistica911() {
  const rol = useAppStore(s => s.currentUser?.rol);
  const alumnosAutorizados = rol === 'ADMINISTRADOR' || rol === 'COORDINADOR CONTROL ESCOLAR';
  const cargaRespaldo = useRef(0);
  const [fuentes, setFuentes] = useState<Awaited<ReturnType<typeof cargarFuentes911>> | null>(null),
    [lista, setLista] = useState<Expediente911[]>([]),
    [exp, setExp] = useState<Expediente911 | null>(null),
    [respaldos, setRespaldos] = useState<Respaldo911[]>([]),
    [academicas, setAcademicas] = useState<Awaited<ReturnType<typeof service.fuentesAcademicas>> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const actuales = useRef<Awaited<ReturnType<typeof cargarFuentes911>> | null>(null);
  const [respaldoListo, setRespaldoListo] = useState(false);
  const [confirmacion, setConfirmacion] = useState<{
      titulo: string;
      mensaje: string;
      accion: () => void;
    } | null>(null),
    [propuesta, setPropuesta] = useState<{
      exp: Expediente911;
      respaldos: Respaldo911[];
      cambios: string[];
    } | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.allSettled([cargarFuentes911(), service.listar()]).then(([f, l]) => {
      if (!alive) return;
      if (f.status === 'fulfilled') {
        actuales.current = f.value;
        setFuentes(f.value);
      } else setError(String(f.reason?.message));
      if (l.status === 'fulfilled') setLista(l.value);else setError(l.reason?.message || 'No se pudo consultar el expediente');
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);
  const modificar = useCallback((fn: (e: Expediente911) => Expediente911) => {
    setExp(e => {
      if (!e) return null;
      const siguiente = fn(e);
      return siguiente.config.corte !== e.config.corte ? invalidarCorte911(siguiente) : siguiente;
    });
    setDirty(true);
  }, []);
  useEffect(() => {
    if (exp && cortePendiente911(exp)) setRespaldos([]);
  }, [exp?.config.corte, exp?.corteCalculado]);
  const proteger = (titulo: string, accion: () => void) => {
    if (dirty) setConfirmacion({
      titulo,
      mensaje: 'Hay cambios sin guardar. Se descartarán al continuar.',
      accion
    });else accion();
  };
  const abrir = (e: Expediente911) => proteger('Cambiar expediente', () => {
    const n = ++cargaRespaldo.current;
    setExp(e);
    setDirty(false);
    setRespaldos([]);
    setRespaldoListo(false);
    setAcademicas(null);
    setBusy(true);
    void Promise.all([service.catalogo(e.catalogoHash), alumnosAutorizados ? service.respaldos(e.id, e.version) : Promise.resolve([] as Respaldo911[])]).then(([catalogo, r]) => {
      if (cargaRespaldo.current === n) {
        setFuentes(prev => prev ? {
          ...prev,
          fuentes: catalogo.fuentes,
          reglas: catalogo.reglas
        } : prev);
        setRespaldos(r);
        setRespaldoListo(true);
      }
    }).catch(err => {
      if (cargaRespaldo.current === n) toast.error(err.message);
    }).finally(() => {
      if (cargaRespaldo.current === n) setBusy(false);
    });
  });
  const nuevo = () => proteger('Nuevo expediente', () => {
    const n = ++cargaRespaldo.current;
    const f = actuales.current;
    if (f) {
      setBusy(true);
      setFuentes(f);
      void crearExpediente911(f.fuentes).then(e => {
        if (cargaRespaldo.current !== n) return;
        setExp(e);
        setRespaldos([]);
        setRespaldoListo(true);
        setDirty(true);
      }).catch(e => toast.error(e.message)).finally(() => {
        if (cargaRespaldo.current === n) setBusy(false);
      });
    }
  });
  async function guardar() {
    if (!exp) return;
    if (exp.id && !respaldoListo) return toast.error('No se pudo cargar el respaldo. Recarga el expediente antes de guardar');
    setBusy(true);
    try {
      const e = await service.guardar(exp, cortePendiente911(exp) ? [] : respaldos);
      setExp(e);
      setDirty(false);
      setLista(ls => [e, ...ls.filter(x => x.id !== e.id)]);
      toast.success('Expediente guardado');
      return e;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cargarAcademicas() {
    setBusy(true);
    try {
      setAcademicas(await service.fuentesAcademicas());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function recalcular() {
    if (!exp || !fuentes) return;
    setBusy(true);
    try {
      const a = await service.fuentesAcademicas(exp.config.corte);
      setAcademicas(a);
      const calc = calcular911(exp, a.personas, fuentes.fuentes);
      const personal = await service.personalAgregado(exp.config.corte, Boolean(exp.config.coberturas?.personal?.trim()));
      for (const i of calc.instancias.filter(i => i.cuestionario === 'escuela')) for (const [k, v] of Object.entries(personal.respuestas)) i.respuestas[k] = {
        ...i.respuestas[k],
        calculado: v,
        revisada: i.respuestas[k]?.calculado === v ? i.respuestas[k]?.revisada : false,
        origen: 'Personal confirmado: función principal, identidad única y vigencia al corte'
      };
      calc.incidencias.push(...personal.incidencias);
      const iniciales = calc.instancias.map(i => instanciaAplica911(i)?aplicarReglas911(i, fuentes.reglas).instancia:i);
      const consolidados = consolidar911(iniciales, calc.respaldos);
      const pertinentes=aplicarPertinencia911(exp,consolidados.instancias);
      const resultados = pertinentes.map(i => instanciaAplica911(i)?aplicarReglas911(i, fuentes.reglas):{instancia:i,incidencias:[]});
      const instancias = resultados.map(r => r.instancia);
      const incidencias = [...new Set([...calc.incidencias, ...resultados.flatMap(r => r.incidencias)])];
      const cambios = instancias.flatMap(i => Object.entries(i.respuestas).filter(([k, r]) => JSON.stringify(r.calculado) !== JSON.stringify(exp.instancias.find(x => x.id === i.id)?.respuestas[k]?.calculado)).map(([k, r]) => `${i.id}/${k}: ${exp.instancias.find(x => x.id === i.id)?.respuestas[k]?.calculado ?? 'Pendiente'} → ${r.calculado ?? 'Pendiente'}`));
      setPropuesta({
        exp: {
          ...exp,
          corteCalculado: exp.config.corte,
          instancias,
          incidencias,
          revisiones: {}
        },
        respaldos: consolidados.respaldos.filter(r=>exp.instancias.some(i=>i.id===r.instancia&&instanciaAplica911(i))),
        cambios
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const aplicarPropuesta = () => {
    if (!propuesta) return;
    setExp(propuesta.exp);
    setRespaldos(propuesta.respaldos);
    setDirty(true);
    setPropuesta(null);
  };
  async function transicion(accion: string, motivo: string) {
    if (!exp || !fuentes) return;
    if (dirty) return toast.error('Guarda los cambios antes de cambiar el estado');
    if (accion === 'CERRAR') {
      const errores = [...diagnosticoCierre911(exp, fuentes.fuentes), ...pendientesReglas911(exp, fuentes.reglas).filter(r => !excepcionAcreditada911(exp.excepciones?.[r.clave])).map(r => r.mensaje)];
      if (errores.length) return toast.error(`Faltan ${errores.length} comprobaciones. Revisa la pestaña Validación.`);
    }
    setBusy(true);
    try {
      const e = await service.transicion(exp, accion, motivo);
      setExp(e);
      setLista(ls => ls.map(x => x.id === e.id ? e : x));
      toast.success('Estado actualizado');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return {
    fuentes,
    lista,
    exp,
    respaldos,
    academicas,
    busy,
    error,
    dirty,
    respaldoListo,
    confirmacion,
    setConfirmacion,
    propuesta,
    setPropuesta,
    modificar,
    abrir,
    nuevo,
    guardar,
    cargarAcademicas,
    recalcular,
    aplicarPropuesta,
    transicion
  };
}
