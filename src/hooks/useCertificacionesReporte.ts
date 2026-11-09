import { useEffect, useState } from 'react';
import { cargarCertificacionesReporte } from '../services/reporteEgresadosService';
import type { ResumenCertificacion } from '../certificacion/seguimiento';

export function useCertificacionesReporte(ids: string[], habilitado: boolean, revision: number) {
  const [datos,setDatos] = useState<{ids:string[];revision:number;filas:ResumenCertificacion[]}|null>(null);
  const [loading,setLoading] = useState(false), [error,setError] = useState('');
  useEffect(()=>{
    const control=new AbortController();
    if(!habilitado){setError('');setLoading(false);return;}
    setLoading(true);setError('');
    void cargarCertificacionesReporte(ids,control.signal).then(r=>{if(!control.signal.aborted)setDatos({ids,revision,filas:r.certificaciones});})
      .catch(()=>{if(!control.signal.aborted)setError('No se pudo consultar el seguimiento de certificación. Reintenta antes de exportar estas columnas.');})
      .finally(()=>{if(!control.signal.aborted)setLoading(false);});
    return ()=>control.abort();
  },[ids,habilitado,revision]);
  const vigente=datos?.ids===ids&&datos.revision===revision;
  return {filas:vigente?datos.filas:[],loading:habilitado&&(loading||!vigente&&!error),error:habilitado?error:''};
}
