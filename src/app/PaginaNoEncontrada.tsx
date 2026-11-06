import { Link } from 'react-router-dom';
export default function PaginaNoEncontrada() {
  return <section className="mx-auto max-w-xl p-6 text-gray-900 dark:text-gray-100"><h1 className="text-xl font-semibold">No encontramos esta página</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">El enlace no corresponde a una sección disponible.</p><Link to="/dashboard" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Ir al inicio</Link></section>;
}
