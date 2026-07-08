import React, { useState, useEffect } from 'react';
import { X, Users, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Grupo, DocenteGrupoAsignatura, AlumnoGrupo } from '../../types';
import ModalGestionarMateriasGrupo from './ModalGestionarMateriasGrupo';
import ModalGestionarAlumnosGrupo from './ModalGestionarAlumnosGrupo';

interface ModalDetallesGrupoProps {
  isOpen: boolean;
  onClose: () => void;
  grupo: Grupo | null;
}

export default function ModalDetallesGrupo({ isOpen, onClose, grupo }: ModalDetallesGrupoProps) {
  const [activeTab, setActiveTab] = useState<'materias' | 'alumnos'>('materias');
  const [docentesAsignaturas, setDocentesAsignaturas] = useState<DocenteGrupoAsignatura[]>([]);
  const [alumnosGrupo, setAlumnosGrupo] = useState<AlumnoGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [isManagingAlumnos, setIsManagingAlumnos] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'clave_asignatura', direction: 'asc' });

  useEffect(() => {
    if (isOpen && grupo) {
      fetchData();
    }
  }, [isOpen, grupo?.id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'materias') {
        const { data, error } = await supabase
          .from('docentes_grupos_asignaturas')
          .select('*, docentes(nombre_completo, clave_legado), asignaturas(nombre, clave_legado)')
          .eq('grupo_id', grupo!.id);

        if (error) throw error;
        setDocentesAsignaturas(data as unknown as DocenteGrupoAsignatura[]);
      } else {
        const { data, error } = await supabase
          .from('alumnos_grupos')
          .select('*, alumnos(matricula, nombre_completo, estatus)')
          .eq('grupo_id', grupo!.id);

        if (error) throw error;
        
        // Remove duplicates by student ID to avoid showing the same student multiple times
        // because alumnos_grupos is per subject, so a student taking 5 subjects in the group appears 5 times.
        const uniqueStudentsMap = new Map();
        (data || []).forEach((row: any) => {
           if (!uniqueStudentsMap.has(row.alumno_id)) {
               uniqueStudentsMap.set(row.alumno_id, row);
           }
        });
        
        setAlumnosGrupo(Array.from(uniqueStudentsMap.values()) as unknown as AlumnoGrupo[]);
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'materias' | 'alumnos') => {
    setActiveTab(tab);
    if (tab === 'materias') {
      setSortConfig({ key: 'clave_asignatura', direction: 'asc' });
    } else {
      setSortConfig({ key: 'nombre_completo', direction: 'asc' });
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedMaterias = React.useMemo(() => {
    let sortable = [...docentesAsignaturas];
    sortable.sort((a: any, b: any) => {
      let valA: any = '';
      let valB: any = '';
      if (sortConfig.key === 'clave_asignatura') {
        valA = a.asignaturas?.clave_legado || '';
        valB = b.asignaturas?.clave_legado || '';
      } else if (sortConfig.key === 'materia') {
        valA = a.asignaturas?.nombre || '';
        valB = b.asignaturas?.nombre || '';
      } else if (sortConfig.key === 'profesor') {
        valA = a.docentes?.nombre_completo || '';
        valB = b.docentes?.nombre_completo || '';
      } else if (sortConfig.key === 'clave_profesor') {
        valA = a.docentes?.clave_legado || '';
        valB = b.docentes?.clave_legado || '';
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortable;
  }, [docentesAsignaturas, sortConfig]);

  const sortedAlumnos = React.useMemo(() => {
    let sortable = [...alumnosGrupo];
    sortable.sort((a: any, b: any) => {
      let valA: any = '';
      let valB: any = '';
      if (sortConfig.key === 'matricula') {
        valA = a.alumnos?.matricula || '';
        valB = b.alumnos?.matricula || '';
      } else if (sortConfig.key === 'nombre_completo') {
        valA = a.alumnos?.nombre_completo || '';
        valB = b.alumnos?.nombre_completo || '';
      } else if (sortConfig.key === 'estatus') {
        valA = a.alumnos?.estatus || '';
        valB = b.alumnos?.estatus || '';
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortable;
  }, [alumnosGrupo, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-[#1456f0]" /> : <ChevronDown size={14} className="text-[#1456f0]" />;
  };

  const ThSortable = ({ label, columnKey, className = "" }: { label: string, columnKey: string, className?: string }) => (
    <th 
      className={`px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a3038] transition-colors group select-none ${className}`}
      onClick={() => handleSort(columnKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon columnKey={columnKey} />
      </div>
    </th>
  );

  if (!isOpen || !grupo) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <div>
            <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
              Detalles del Grupo: {grupo.codigo_grupo}
            </h2>
            <p className="text-sm text-[#45515e] dark:text-gray-400 mt-1">
              Ciclo: {grupo.ciclo?.nombre || 'N/A'} {grupo.ciclo?.tipo_periodo ? `(${grupo.ciclo.tipo_periodo})` : ''} | Plan: {grupo.plan?.nombre || 'N/A'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex justify-between items-center border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] px-6 pt-4">
          <div className="flex space-x-6">
            <button
              onClick={() => handleTabChange('materias')}
              className={`pb-3 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'materias' 
                  ? 'border-[#1456f0] text-[#1456f0] dark:border-blue-500 dark:text-blue-400' 
                  : 'border-transparent text-[#45515e] hover:text-[#222222] dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <BookOpen size={18} />
              Materias y Docentes
            </button>
            <button
              onClick={() => handleTabChange('alumnos')}
              className={`pb-3 flex items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'alumnos' 
                  ? 'border-[#1456f0] text-[#1456f0] dark:border-blue-500 dark:text-blue-400' 
                  : 'border-transparent text-[#45515e] hover:text-[#222222] dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Users size={18} />
              Alumnos Inscritos
            </button>
          </div>
          
          {activeTab === 'materias' && (
            <button 
              onClick={() => setIsManaging(true)} 
              className="mb-3 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Gestionar Materias / Docentes
            </button>
          )}
          {activeTab === 'alumnos' && (
            <button 
              onClick={() => setIsManagingAlumnos(true)} 
              className="mb-3 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Gestionar Alumnos
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <div className="border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 dark:bg-[#222830] text-[#45515e] dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-[rgba(255,255,255,0.08)]">
                <tr>
                  {activeTab === 'materias' ? (
                    <>
                      <ThSortable label="Clave Asignatura" columnKey="clave_asignatura" />
                      <ThSortable label="Materia" columnKey="materia" />
                      <ThSortable label="Profesor" columnKey="profesor" />
                      <ThSortable label="Clave Profesor" columnKey="clave_profesor" />
                    </>
                  ) : (
                    <>
                      <ThSortable label="Matrícula" columnKey="matricula" />
                      <ThSortable label="Nombre Completo" columnKey="nombre_completo" />
                      <ThSortable label="Estatus" columnKey="estatus" />
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[rgba(255,255,255,0.04)]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Cargando datos...
                    </td>
                  </tr>
                ) : activeTab === 'materias' && docentesAsignaturas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay materias ni docentes asignados a este grupo.
                    </td>
                  </tr>
                ) : activeTab === 'alumnos' && alumnosGrupo.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay alumnos inscritos en este grupo.
                    </td>
                  </tr>
                ) : activeTab === 'materias' ? (
                  sortedMaterias.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#222222] dark:text-gray-200">
                        {item.asignaturas?.clave_legado || '-'}
                      </td>
                      <td className="px-4 py-3 text-[#45515e] dark:text-gray-300">
                        {item.asignaturas?.nombre || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#222222] dark:text-gray-200">
                        {item.docente_id ? item.docentes?.nombre_completo || '-' : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                            ⚠️ Sin Docente Asignado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#45515e] dark:text-gray-400">
                        {item.docentes?.clave_legado || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedAlumnos.map((item) => (
                    <tr key={item.alumno_id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#222222] dark:text-gray-200">
                        {item.alumnos?.matricula || '-'}
                      </td>
                      <td className="px-4 py-3 text-[#45515e] dark:text-gray-300">
                        {item.alumnos?.nombre_completo || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                          {item.alumnos?.estatus || 'Activo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <ModalGestionarMateriasGrupo
        isOpen={isManaging}
        onClose={() => {
          setIsManaging(false);
          fetchData(); // reload immediately when it closes
        }}
        grupoId={grupo.id}
      />

      <ModalGestionarAlumnosGrupo
        isOpen={isManagingAlumnos}
        onClose={() => {
          setIsManagingAlumnos(false);
          fetchData();
        }}
        grupoId={grupo.id}
      />
    </div>
  );
}
