import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, User, BarChart3, Users, GraduationCap, Calendar, AlertCircle, Wallet, ChevronDown, TrendingDown, ClipboardList, FileCheck2 } from 'lucide-react';

import { puedeAccederRuta } from '../app/capacidades';
import { useAppStore } from '../store/useAppStore';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useCicloModulo } from '../hooks/useCicloModulo';
import ImportarCSV from './ImportarCSV';
import SelectorCicloModulo from './ui/SelectorCicloModulo';
import { getMaxFolioCounter } from '../utils';
import { Alumno, PaymentPlan } from '../types';
import AccesoDashboardFinanciero from './AccesoDashboardFinanciero';
import '../app/paletaDashboard.css';
import './dashboardFinanciero.css';

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.25, ease: "easeOut" }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, ciclos, alumnos, plans, setAlumnos, setPlans, activeCicloId: cicloGlobalId, appConfig } = useAppStore();
  const [activeCicloId, setCicloModuloId] = useCicloModulo('dashboard', ciclos, cicloGlobalId, currentUser?.id);
  const { activeCiclo, filteredPlans, totalActivos, totalDeudores, totalAdeudoCiclo } = useDashboardStats(activeCicloId);

  const [showImport, setShowImport] = useState(false);
  const [sectionOperaciones, setSectionOperaciones] = useState(true);
  const [sectionReportes, setSectionReportes] = useState(true);

  const handleImport = async (newAlumnos: Alumno[], newPlans: PaymentPlan[]) => {
    if (newAlumnos.length > 0) {
      setAlumnos(prev => {
        const copy = [...prev];
        newAlumnos.forEach(na => {
          const idx = copy.findIndex(a => a.id === na.id);
          if (idx >= 0) copy[idx] = na;
          else copy.push(na);
        });
        return copy;
      });
    }
    if (newPlans.length > 0) {
      setPlans(prev => {
        const copy = [...prev];
        newPlans.forEach(np => {
          const idx = copy.findIndex(p => p.id === np.id);
          if (idx >= 0) copy[idx] = np;
          else copy.push(np);
        });
        return copy;
      });
    }
  };

  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const now = new Date();
  const dateStr = `${dayNames[now.getDay()]}, ${now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  
  const statCards = [
    {
      label: 'Alumnos Activos',
      value: totalActivos.toLocaleString(),
      icon: <GraduationCap size={22} />,
      sub: 'del ciclo activo',
    },
    {
      label: 'Adeudo del Ciclo',
      value: `$${totalAdeudoCiclo.toLocaleString()}`,
      icon: <TrendingDown size={22} />,
      sub: 'vencido hasta hoy',
    },
    {
      label: 'Alumnos Deudores',
      value: totalDeudores.toLocaleString(),
      icon: <AlertCircle size={22} />,
      sub: 'con pagos vencidos a hoy',
    },
    {
      label: 'Planes del Ciclo',
      value: filteredPlans.length.toLocaleString(),
      icon: <ClipboardList size={22} />,
      sub: 'registrados',
    },
  ];

  if (!currentUser) return null;

  return (
    <motion.div key="home" initial="initial" animate="animate" exit="exit" variants={pageVariants}
      transition={pageVariants.transition as any} className="paleta-dashboard tablero-financiero">
      <AnimatePresence>
        {showImport && <ImportarCSV
          activeCicloId={activeCicloId} activeCicloNombre={activeCiclo?.nombre || ''} ciclos={ciclos}
          globalMaxCounter={getMaxFolioCounter(plans)} existingAlumnos={alumnos} existingPlans={filteredPlans}
          onImport={handleImport} onClose={() => setShowImport(false)} />}
      </AnimatePresence>
      <div className="tablero-contenido">

        <section className="tablero-panel tablero-resumen" aria-label="Resumen financiero">
          <header className="tablero-saludo">
            <div className="tablero-bienvenida">
              <h2 style={{ fontFamily: 'var(--font-display)' }}>👋 ¡Hola, {currentUser.username}!</h2>
              <p>{dateStr}<span className="tablero-fecha-separador" aria-hidden="true">·</span>
                <span>Ciclo: <strong>{activeCiclo?.nombre || '—'}</strong></span></p>
            </div>
            <div className="tablero-controles">
              <SelectorCicloModulo ciclos={ciclos} cicloId={activeCicloId || ''}
                label="Ciclo del tablero" onChange={setCicloModuloId}/>
              {currentUser.rol === 'ADMINISTRADOR' && <button type="button" onClick={() => setShowImport(true)} className="tablero-importar">
                <FileText size={16} aria-hidden="true"/>Importar CSV
              </button>}
            </div>
          </header>
          {currentUser.rol !== 'CAJERO' && <div className="tablero-estadisticas">
            {statCards.map(card => <div key={card.label} className="tablero-estadistica">
              <span className="tablero-icono" aria-hidden="true">{card.icon}</span>
              <div className="tablero-estadistica-valor">{card.value}</div>
              <div className="tablero-estadistica-etiqueta">{card.label}</div>
              <div className="tablero-estadistica-ayuda">{card.sub}</div>
            </div>)}
          </div>}
        </section>

        <section className="tablero-panel" aria-labelledby="tablero-operaciones-titulo">
          <button type="button" onClick={() => setSectionOperaciones(p => !p)} className="tablero-encabezado tablero-desplegar"
            aria-expanded={sectionOperaciones} aria-controls="tablero-operaciones">
            <span id="tablero-operaciones-titulo" style={{ fontFamily: 'var(--font-mid)' }}><Wallet size={18}/>Operaciones Financieras</span>
            <ChevronDown size={18} aria-hidden="true" className={sectionOperaciones ? 'tablero-flecha-abierta' : ''}/>
          </button>
          <AnimatePresence initial={false}>
            {sectionOperaciones && <motion.div id="tablero-operaciones" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}
              exit={{height:0,opacity:0}} transition={{duration:.25,ease:'easeInOut'}} className="tablero-bloque-animado">
              <div className="tablero-operaciones-grid">
                <AccesoDashboardFinanciero horizontal titulo="Plan de Pagos" icono={<FileText size={28}/>}
                  descripcion="Visualiza y edita el plan detallado por alumno para el ciclo en curso."
                  onClick={() => navigate('/plan-pagos')}/>
                <AccesoDashboardFinanciero horizontal titulo={currentUser.rol === 'CAJERO' ? 'Registrar Cobro' : 'Control de Ingresos'} icono={<Wallet size={28}/>}
                  descripcion={currentUser.rol === 'CAJERO' ? 'Registra cobros y emite comprobantes adicionales.' : 'Registra cobros, emite comprobantes y consulta el historial de pagos.'}
                  onClick={() => navigate('/control-ingresos')}/>
              </div>
            </motion.div>}
          </AnimatePresence>
        </section>

        <section className="tablero-panel" aria-labelledby="tablero-reportes-titulo">
          <button type="button" onClick={() => setSectionReportes(p => !p)} className="tablero-encabezado tablero-desplegar"
            aria-expanded={sectionReportes} aria-controls="tablero-reportes">
            <span id="tablero-reportes-titulo" style={{ fontFamily: 'var(--font-mid)' }}><BarChart3 size={18}/>Consultas y Reportes</span>
            <ChevronDown size={18} aria-hidden="true" className={sectionReportes ? 'tablero-flecha-abierta' : ''}/>
          </button>
          <AnimatePresence initial={false}>
            {sectionReportes && <motion.div id="tablero-reportes" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}
              exit={{height:0,opacity:0}} transition={{duration:.25,ease:'easeInOut'}} className="tablero-bloque-animado">
              <div className="tablero-reportes-grid">
                <AccesoDashboardFinanciero titulo="Ficha del Alumno" icono={<User size={24}/>}
                  descripcion="Resumen compacto del estado financiero y becas." onClick={() => navigate('/ficha-alumno')}/>
                {currentUser.rol !== 'CAJERO' && <>
                  <AccesoDashboardFinanciero titulo="Estadísticas" icono={<BarChart3 size={24}/>}
                    descripcion="Análisis mensual de ingresos y deudas totales por ciclo." onClick={() => navigate('/estadisticas')}/>
                  <AccesoDashboardFinanciero titulo="Deudores" icono={<Users size={24}/>}
                    descripcion="Directorio de alumnos con pagos pendientes y retrasos." onClick={() => navigate('/deudores')}
                    insignia={totalDeudores > 0 ? <><AlertCircle size={10}/>{totalDeudores}</> : undefined}/>
                </>}
                {puedeAccederRuta(currentUser.rol,'/pagos-adeudos-alumnos') && <AccesoDashboardFinanciero titulo="Pagos y adeudos por alumno" icono={<FileText size={24}/>}
                  descripcion="Consulta por ciclo y filtros del padrón. Exporta CSV o imprime PDF." onClick={() => navigate('/pagos-adeudos-alumnos')}/>}
                {(currentUser.rol === 'ADMINISTRADOR' || currentUser.rol === 'COORDINADOR FINANCIERO') && <AccesoDashboardFinanciero titulo="Cobertura de planes de pago" icono={<FileCheck2 size={24}/>}
                  descripcion="Planes completos, alumnos sin plan y tipos por ciclo. Consulta y descarga PDF." onClick={() => navigate('/cobertura-planes-pago')}/>}
              </div>
            </motion.div>}
          </AnimatePresence>
        </section>

        <footer className="tablero-pie">
          <div className="tablero-marca">
            {appConfig?.logoUrl ? <img src={appConfig.logoUrl} alt="" className="h-5 w-auto grayscale"/>
              : <div className="w-5 h-5 bg-[#181e25] dark:bg-[#3b82f6] rounded-[4px] flex items-center justify-center text-white text-[10px] font-semibold">U</div>}
            <span>{appConfig?.title || 'Sistema de Control de Pagos'}</span>
          </div>
          <div className="tablero-pie-datos">
            <span className="tablero-pie-ciclo"><Calendar size={11} aria-hidden="true"/>Ciclo activo: <strong>{activeCiclo?.nombre || '—'}</strong></span>
            <span>v1.0.0 &nbsp;&middot;&nbsp; &copy; {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </motion.div>
  );
}
