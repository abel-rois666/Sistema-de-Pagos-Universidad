import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronRight, LogOut, MoreHorizontal, X } from 'lucide-react';
import { dividirMenuMovil, menuActivo, type ElementoMenu } from '../../app/menuAplicacion';
import IconoMenu from './IconoMenu';
import './navegacionMovil.css';

interface Props {
  items:ElementoMenu[]; onSalir:()=>void; apariencia:ReactNode;
  notificaciones?:number; usuario:string;
}
/** Las siete opciones de Administración se distribuyen sin encoger siete etiquetas en una fila. */
export default function NavegacionMovil({items,onSalir,apariencia,notificaciones,usuario}:Props) {
  const {pathname}=useLocation();
  const [panel,setPanel]=useState<string|null>(null);
  const dialogo=useRef<HTMLDialogElement>(null);
  const botonCerrar=useRef<HTMLButtonElement>(null);
  const {principales,adicionales}=dividirMenuMovil(items);
  const activo=menuActivo(items,pathname);
  const seccion=items.find(i=>i.name===panel);
  useEffect(()=>{setPanel(null);},[pathname,usuario]);
  useEffect(()=>{
    const media=window.matchMedia('(min-width:640px)');
    const cambiar=()=>{if(media.matches)setPanel(null);};
    media.addEventListener('change',cambiar);return()=>media.removeEventListener('change',cambiar);
  },[]);
  useEffect(()=>{
    const nodo=dialogo.current;if(!panel||!nodo)return;
    const anterior=document.activeElement instanceof HTMLElement?document.activeElement:null;
    nodo.showModal();
    return()=>{if(nodo.open)nodo.close();if(anterior?.isConnected)anterior.focus({preventScroll:true});};
  },[Boolean(panel)]);
  useEffect(()=>{if(panel)botonCerrar.current?.focus();},[panel]);
  const cerrar=()=>setPanel(null);
  const enlace=(item:ElementoMenu)=> <Link key={item.path} to={item.path} onClick={cerrar} className="nav-movil-opcion" aria-current={pathname===item.path?'page':undefined}>
    <IconoMenu icono={item.icon}/><span>{item.name}</span><ChevronRight size={16} aria-hidden="true"/>
  </Link>;
  return <>
    <nav className="nav-movil" aria-label="Navegación principal móvil" style={{gridTemplateColumns:`repeat(${principales.length+1},minmax(0,1fr))`}}>
      {principales.map(item=>item.children?.length?<button key={item.path} type="button" className="nav-movil-acceso" aria-label={item.name} aria-current={activo===item?'page':undefined}
        aria-haspopup="dialog" aria-expanded={panel===item.name} onClick={()=>setPanel(item.name)}><IconoMenu icono={item.icon}/><span>{item.shortName||item.name}</span></button>
        :<Link key={item.path} className="nav-movil-acceso" aria-label={item.name} aria-current={activo===item?'page':undefined} to={item.path} onClick={cerrar}><IconoMenu icono={item.icon}/><span>{item.shortName||item.name}</span></Link>)}
      <button type="button" className="nav-movil-acceso" aria-label="Más opciones" aria-haspopup="dialog" aria-expanded={Boolean(panel==='mas'||seccion&&adicionales.includes(seccion))}
        data-activo={activo&&adicionales.includes(activo)||undefined} onClick={()=>setPanel('mas')}><MoreHorizontal size={20} aria-hidden="true"/><span>Más</span></button>
    </nav>
    {panel&&<dialog ref={dialogo} className="nav-movil-dialogo" aria-labelledby="nav-movil-titulo" aria-modal="true"
      onKeyDown={e=>{
        if(e.key!=='Tab')return;
        const nodo=e.currentTarget as HTMLDialogElement;
        const controles=Array.from(nodo.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(n=>n.getClientRects().length>0);
        const primero=controles[0],ultimo=controles.at(-1);
        if(!primero){e.preventDefault();return;}
        if(e.shiftKey&&(document.activeElement===primero||!nodo.contains(document.activeElement))){e.preventDefault();ultimo?.focus();}
        else if(!e.shiftKey&&(document.activeElement===ultimo||!nodo.contains(document.activeElement))){e.preventDefault();primero.focus();}
      }}
      onCancel={e=>{e.preventDefault();cerrar();}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();if(e.target===e.currentTarget&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))cerrar();}}>
      <header className="nav-movil-cabecera">
        {seccion&&adicionales.includes(seccion)&&<button type="button" aria-label="Volver a Más opciones" onClick={()=>setPanel('mas')}><ArrowLeft size={20}/></button>}
        <div><h2 id="nav-movil-titulo">{seccion?.name||'Más opciones'}</h2><p>{usuario}</p></div>
        <button ref={botonCerrar} type="button" aria-label="Cerrar menú" onClick={cerrar} autoFocus><X size={20}/></button>
      </header>
      <div className="nav-movil-cuerpo">
        {seccion?<nav aria-label={`Opciones de ${seccion.name}`}>
          {seccion.path!=='#'&&<Link className="nav-movil-opcion nav-movil-resumen" to={seccion.path} onClick={cerrar}><IconoMenu icono={seccion.icon}/><span>Inicio de {seccion.name}</span><ChevronRight size={16}/></Link>}
          {seccion.children?.map(enlace)}
        </nav>:<>
          <nav aria-label="Más secciones">{adicionales.map(item=>item.children?.length?<button key={item.path} className="nav-movil-opcion" type="button" onClick={()=>setPanel(item.name)} aria-current={activo===item?'page':undefined}>
            <IconoMenu icono={item.icon}/><span>{item.name}</span><ChevronRight size={16} aria-hidden="true"/></button>:enlace(item))}</nav>
          <div className="nav-movil-preferencias">
            {notificaciones!==undefined&&<Link to="/aprobacion-prospectos" onClick={cerrar} className="nav-movil-opcion"><Bell size={20}/><span>Prospectos pendientes</span><span className="nav-movil-contador">{notificaciones}</span></Link>}
            <div className="nav-movil-apariencia"><span>Apariencia</span>{apariencia}</div>
          </div>
          <button type="button" className="nav-movil-opcion nav-movil-salir" onClick={()=>{cerrar();onSalir();}}><LogOut size={20}/><span>Salir</span></button>
        </>}
      </div>
    </dialog>}
  </>;
}
