import { useRef } from 'react';
import { ArrowLeft, Filter, Plus, Search, X } from 'lucide-react';
import MenuOperaciones, { type OpcionOperacion } from './MenuOperaciones';
import './gestionAlumnos.css';

export default function CabeceraGestionAlumnos({onBack,onNuevo,ocupado,herramientas,busqueda,onBusqueda,onFiltros,filtrosAbiertos,filtros,total}: {
  onBack:()=>void;onNuevo:()=>void;ocupado:boolean;herramientas:OpcionOperacion[];busqueda:string;onBusqueda:(v:string)=>void;onFiltros:()=>void;filtrosAbiertos:boolean;
  filtros:{etiqueta:string;quitar:()=>void}[];total:number;
}) {
  const buscador=useRef<HTMLInputElement>(null);
  return <><nav className="alumnos-regreso" aria-label="Regresar desde alumnos"><button type="button" onClick={onBack}><ArrowLeft size={17}/>Volver al Inicio</button></nav>
    <header className="alumnos-cabecera">
      <div className="alumnos-cabecera-titulo"><div><h1>Gestión de Alumnos</h1><p>Consulta el padrón y administra los expedientes.</p></div><div className="alumnos-cabecera-acciones"><MenuOperaciones etiqueta="Herramientas" opciones={herramientas}/><button type="button" className="alumnos-boton-primario" onClick={onNuevo} disabled={ocupado}><Plus size={17}/>Nuevo alumno</button></div></div>
      <div className="alumnos-consulta"><label className="alumnos-buscador"><span>Buscar alumno</span><div><Search size={17}/><input ref={buscador} aria-label="Buscar alumno" value={busqueda} onChange={e=>onBusqueda(e.target.value)} placeholder="Nombre, matrícula o programa…"/>{busqueda&&<button type="button" aria-label="Limpiar búsqueda" onClick={()=>{onBusqueda('');buscador.current?.focus();}}><X size={16}/></button>}</div></label>
        <button type="button" className="alumnos-boton-secundario" onClick={onFiltros} aria-expanded={filtrosAbiertos} aria-controls="filtros-padron"><Filter size={16}/>Filtros{filtros.length>0&&<span className="alumnos-contador">{filtros.length}</span>}</button><p className="alumnos-resultados" aria-live="polite">{total.toLocaleString('es-MX')} {total===1?'resultado':'resultados'}</p></div>
      {!!filtros.length&&<div className="alumnos-filtros-aplicados" aria-label="Filtros aplicados">{filtros.map(f=><button key={f.etiqueta} type="button" onClick={f.quitar}>{f.etiqueta}<X size={13}/><span className="sr-only">Quitar filtro</span></button>)}</div>}
    </header></>;
}
