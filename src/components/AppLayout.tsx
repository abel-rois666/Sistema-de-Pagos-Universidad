import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Calendar,
  CheckCircle,
  Users,
  FileText,
  BookUser
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { supabase, updateUserPreferences } from '../lib/supabase';
import DarkModeToggle from './DarkModeToggle';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { currentUser, setCurrentUser, appConfig, ciclos, activeCicloId, setActiveCicloId } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [showCicloMenu, setShowCicloMenu] = useState(false);
  const cicloMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú de ciclos al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cicloMenuRef.current && !cicloMenuRef.current.contains(event.target as Node)) {
        setShowCicloMenu(false);
      }
    }
    if (showCicloMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCicloMenu]);

  // Si no hay usuario, solo renderizar el contenido (el login)
  if (!currentUser) return <>{children}</>;

  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const isRestrictedRole = currentUser.rol === 'COORDINADOR' || currentUser.rol === 'CAJERO';
  const isDocente = currentUser.rol === 'DOCENTE';

  let menuItems: any[] = [];

  if (isDocente) {
    menuItems = [
      { name: 'Captura de Calificaciones', icon: <BookOpen size={20} />, path: '/calificaciones' }
    ];
  } else {
    menuItems = [
      { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
      { 
        name: 'Control Escolar', 
        icon: <GraduationCap size={20} />, 
        path: '/control-escolar',
        children: [
          { name: 'Gestión de Alumnos', path: '/alumnos', icon: <Users size={16}/> },
          { name: 'Grupos', path: '/grupos', icon: <Users size={16}/> },
          { name: 'Planes de Estudio', path: '/planes-estudio', icon: <BookOpen size={16}/> },
          { name: 'Calificaciones', path: '/calificaciones', icon: <BookOpen size={16}/> }
        ]
      },
      { name: 'Control Financiero', icon: <Wallet size={20} />, path: '/' },
      { 
        name: 'Control Académico', 
        icon: <BookOpen size={20} />, 
        path: '/control-academico',
        children: [
          { name: 'Docentes', path: '/docentes', icon: <BookUser size={16}/> }
        ]
      },
      { name: 'Recursos Humanos', icon: <Briefcase size={20} />, path: '/rh' },
    ];

    if (isRestrictedRole) {
      menuItems = menuItems.filter(item => item.name === 'Control Financiero');
    } else {
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

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/control-ingresos') || location.pathname.startsWith('/plan-pagos') || location.pathname.startsWith('/ficha-alumno') || location.pathname.startsWith('/estadisticas') || location.pathname.startsWith('/deudores');
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans overflow-hidden">
      
      {/* ── SIDEBAR ── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 76 }}
        className="relative flex flex-col bg-white dark:bg-[#181e25] border-r border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] shadow-[var(--shadow-subtle)] z-50 h-full flex-shrink-0 transition-all duration-300"
      >
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-6 bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 rounded-full p-1.5 shadow-md z-10 transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
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
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1.5 scrollbar-thin">
          {menuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const active = isActive(item.path);
            const isOpen = openMenus[item.name];

            const handleItemClick = (e: React.MouseEvent) => {
              if (hasChildren) {
                e.preventDefault();
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true);
                  setOpenMenus(prev => ({ ...prev, [item.name]: true }));
                  if (item.path !== '#') navigate(item.path);
                } else {
                  setOpenMenus(prev => ({ ...prev, [item.name]: !prev[item.name] }));
                  if (item.path !== '#' && !openMenus[item.name]) {
                    navigate(item.path);
                  }
                }
              }
            };

            return (
              <div key={item.name} className="flex flex-col">
                <Link
                  to={item.path !== '#' ? item.path : '#'}
                  onClick={hasChildren ? handleItemClick : undefined}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                    active && !hasChildren
                      ? 'bg-blue-50 text-[#1456f0] dark:bg-blue-900/20 dark:text-blue-400 font-semibold shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.04)] hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${active && !hasChildren ? 'text-[#1456f0] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
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
            onClick={handleLogout}
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
                {location.pathname === '/' ? 'Control Financiero' : 
                 location.pathname === '/dashboard' ? 'Dashboard General' :
                 location.pathname === '/control-escolar' ? 'Control Escolar' :
                 location.pathname === '/alumnos' ? 'Gestión de Alumnos' :
                 location.pathname === '/planes-estudio' ? 'Planes de Estudio' :
                 location.pathname === '/control-academico' ? 'Control Académico' :
                 location.pathname === '/grupos' ? 'Gestión de Grupos' :
                 location.pathname === '/docentes' ? 'Gestión de Docentes' :
                 location.pathname === '/rh' ? 'Recursos Humanos' :
                 location.pathname === '/catalogos' ? 'Catálogos' :
                 location.pathname === '/plantillas' ? 'Plantillas y Documentos' :
                 location.pathname === '/configuracion-app' ? 'Configuración General' :
                 location.pathname === '/usuarios' ? 'Módulo de Usuarios' :
                 'Gestión Universitaria'}
             </h2>
          </div>

          {/* Acciones de la Topbar (Ciclo, Tema, Perfil) */}
          <div className="flex items-center gap-4">
            
            {/* Dropdown Ciclo */}
            <div className="relative shrink-0" ref={cicloMenuRef}>
              <button
                onClick={() => setShowCicloMenu(prev => !prev)}
                className="relative flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 text-[#1456f0] dark:bg-[rgba(59,130,246,0.1)] dark:border-[rgba(59,130,246,0.2)] dark:text-blue-400 rounded-full font-medium text-[13px] hover:bg-blue-100 dark:hover:bg-[rgba(59,130,246,0.15)] transition-colors"
              >
                <Calendar size={14} className="opacity-70" />
                <span className="truncate max-w-[120px]">{activeCiclo?.nombre || 'Seleccionar Ciclo'}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showCicloMenu ? 'rotate-180' : ''} opacity-70`} />
              </button>

              <AnimatePresence>
                {showCicloMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 bg-white dark:bg-[#1c2228] rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 min-w-[220px] flex flex-col"
                  >
                    {/* Barra de búsqueda */}
                    <div className="p-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
                      <input
                        type="text"
                        id="ciclo-search-input"
                        placeholder="Buscar ciclo..."
                        autoFocus
                        className="w-full text-[12px] px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 dark:text-gray-300 placeholder-gray-400"
                        onChange={(e) => {
                          const q = e.target.value.toLowerCase();
                          const items = document.querySelectorAll('[data-ciclo-item]');
                          items.forEach((el) => {
                            const name = el.getAttribute('data-ciclo-item') || '';
                            (el as HTMLElement).style.display = name.includes(q) ? '' : 'none';
                          });
                        }}
                      />
                    </div>

                    <div className="overflow-y-auto max-h-64 py-1">
                      {Array.from(new Set(ciclos.map(c => c.nombre)))
                        .map(nombre => ciclos.find(c => c.nombre === nombre)!) // Get first cycle with this name
                        .sort((a, b) => {
                          // Ordenar por año desc, luego por nombre desc
                          const anioA = a.anio || 0;
                          const anioB = b.anio || 0;
                          if (anioB !== anioA) return anioB - anioA;
                          return b.nombre.localeCompare(a.nombre);
                        })
                        .map(c => {
                          const isActivePeriod = c.nombre === activeCiclo?.nombre;
                          return (
                          <button
                            key={c.nombre}
                            data-ciclo-item={c.nombre.toLowerCase()}
                            onClick={() => {
                              const newId = c.id;
                              setActiveCicloId(newId);
                              if (currentUser) {
                                setCurrentUser({ ...currentUser, ultimo_ciclo_id: newId });
                                updateUserPreferences(currentUser.id, { ultimo_ciclo_id: newId });
                              }
                              setShowCicloMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-[13px] font-medium flex items-center justify-between transition-colors
                              ${isActivePeriod 
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-[#1456f0] dark:text-blue-400' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                          >
                            <span>{c.nombre}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {ciclos.some(x => x.nombre === c.nombre && x.activo) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Contiene ciclos activos" />}
                              {isActivePeriod && <CheckCircle size={14} />}
                            </div>
                          </button>
                        )})
                      }
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 hidden sm:block shrink-0"></div>

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
