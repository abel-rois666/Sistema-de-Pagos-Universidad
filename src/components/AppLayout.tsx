import { tituloRuta } from '../app/titulosRutas';
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Pin,
  ChevronDown,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProteccionCaptura } from '../app/ProteccionCaptura';
import { useAppStore } from '../store/useAppStore';
import { supabase, updateUserPreferences } from '../lib/supabase';
import DarkModeToggle from './DarkModeToggle';
import { playNotificationSound } from '../utils/notificationSound';
import { menuAplicacion, menuActivo } from '../app/menuAplicacion';
import IconoMenu from './navegacion/IconoMenu';
import NavegacionMovil from './navegacion/NavegacionMovil';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const solicitarSalida = useProteccionCaptura();
  const { currentUser, appConfig, setCurrentUser } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [sidebarFijada, setSidebarFijada] = useState(false);
  const [cursorSobreSidebar, setCursorSobreSidebar] = useState(false);
  const [ignorarHoverHastaSalir, setIgnorarHoverHastaSalir] = useState(false);
  const isSidebarOpen = sidebarFijada || (cursorSobreSidebar && !ignorarHoverHastaSalir);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // ── Notificaciones en tiempo real (prospectos pendientes) ──────────────
  const [pendingCount, setPendingCount] = useState(0);
  const canSeeNotifications = currentUser?.rol === 'ADMINISTRADOR' || currentUser?.rol === 'COORDINADOR CONTROL ESCOLAR';

  const fetchPendingCount = useCallback(async () => {
    if (!canSeeNotifications) return;
    const { count, error } = await supabase
      .from('alumnos')
      .select('id', { count: 'exact', head: true })
      .eq('estatus', 'PENDIENTE_APROBACION')
      .not('crm_lead_id', 'is', null);
    if (!error && count !== null) setPendingCount(count);
  }, [canSeeNotifications]);

  useEffect(() => {
    if (!canSeeNotifications) return;
    fetchPendingCount();

    const channel = supabase
      .channel('prospectos-pendientes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alumnos', filter: 'estatus=eq.PENDIENTE_APROBACION' },
        (payload) => {
          if (payload.new && (payload.new as any).crm_lead_id) {
            setPendingCount(prev => prev + 1);
            playNotificationSound();
            toast('🔔 Nuevo prospecto: ' + ((payload.new as any).nombre_completo || 'Sin nombre'), {
              duration: 5000,
              style: { fontWeight: 600 }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alumnos' },
        () => {
          // Como 'payload.old' no trae el estatus sin REPLICA IDENTITY FULL, simplemente recalculamos.
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canSeeNotifications, fetchPendingCount]);

  // Si no hay usuario, solo renderizar el contenido (el login)
  if (!currentUser) return <>{children}</>;

  const menuItems = menuAplicacion(currentUser.rol);
  const seccionActiva = menuActivo(menuItems,location.pathname);
  const isActive = (path:string) => seccionActiva?.path === path;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error('No se pudo cerrar la sesión. Revisa la conexión e inténtalo de nuevo.');
  };

  return (
    <div className="app-shell flex h-dvh bg-gray-50 dark:bg-gray-950 font-sans overflow-hidden">
      
      {/* ── SIDEBAR ── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 76 }}
        onPointerEnter={event => {
          if (event.pointerType === 'mouse' || event.pointerType === 'pen') setCursorSobreSidebar(true);
        }}
        onPointerLeave={() => {
          setCursorSobreSidebar(false);
          setIgnorarHoverHastaSalir(false);
        }}
        className="relative hidden sm:flex flex-col bg-white dark:bg-[#181e25] border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] shadow-[var(--shadow-subtle)] z-50 h-full flex-shrink-0 transition-all duration-300"
      >
        {/* Toggle Sidebar Button */}
        <button
          type="button"
          aria-label={sidebarFijada ? 'Contraer barra lateral' : 'Mantener barra lateral abierta'}
          title={sidebarFijada ? 'Contraer barra lateral' : 'Mantener barra lateral abierta'}
          onClick={() => {
            setSidebarFijada(!sidebarFijada);
            setIgnorarHoverHastaSalir(sidebarFijada);
          }}
          className="absolute -right-3 top-6 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 rounded-full p-1.5 shadow-md z-10 transition-colors"
        >
          {sidebarFijada ? <ChevronLeft size={14} /> : isSidebarOpen ? <Pin size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Logo / Title */}
        <div className="flex items-center h-[72px] px-4 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 w-full">
            {appConfig?.logoUrl ? (
              <img src={appConfig.logoUrl} alt="App Logo" className="h-9 w-auto shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-[#1456f0] rounded-xl flex items-center justify-center shadow-sm shrink-0 text-white font-bold text-lg">
                U
              </div>
            )}
            {isSidebarOpen && (
              <span className="font-semibold text-[15px] text-[#222222] dark:text-gray-100 line-clamp-2 leading-[1.15] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {appConfig?.title || 'CRM Universitario'}
              </span>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1.5 custom-scrollbar">
          {menuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const active = isActive(item.path);
            const isOpen = openMenus[item.name];

            const handleItemClick = (e: React.MouseEvent) => {
              if (hasChildren) {
                e.preventDefault();
                if (!isSidebarOpen) {
                  setSidebarFijada(true);
                  setIgnorarHoverHastaSalir(false);
                  setOpenMenus(prev => ({ ...prev, [item.name]: true }));
                } else {
                  setOpenMenus(prev => ({ ...prev, [item.name]: !prev[item.name] }));
                }
              }
            };

            return (
              <div key={item.name} className="flex flex-col">
                <Link
                  to={hasChildren ? '#' : (item.path !== '#' ? item.path : '#')}
                  onClick={hasChildren ? handleItemClick : undefined}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                    active && !hasChildren
                      ? 'bg-blue-50 text-[#1456f0] dark:bg-blue-900/20 dark:text-blue-400 font-semibold shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.04)] hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={(e) => {
                        if (hasChildren && isSidebarOpen && item.path !== '#') {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(item.path);
                        }
                      }}
                      className={`${active && !hasChildren ? 'text-[#1456f0] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'} ${hasChildren && isSidebarOpen ? 'cursor-pointer hover:text-[#1456f0] dark:hover:text-blue-400 transition-colors' : ''}`}
                      title={hasChildren && isSidebarOpen ? `Ir a ${item.name}` : undefined}
                    >
                      <IconoMenu icono={item.icon}/>
                    </div>
                    {isSidebarOpen && <span className="whitespace-nowrap text-[14.5px]">{item.name}</span>}
                  </div>
                  {isSidebarOpen && hasChildren && (
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                  {!isSidebarOpen && (
                    <div className="fixed left-[76px] ml-2 px-2.5 py-1.5 bg-gray-800 dark:bg-gray-700 text-white text-xs font-semibold rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[9999] whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </Link>

                {/* Submenu Accordion */}
                {hasChildren && (
                  <AnimatePresence initial={false}>
                    {isSidebarOpen && isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden ml-9 mt-1 flex flex-col gap-1 border-l-2 border-gray-100 dark:border-gray-800"
                      >
                        {item.children!.map((subItem) => {
                          const isSubActive = location.pathname.startsWith(subItem.path);
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-r-xl transition-colors text-[13.5px] ${
                                isSubActive
                                  ? 'bg-blue-50/50 text-[#1456f0] dark:bg-blue-900/10 dark:text-blue-400 font-semibold'
                                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                               <span className="opacity-70"><IconoMenu icono={subItem.icon} size={16}/></span>
                               <span className="whitespace-nowrap">{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </div>

        {/* Logout Area */}
        <div className="p-4 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] shrink-0">
          <button
            aria-label="Cerrar sesión"
            onClick={() => solicitarSalida(() => { void handleLogout(); })}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors group relative ${
              isSidebarOpen 
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20'
                : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
            }`}
          >
            <LogOut size={18} />
            {isSidebarOpen && <span className="text-[14px]">Cerrar Sesión</span>}
            {!isSidebarOpen && (
              <div className="fixed left-[76px] ml-2 px-2.5 py-1.5 bg-gray-800 dark:bg-gray-700 text-white text-xs font-semibold rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[9999] whitespace-nowrap">
                Cerrar Sesión
              </div>
            )}
          </button>
        </div>
      </motion.aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOPBAR GLOBAL */}
        <header className="h-16 sm:h-[72px] bg-white/80 dark:bg-[#181e25]/80 backdrop-blur-md border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3 px-4 sm:px-6 z-40 shrink-0 shadow-[var(--shadow-subtle)]">
          
          {/* Breadcrumb o Título Contextual */}
          <div className="flex min-w-0 items-center gap-3">
             <div className="sm:hidden shrink-0">{appConfig?.logoUrl?<img src={appConfig.logoUrl} alt="Institución" className="h-7 w-7 object-contain"/>:<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">U</span>}</div>
             <h2 className="truncate text-base sm:text-lg font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>
                {tituloRuta(location.pathname, currentUser.rol)}
             </h2>
          </div>

          {/* Acciones de la barra superior */}
          <div className="flex items-center gap-4">
            
            {/* Campana de Notificaciones — solo Admin y Coord. Control Escolar */}
            {canSeeNotifications && (
              <button
                onClick={() => navigate('/aprobacion-prospectos')}
                className="relative hidden sm:inline-flex p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={`${pendingCount} prospecto${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`}
              >
                <Bell size={18} />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm animate-pulse">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </button>
            )}

            <div className="hidden sm:block"><DarkModeToggle
              initialTheme={currentUser.preferencia_tema} 
              onChange={(isDark) => {
                const theme = isDark ? 'dark' : 'light';
                setCurrentUser({ ...currentUser, preferencia_tema: theme });
                updateUserPreferences(currentUser.id, { preferencia_tema: theme });
              }} 
            /></div>

            {/* Perfil */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex flex-col items-end leading-none hidden sm:flex">
                <span className="text-[13px] font-semibold text-[#222222] dark:text-gray-200">{currentUser.username}</span>
                <span className="text-[10px] font-bold text-[#1456f0] dark:text-blue-400 uppercase tracking-wider mt-1">{currentUser.rol}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[#1456f0] dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-sm shadow-sm">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
            </div>

          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="app-contenido flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
           {children}
        </main>
      </div>
      <NavegacionMovil items={menuItems} usuario={currentUser.username}
        onSalir={()=>solicitarSalida(()=>{void handleLogout();})} notificaciones={canSeeNotifications?pendingCount:undefined}
        apariencia={<DarkModeToggle initialTheme={currentUser.preferencia_tema} onChange={isDark=>{
          const theme=isDark?'dark':'light';setCurrentUser({...currentUser,preferencia_tema:theme});updateUserPreferences(currentUser.id,{preferencia_tema:theme});
        }}/>} />
    </div>
  );
}
