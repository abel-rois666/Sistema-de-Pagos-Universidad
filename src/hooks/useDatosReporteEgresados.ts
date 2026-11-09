import { useEffect, useState } from 'react';
import { cargarReporteEgresados } from '../services/reporteEgresadosService';
import { mensajeErrorReporteEgresados, type DatosReporteEgresados } from '../reportes/consultaEgresados';

export default function useDatosReporteEgresados(ids: string[], ciclos: { id: string; nombre: string }[], revision: number) {
  const [datos, setDatos] = useState<DatosReporteEgresados>({ ciclosEgresoMap: {}, tieneKardexMap: {}, certificacionMap: {}, certificaciones: [] });
  const [contexto, setContexto] = useState<{ ids: string[]; ciclos: typeof ciclos; revision: number } | null>(null);
  const [loading, setLoading] = useState(true), [errorConsulta, setErrorConsulta] = useState(''), [fetchProgress, setFetchProgress] = useState(0);
  useEffect(() => {
    const control = new AbortController();
    setContexto({ ids, ciclos, revision });
    setLoading(true); setErrorConsulta(''); setFetchProgress(0);
    void cargarReporteEgresados(ids, ciclos, control.signal, progreso => { if (!control.signal.aborted) setFetchProgress(progreso); })
      .then(resultado => { if (!control.signal.aborted) setDatos(resultado); })
      .catch(error => { if (!control.signal.aborted) setErrorConsulta(mensajeErrorReporteEgresados(error)); })
      .finally(() => { if (!control.signal.aborted) setLoading(false); });
    return () => control.abort();
  }, [ids, ciclos, revision]);
  const mismoContexto = contexto?.ids === ids && contexto.ciclos === ciclos && contexto.revision === revision;
  return { ...datos, loading: loading || !mismoContexto, errorConsulta: mismoContexto ? errorConsulta : '', fetchProgress: mismoContexto ? fetchProgress : 0 };
}
