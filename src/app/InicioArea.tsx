import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { tareasAreas, type TareaArea } from './navegacion';

export default function InicioArea({ area }: { area?: TareaArea['area'] }) {
  const rol = useAppStore(s => s.currentUser?.rol);
  const tareas = tareasAreas.filter(t => (!area || t.area === area) && t.roles.includes(rol || ''));
  const titulo = area === 'escolar' ? 'Control Escolar' : area === 'academico' ? 'Control Académico' : 'Inicio';
  return <section className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header><h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{titulo}</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Elige la tarea que necesitas realizar. Cada módulo conserva su propio ciclo de consulta.</p></header>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tareas.map(t => <Link key={t.ruta} to={t.ruta} className="group rounded-xl border border-gray-200 bg-white p-5 text-gray-900 transition-colors hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:bg-[#1c2228] dark:text-white">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t.titulo}</h2><ArrowRight size={18} className="shrink-0 text-blue-600 dark:text-blue-400" /></div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t.descripcion}</p>
      </Link>)}
    </div>
    {!tareas.length && <p className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">No hay tareas configuradas para tu perfil en esta área. Consulta a Administración para revisar los accesos.</p>}
  </section>;
}
