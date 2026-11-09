import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import EstadoError from '../ui/EstadoError';
import SeleccionVisible from '../ui/SeleccionVisible';
import { cambiarSeleccionVisible } from '../../utils/seleccionVisible';
import { compararDirectorio, consultarFilasDirectorio, paginaDirectorio, textoDirectorio, type FilaDirectorioPersonal } from '../../personal/directorio';
import './directorioPersonal.css';

interface Props {
  tipo: 'docentes' | 'administrativos'; filas: FilaDirectorioPersonal[];
  cargando: boolean; error: string; reintentar: () => void;
  abrir: (id: string) => void; acciones: (id: string) => ReactNode;
  seleccion?: string[]; cambiarSeleccion?: (ids: string[]) => void;
  accionesSeleccion?: ReactNode;
}

export function EstadoPersonal({ valor }: { valor?: string }) {
  const estado = textoDirectorio(valor);
  return <span className={`directorio-estado ${estado === 'activo' ? 'directorio-activo' : ['inactivo', 'baja'].includes(estado) ? 'directorio-aviso' : ''}`}>{valor ? valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase() : 'Sin registrar'}</span>;
}

export default function DirectorioPersonal({ tipo, filas, cargando, error, reintentar, abrir, acciones, seleccion, cambiarSeleccion, accionesSeleccion }: Props) {
  const esDocente = tipo === 'docentes', id = useId();
  const [busqueda, setBusqueda] = useState(''), [estado, setEstado] = useState(() => esDocente && localStorage.getItem('docentes_omitir_inactivos') !== 'false' ? 'activo' : '');
  const [area, setArea] = useState(''), [puesto, setPuesto] = useState(''), [vinculo, setVinculo] = useState(''), [cuenta, setCuenta] = useState('');
  const [filtros, setFiltros] = useState(false), [detalles, setDetalles] = useState(false);
  const [orden, setOrden] = useState('nombre'), [direccion, setDireccion] = useState<'asc' | 'desc'>('asc');
  const [pagina, setPagina] = useState(() => Math.max(1, Number(sessionStorage.getItem(`${tipo}_pagina_directorio`)) || 1)), [cantidad, setCantidad] = useState(10);
  const filtradas = useMemo(() => consultarFilasDirectorio(filas, { busqueda, estado, area, puesto, vinculo, cuenta, orden, direccion }), [filas, busqueda, estado, area, puesto, vinculo, cuenta, orden, direccion]);
  const paginacion = paginaDirectorio(filtradas.length, pagina, cantidad);
  const visibles = filtradas.slice(paginacion.desde, paginacion.hasta);
  const claveFiltros = JSON.stringify([busqueda, estado, area, puesto, vinculo, cuenta, orden, direccion, cantidad]);
  const filtrosAnteriores = useRef(claveFiltros);
  useEffect(() => { if (filtrosAnteriores.current !== claveFiltros) { filtrosAnteriores.current = claveFiltros; setPagina(1); } }, [claveFiltros]);
  useEffect(() => { if (!cargando && !error && pagina !== paginacion.actual) setPagina(paginacion.actual); }, [pagina, paginacion.actual, cargando, error]);
  useEffect(() => { sessionStorage.setItem(`${tipo}_pagina_directorio`, String(pagina)); }, [tipo, pagina]);
  useEffect(() => { if (esDocente) localStorage.setItem('docentes_omitir_inactivos', String(estado === 'activo')); }, [esDocente, estado]);
  const catalogo = (campo: 'area' | 'puesto') => [...new Set(filas.map(f => f[campo]).filter((v): v is string => Boolean(v)))].sort(compararDirectorio);
  const estados = [...new Set(filas.map(f => textoDirectorio(f.estatus)).filter(Boolean))].sort(compararDirectorio);
  const conVinculos = filas.some(f => f.funcionVinculada !== undefined);
  const verCuentas = esDocente && filas.some(f => f.cuenta);
  const nFiltros = [estado, area, puesto, vinculo, cuenta].filter(Boolean).length;
  const limpiar = () => { setBusqueda(''); setEstado(''); setArea(''); setPuesto(''); setVinculo(''); setCuenta(''); };
  const ordenar = (campo: string) => { if (orden === campo) setDireccion(d => d === 'asc' ? 'desc' : 'asc'); else { setOrden(campo); setDireccion('asc'); } };
  const encabezado = (campo: string, texto: string) => <th scope="col" aria-sort={orden === campo ? direccion === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => ordenar(campo)}>{texto}{orden === campo && (direccion === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>)}</button></th>;
  const seleccionFila = (f: FilaDirectorioPersonal) => seleccion && cambiarSeleccion && <input type="checkbox" aria-label={`Seleccionar a ${f.nombre}`} checked={seleccion.includes(f.id)} onChange={e => cambiarSeleccion(cambiarSeleccionVisible(seleccion, [f.id], e.target.checked))}/>;
  const identidad = (f: FilaDirectorioPersonal) => <><button type="button" className="directorio-nombre" onClick={() => abrir(f.id)}>{f.nombre}</button><span className="directorio-secundario">{esDocente ? f.clave || 'Sin clave docente' : f.contacto || 'Sin teléfono registrado'}</span></>;
  const funciones = (f: FilaDirectorioPersonal) => <>{f.funcionVinculada === true ? <span className="directorio-estado directorio-vinculo">Administrativo y docente</span> : f.funcionVinculada === false ? <span className="directorio-secundario">Sin otra función vinculada</span> : <span className="directorio-secundario">Consultar en ficha</span>}</>;
  const identificadores = (f: FilaDirectorioPersonal) => <dl className="directorio-detalles">{f.detalles.map(d => <div key={d.etiqueta}><dt>{d.etiqueta}</dt><dd>{d.valor || 'Sin registrar'}</dd></div>)}</dl>;
  return <section className="directorio-personal" aria-label={`Directorio de ${tipo}`} aria-busy={cargando}>
    <div className="directorio-barra">
      <label className="directorio-busqueda" htmlFor={`${id}-buscar`}><span>Buscar {esDocente ? 'docente' : 'administrativo'}</span><div><Search size={17}/><input id={`${id}-buscar`} type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={esDocente ? 'Nombre, clave, correo, RFC o CURP' : 'Nombre, cargo, área, teléfono, RFC o CURP'}/></div></label>
      <button type="button" className="directorio-filtro-boton" aria-expanded={filtros} aria-controls={`${id}-filtros`} onClick={() => setFiltros(v => !v)}><SlidersHorizontal size={16}/>Filtros{nFiltros > 0 && <span className="directorio-contador">{nFiltros}</span>}</button>
      <label className="directorio-columnas"><input type="checkbox" checked={detalles} onChange={e => setDetalles(e.target.checked)}/>Mostrar detalles</label>
      <span className="directorio-resultados" role="status">{cargando ? 'Actualizando…' : error ? 'Consulta pendiente' : `${filtradas.length} ${filtradas.length === 1 ? 'resultado' : 'resultados'}`}</span>
    </div>
    {filtros && <div id={`${id}-filtros`} className="directorio-filtros">
      <label>{esDocente ? 'Habilitación docente' : 'Situación administrativa'}<select value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos los estados</option>{[...new Set(['activo','inactivo',...estados])].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}</select></label>
      {!esDocente && <><label>Área<select value={area} onChange={e => setArea(e.target.value)}><option value="">Todas las áreas</option>{catalogo('area').map(v => <option key={v}>{v}</option>)}</select></label><label>Cargo<select value={puesto} onChange={e => setPuesto(e.target.value)}><option value="">Todos los cargos</option>{catalogo('puesto').map(v => <option key={v}>{v}</option>)}</select></label></>}
      {conVinculos && <label>Otra función vinculada<select value={vinculo} onChange={e => setVinculo(e.target.value)}><option value="">Todos los vínculos</option><option value="con">Con función {esDocente ? 'administrativa' : 'docente'}</option><option value="sin">Sin otra función vinculada</option></select></label>}
      {verCuentas && <label>Cuenta de usuario<select value={cuenta} onChange={e => setCuenta(e.target.value)}><option value="">Todas las cuentas</option>{['Sin cuenta', 'Cuenta activa', 'Cuenta desactivada', 'Cuenta por verificar'].map(v => <option key={v}>{v}</option>)}</select></label>}
      <label>Orden de consulta<select value={orden} onChange={e => setOrden(e.target.value)}><option value="nombre">Nombre</option>{esDocente ? <option value="clave">Clave docente</option> : <option value="puesto">Cargo</option>}<option value="estatus">Estado</option></select></label>
      <button type="button" onClick={() => setDireccion(d => d === 'asc' ? 'desc' : 'asc')}>{direccion === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}</button>
      <button type="button" onClick={limpiar}>Limpiar filtros</button>
    </div>}
    {(nFiltros > 0 || busqueda) && <div className="directorio-aplicados" aria-label="Filtros aplicados">
      {[[estado, `Estado: ${estado}`, () => setEstado('')], [area, `Área: ${area}`, () => setArea('')], [puesto, `Cargo: ${puesto}`, () => setPuesto('')], [vinculo, vinculo === 'con' ? 'Con otra función vinculada' : 'Sin otra función vinculada', () => setVinculo('')], [cuenta, cuenta, () => setCuenta('')]].map(([valor, texto, quitar], i) => valor ? <button key={i} type="button" onClick={quitar as () => void} aria-label={`Quitar filtro ${texto}`}>{texto as string}<X size={12}/></button> : null)}
      {busqueda && <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">Búsqueda: {busqueda}<X size={12}/></button>}
    </div>}
    {seleccion && seleccion.length > 0 && <div className="directorio-seleccion"><span><strong>{seleccion.length}</strong> seleccionados · {seleccion.filter(s => !visibles.some(f => f.id === s)).length} fuera de esta página</span><button type="button" onClick={() => cambiarSeleccion?.([])}>Limpiar selección</button>{accionesSeleccion}</div>}
    {error ? <div className="directorio-vacio"><EstadoError mensaje={error} onReintentar={reintentar}/></div> : !filtradas.length ? <div className="directorio-vacio" role="status"><Users size={28}/><h3>{cargando ? 'Consultando directorio…' : filas.length ? 'Sin coincidencias' : 'Sin registros'}</h3><p>{cargando ? 'Espera un momento.' : filas.length ? 'Prueba otro nombre o ajusta los filtros.' : `Todavía no hay ${tipo} registrados.`}</p>{!cargando && (nFiltros > 0 || busqueda) && <button type="button" onClick={limpiar}>Limpiar búsqueda y filtros</button>}</div> : <>
      <div className="directorio-orden-movil"><label>Ordenar por<select value={orden} onChange={e => setOrden(e.target.value)}><option value="nombre">Nombre</option>{esDocente ? <option value="clave">Clave</option> : <option value="puesto">Cargo</option>}<option value="estatus">Estado</option></select></label><button type="button" onClick={() => setDireccion(d => d === 'asc' ? 'desc' : 'asc')}>{direccion === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}</button>{seleccion && cambiarSeleccion && <label className="directorio-columnas"><SeleccionVisible seleccion={seleccion} visibles={visibles.map(f => f.id)} onChange={e => cambiarSeleccion(cambiarSeleccionVisible(seleccion, visibles.map(f => f.id), e.target.checked))}/>Seleccionar página</label>}</div>
      <div className="directorio-tabla"><table><thead><tr>{seleccion && <th scope="col" className="directorio-casilla"><SeleccionVisible seleccion={seleccion} visibles={visibles.map(f => f.id)} onChange={e => cambiarSeleccion?.(cambiarSeleccionVisible(seleccion, visibles.map(f => f.id), e.target.checked))}/></th>}{encabezado('nombre', esDocente ? 'Docente / clave' : 'Administrativo')}{esDocente ? <th scope="col">Contacto</th> : encabezado('puesto', 'Cargo / área')}{encabezado('estatus', esDocente ? 'Habilitación' : 'Situación')}<th scope="col">{verCuentas ? 'Cuenta' : 'Funciones'}</th>{detalles && <th scope="col">Detalles</th>}<th scope="col" className="directorio-col-acciones">Acciones</th></tr></thead><tbody>{visibles.map(f => <tr key={f.id} data-seleccionado={seleccion?.includes(f.id) || undefined}>{seleccion && <td className="directorio-casilla">{seleccionFila(f)}</td>}<td>{identidad(f)}</td><td>{esDocente ? <><span className="directorio-contacto">{f.contacto || 'Sin correo registrado'}</span>{verCuentas && funciones(f)}</> : <><strong>{f.puesto || 'Cargo sin registrar'}</strong><span className="directorio-secundario">{f.area || 'Área sin registrar'}</span></>}</td><td><EstadoPersonal valor={f.estatus}/></td><td>{verCuentas ? <span className={`directorio-estado directorio-${f.cuenta?.tono}`}>{f.cuenta?.texto}</span> : funciones(f)}</td>{detalles && <td>{identificadores(f)}</td>}<td className="directorio-col-acciones"><div className="directorio-acciones"><button type="button" onClick={() => abrir(f.id)} aria-label={`Ver ficha de ${f.nombre}`}>Ver ficha</button>{acciones(f.id)}</div></td></tr>)}</tbody></table></div>
      <div className="directorio-tarjetas">{visibles.map(f => <article key={f.id} data-seleccionado={seleccion?.includes(f.id) || undefined}><header>{seleccionFila(f)}<div>{identidad(f)}</div><EstadoPersonal valor={f.estatus}/></header>{esDocente ? <p className="directorio-contacto">{f.contacto || 'Sin correo registrado'}</p> : <p>{f.puesto || 'Cargo sin registrar'} · {f.area || 'Área sin registrar'}</p>}<div className="directorio-tarjeta-estados">{funciones(f)}{verCuentas && <span className={`directorio-estado directorio-${f.cuenta?.tono}`}>{f.cuenta?.texto}</span>}</div>{detalles && identificadores(f)}<footer className="directorio-acciones"><button type="button" onClick={() => abrir(f.id)} aria-label={`Ver ficha de ${f.nombre}`}>Ver ficha</button>{acciones(f.id)}</footer></article>)}</div>
    </>}
    <nav className="directorio-paginacion" aria-label={`Páginas de ${tipo}`}><label>Por página<select value={cantidad} onChange={e => setCantidad(Number(e.target.value))}>{[10,20,50,100].map(n => <option key={n}>{n}</option>)}</select></label><span>{error ? 'Consulta pendiente' : `${filtradas.length ? paginacion.desde + 1 : 0}–${paginacion.hasta} de ${filtradas.length}`}</span><div><button type="button" disabled={cargando || !!error || paginacion.actual === 1} onClick={() => setPagina(paginacion.actual - 1)}>Anterior</button><span>{paginacion.actual} / {paginacion.paginas}</span><button type="button" disabled={cargando || !!error || paginacion.actual === paginacion.paginas} onClick={() => setPagina(paginacion.actual + 1)}>Siguiente</button></div></nav>
  </section>;
}
