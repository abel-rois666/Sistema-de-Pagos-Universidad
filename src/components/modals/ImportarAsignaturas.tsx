import { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Asignatura } from '../../types';
import { leerArchivoAsignaturas, plantillaAsignaturasCSV, prepararAsignaturas, type FilaAsignatura } from '../../utils/asignaturasImport';

interface Props {
  planId: string;
  planNombre: string;
  clavesExistentes: string[];
  onClose: () => void;
  onImported: (asignaturas: Asignatura[]) => void;
}

const claveNormalizada = (clave: string) => clave.trim().toLocaleUpperCase('es-MX');

export default function ImportarAsignaturas({ planId, planNombre, clavesExistentes, onClose, onImported }: Props) {
  const [filas, setFilas] = useState<FilaAsignatura[]>([]);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [clavesImportadas, setClavesImportadas] = useState<Set<string>>(new Set());
  const [clavesActualizadas, setClavesActualizadas] = useState<Set<string>>(new Set());
  const claves = new Set([...clavesExistentes.map(claveNormalizada), ...clavesActualizadas]);
  const validas = filas.filter(fila => fila.asignatura && !claves.has(claveNormalizada(fila.clave)));
  const repetidas = filas.filter(fila => fila.asignatura && claves.has(claveNormalizada(fila.clave)) && !clavesImportadas.has(claveNormalizada(fila.clave))).length;
  const invalidas = filas.filter(fila => fila.errores.length).length;

  const descargarPlantilla = () => {
    const url = URL.createObjectURL(new Blob([plantillaAsignaturasCSV], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'plantilla_asignaturas.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  };

  const seleccionarArchivo = async (archivo?: File) => {
    setFilas([]);
    setResultado('');
    setError('');
    setClavesImportadas(new Set());
    setClavesActualizadas(new Set());
    setArchivoNombre(archivo?.name || '');
    if (!archivo) return;
    setLeyendo(true);
    try {
      const leidas = await leerArchivoAsignaturas(archivo);
      if (leidas.length > 2001) throw new Error('El archivo supera 2,000 asignaturas. Divídelo en varios archivos.');
      setFilas(prepararAsignaturas(leidas));
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : 'No se pudo leer el archivo.');
    } finally {
      setLeyendo(false);
    }
  };

  const consultarClavesActuales = async (): Promise<Set<string>> => {
    const actuales = new Set<string>();
    let desde = 0;
    while (true) {
      const { data, error: consultaError } = await supabase.from('asignaturas')
        .select('clave_legado').eq('plan_id', planId).order('clave_legado').range(desde, desde + 999);
      if (consultaError) throw consultaError;
      data?.forEach(asignatura => actuales.add(claveNormalizada(asignatura.clave_legado)));
      if (!data || data.length < 1000) break;
      desde += 1000;
    }
    return actuales;
  };

  const importar = async () => {
    if (!validas.length || guardando) return;
    setGuardando(true);
    setError('');
    setResultado('');
    const insertadas: Asignatura[] = [];
    try {
      const actuales = await consultarClavesActuales();
      setClavesActualizadas(actuales);
      const nuevas = validas.filter(fila => !actuales.has(claveNormalizada(fila.clave)));
      for (let inicio = 0; inicio < nuevas.length; inicio += 100) {
        const bloque = nuevas.slice(inicio, inicio + 100).map(fila => ({ ...fila.asignatura!, plan_id: planId }));
        const { data, error: insercionError } = await supabase.from('asignaturas')
          .upsert(bloque, { onConflict: 'plan_id,clave_legado', ignoreDuplicates: true }).select('*');
        if (insercionError) throw insercionError;
        insertadas.push(...(data || []));
      }
      setResultado(`Se importaron ${insertadas.length} asignaturas. ${filas.length - insertadas.length} filas se omitieron por errores o claves existentes.`);
      setClavesImportadas(prev => new Set([...prev, ...insertadas.map(asignatura => claveNormalizada(asignatura.clave_legado))]));
      onImported(insertadas);
    } catch (causa) {
      setError(`La importación se detuvo. Se guardaron ${insertadas.length} asignaturas antes del error. ${causa instanceof Error ? causa.message : 'Revisa el archivo e intenta de nuevo.'}`);
      if (insertadas.length) {
        setClavesImportadas(prev => new Set([...prev, ...insertadas.map(asignatura => claveNormalizada(asignatura.clave_legado))]));
        onImported(insertadas);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="importar-asignaturas-titulo">
      <div className="flex max-h-[min(90vh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-[#1c2228]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700 sm:p-6">
          <div>
            <h2 id="importar-asignaturas-titulo" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white"><FileSpreadsheet className="text-blue-600 dark:text-blue-400" size={22} /> Importar asignaturas</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Las asignaturas se añadirán únicamente al plan <strong>{planNombre}</strong>.</p>
          </div>
          <button type="button" onClick={onClose} disabled={guardando} aria-label="Cerrar importación" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100 sm:grid-cols-[1fr_auto] sm:items-center">
            <p>Usa las columnas <strong>clave, nombre, creditos, clasificacion, periodo</strong>. Puedes añadir <strong>etapa_clave, etapa_nombre, clave_certificacion</strong>. Clasificación: Obligatoria, Optativa o Complementaria. El periodo es un número desde 1; los créditos pueden ser 0. Se importa la primera hoja del XLSX.</p>
            <button type="button" onClick={descargarPlantilla} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300 px-3 py-2 font-semibold hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"><Download size={16} /> Descargar plantilla CSV</button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-7 text-center hover:border-blue-500 dark:border-gray-600 dark:bg-[#181e25] dark:hover:border-blue-400">
            <UploadCloud size={26} className="text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">{archivoNombre || 'Selecciona un archivo CSV o XLSX'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Máximo 2,000 asignaturas por archivo. Las claves existentes se omiten sin sobrescribir.</span>
            <input type="file" accept=".csv,.xlsx" disabled={guardando || leyendo} className="sr-only" onChange={event => { void seleccionarArchivo(event.target.files?.[0]); event.target.value = ''; }} />
          </label>

          {leyendo && <p className="text-sm text-gray-600 dark:text-gray-300">Leyendo archivo…</p>}
          {error && <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"><AlertCircle size={18} className="shrink-0" />{error}</p>}
          {resultado && <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 size={18} className="shrink-0" />{resultado}</p>}

          {filas.length > 0 && (
            <section aria-label="Vista previa de asignaturas">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">Vista previa</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{validas.length} listas · {clavesImportadas.size} importadas · {repetidas} ya existentes · {invalidas} con errores</p>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-[840px] w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Clave</th><th className="px-3 py-2">Asignatura</th><th className="px-3 py-2">Créditos</th><th className="px-3 py-2">Clasificación</th><th className="px-3 py-2">Periodo / etapa</th><th className="px-3 py-2">Clave certificación</th><th className="px-3 py-2">Resultado</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filas.map(fila => <tr key={fila.numero} className="text-gray-800 dark:text-gray-200"><td className="px-3 py-2">{fila.numero}</td><td className="px-3 py-2 font-mono">{fila.clave || '—'}</td><td className="px-3 py-2">{fila.nombre || '—'}</td><td className="px-3 py-2">{fila.creditos || '—'}</td><td className="px-3 py-2">{fila.clasificacion || '—'}</td><td className="px-3 py-2">{fila.periodo || '—'}{fila.asignatura?.etapa_nombre && <span className="block text-xs text-gray-500 dark:text-gray-400">{fila.asignatura.etapa_nombre}</span>}</td><td className="px-3 py-2">{fila.claveCertificacion || '—'}</td><td className={`px-3 py-2 font-medium ${fila.errores.length ? 'text-red-600 dark:text-red-400' : clavesImportadas.has(claveNormalizada(fila.clave)) ? 'text-emerald-700 dark:text-emerald-400' : claves.has(claveNormalizada(fila.clave)) ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{fila.errores.join('; ') || (clavesImportadas.has(claveNormalizada(fila.clave)) ? 'Importada' : claves.has(claveNormalizada(fila.clave)) ? 'Ya existe en este plan' : 'Lista')}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-[#1c2228] sm:p-5">
          <button type="button" onClick={onClose} disabled={guardando} className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">{resultado ? 'Cerrar' : 'Cancelar'}</button>
          <button type="button" onClick={() => void importar()} disabled={!validas.length || guardando || leyendo || !!resultado} className="inline-flex items-center gap-2 rounded-xl bg-[#1456f0] px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><UploadCloud size={17} /> {guardando ? 'Importando…' : `Importar ${validas.length} asignaturas`}</button>
        </div>
      </div>
    </div>
  );
}
