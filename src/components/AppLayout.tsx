import { tituloRuta } from '../app/titulosRutas';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  GraduationCap,
  Wallet,
  BookOpen,
  Briefcase,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Pin,
  Calendar,
  ChevronDown,
  CalendarClock,
  Users,
  FileText,
  BookUser,
  Bell,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProteccionCaptura } from '../app/ProteccionCaptura';
import { puedeAccederRuta } from '../app/capacidades';
import { useAppStore } from '../store/useAppStore';
import { supabase, updateUserPreferences } from '../lib/supabase';
import DarkModeToggle from './DarkModeToggle';
import { playNotificationSound } from '../utils/notificationSound';

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

  const isDocente = currentUser.rol === 'DOCENTE';

  let menuItems: any[] = [];

  if (isDocente) {
    menuItems = [
      { name: 'Captura de Calificaciones', icon: <BookOpen size={20} />, path: '/calificaciones' }
    ];
  } else {
    menuItems = [
      { name: 'Inicio', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
      { 
        name: 'Control Escolar', 
        icon: <GraduationCap size={20} />, 
        path: '/control-escolar',
        children: [
          { name: 'Gestión de Alumnos', path: '/alumnos', icon: <Users size={16}/> },
          ...(['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'].includes(currentUser.rol)
            ? [{ name: 'Inscripciones por ciclo', path: '/inscripciones', icon: <UserCheck size={16}/> }] : []),
          { name: 'Grupos', path: '/grupos', icon: <Users size={16}/> },
          { name: 'Calendarios académicos', path: '/calendarios', icon: <Calendar size={16}/> },
          ...(['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'].includes(currentUser.rol)
            ? [{ name: 'Comunicados', path: '/comunicados', icon: <FileText size={16}/> }] : []),
          ...(['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'].includes(currentUser.rol)
            ? [{ name: 'Estadística 911', path: '/estadistica-911', icon: <FileText size={16}/> }] : []),
          { name: 'Planes de Estudio', path: '/planes-estudio', icon: <BookOpen size={16}/> },
          { name: 'Calificaciones', path: '/calificaciones', icon: <BookOpen size={16}/> },
          { name: 'Exportar certificados', path: '/certificacion', icon: <FileText size={16}/> },
          { name: 'Exportar títulos', path: '/titulacion', icon: <FileText size={16}/> },
          { name: 'Reportes', path: '/reportes-escolares', icon: <FileText size={16}/> },
          { name: 'Aprobación Prospectos', path: '/aprobacion-prospectos', icon: <UserCheck size={16}/> }
        ]
      },
      { name: 'Control Financiero', icon: <Wallet size={20} />, path: '/' },
      { 
        name: 'Control Académico', 
        icon: <BookOpen size={20} />, 
        path: '/control-academico',
        children: [
          { name: 'Docentes', path: '/docentes', icon: <BookUser size={16}/> },
          { name: 'Generador de Horarios', path: '/horarios', icon: <CalendarClock size={16}/> }
        ]
      },
      { name: 'Recursos Humanos', icon: <Briefcase size={20} />, path: '/rh' },
    ];

    // Filter menu based on roles
    if (currentUser.rol === 'COORDINADOR FINANCIERO' || currentUser.rol === 'CAJERO') {
      menuItems = menuItems.filter(item => item.name === 'Control Financiero');
    } else if (currentUser.rol === 'COORDINADOR CONTROL ESCOLAR') {
      menuItems = menuItems.filter(item => item.name === 'Inicio' || item.name === 'Control Escolar');
    } else if (currentUser.rol === 'COORDINADOR RECURSOS HUMANOS') {
      menuItems = menuItems.filter(item => item.name === 'Inicio' || item.name === 'Recursos Humanos');
    } else if (currentUser.rol === 'COORDINADOR ACADEMICO') {
      menuItems = menuItems.filter(item => item.name === 'Inicio' || item.name === 'Control Académico');
    } else if (currentUser.rol === 'ADMINISTRADOR') {
      // Admin sees everything + Config
      menuItems.push({
        name: 'Configuración',
        icon: <Settings size={20} className="transition-transform duration-300 group-hover:rotate-45" />,
        path: '#',
        children: [
          { name: 'Catálogos', path: '/catalogos', icon: <BookOpen size={16}/> },
          { name: 'Plantillas', path: '/plantillas', icon: <FileText size={16}/> },
          { name: 'Ciclos Escolares', path: '/ciclos', icon: <Calendar size={16}/> },
          { name: 'Usuarios', path: '/usuarios', icon: <Users size={16}/> },
          { name: 'Generales', path: '/configuracion-app', icon: <Settings size={16}/> }
        ]
      });
    }
  }

  if (['COORDINADOR ACADEMICO', 'COORDINADOR RECURSOS HUMANOS', 'COORDINADOR FINANCIERO'].includes(currentUser.rol)) {
    menuItems.push({ name: 'Estadística 911', path: '/estadistica-911', icon: <FileText size={20}/> });
  }
  menuItems = menuItems.map(item => ({ ...item,
    ...(item.children ? { children: item.children.filter((hijo: { path: string }) => puedeAccederRuta(currentUser.rol, hijo.path)) } : {}),
  })).filter(item => item.children ? item.children.length > 0 : puedeAccederRuta(currentUser.rol, item.path));

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/control-ingresos') || location.pathname.startsWith('/plan-pagos') || location.pathname.startsWith('/ficha-alumno') || location.pathname.startsWith('/estadisticas') || location.pathname.startsWith('/deudores');
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error('No se pudo cerrar la sesión. Revisa la conexión e inténtalo de nuevo.');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans overflow-hidden">
      
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
        className="relative flex flex-col bg-white dark:bg-[#181e25] border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] shadow-[var(--shadow-subtle)] z-50 h-full flex-shrink-0 transition-all duration-300"
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
                      {item.icon}
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
                               <span className="opacity-70">{subItem.icon}</span>
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
        <header className="h-[72px] bg-white/80 dark:bg-[#181e25]/80 backdrop-blur-md border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between px-6 z-40 shrink-0 shadow-[var(--shadow-subtle)]">
          
          {/* Breadcrumb o Título Contextual */}
          <div className="flex items-center gap-3">
             <h2 className="text-lg font-semibold text-[#222222] dark:text-gray-100 hidden sm:block" style={{ fontFamily: 'var(--font-display)' }}>
                {tituloRuta(location.pathname, currentUser.rol)}
             </h2>
          </div>

          {/* Acciones de la barra superior */}
          <div className="flex items-center gap-4">
            
            {/* Campana de Notificaciones — solo Admin y Coord. Control Escolar */}
            {canSeeNotifications && (
              <button
                onClick={() => navigate('/aprobacion-prospectos')}
                className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

            <DarkModeToggle 
              initialTheme={currentUser.preferencia_tema} 
              onChange={(isDark) => {
                const theme = isDark ? 'dark' : 'light';
                setCurrentUser({ ...currentUser, preferencia_tema: theme });
                updateUserPreferences(currentUser.id, { preferencia_tema: theme });
              }} 
            />

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
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
           {children}
        </main>
      </div>
    </div>
  );
}
