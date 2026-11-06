import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { puedeAccederRuta } from './capacidades';

export default function AccesoRuta({ children }: { children: ReactNode }) {
  const rol = useAppStore(s => s.currentUser?.rol);
  const { pathname } = useLocation();
  if (puedeAccederRuta(rol, pathname)) return children;
  return <section role="alert" className="mx-auto max-w-2xl space-y-3 p-6 text-gray-900 dark:text-gray-100">
    <h1 className="text-xl font-semibold">Tu perfil no tiene acceso a esta sección</h1>
    <p className="text-sm text-gray-600 dark:text-gray-300">Puedes volver al inicio para elegir una tarea disponible. Si necesitas otro acceso, consulta a Administración.</p>
    <Link to="/dashboard" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Volver al inicio</Link>
  </section>;
}
