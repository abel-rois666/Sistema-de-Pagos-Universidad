import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAppStore} from '../../store/useAppStore';
import AsociarCertificacionesLote from './AsociarCertificacionesLote';
export default function HerramientasEscolares(){
 const location=useLocation(),navigate=useNavigate(),admin=useAppStore(s=>s.currentUser?.rol==='ADMINISTRADOR');
 if(!admin)return <p>Solo Administración puede utilizar estas herramientas.</p>;
 if(location.pathname.endsWith('/titulaciones'))return <AsociarCertificacionesLote tipo="titulacion" onBack={()=>navigate('/herramientas-escolares')}/>;
 if(location.pathname.endsWith('/certificaciones'))return <AsociarCertificacionesLote onBack={()=>navigate('/herramientas-escolares')}/>;
 return <section className="mx-auto max-w-5xl p-4 sm:p-6 text-gray-900 dark:text-gray-100"><Link to="/control-escolar">← Volver a Control Escolar</Link><h1 className="text-2xl font-semibold my-5">Herramientas administrativas</h1><Link className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228] p-5 focus-visible:outline-blue-500" to="/herramientas-escolares/certificaciones"><h2 className="font-semibold">Asociar certificaciones pendientes</h2><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Revisa las fichas sin programa, elige el destino y confirma las asociaciones seleccionadas.</p></Link><Link className="block mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228] p-5" to="/herramientas-escolares/titulaciones"><h2 className="font-semibold">Asociar titulaciones pendientes</h2><p className="mt-2 text-sm">Elige un programa por ficha, incluidos programas históricos, y confirma el lote revisado.</p></Link></section>;
}
