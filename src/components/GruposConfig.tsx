import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Grupo } from '../types';
import ModalDetallesGrupo from './modals/ModalDetallesGrupo';
import ModalCrearGrupo from './modals/ModalCrearGrupo';
import ModalConfiguracionGrupo from './modals/ModalConfiguracionGrupo';
import ModalConfirmacion, { ModalConfirmacionProps } from './ui/ModalConfirmacion';
import { Plus, X, Trash2, ChevronUp, ChevronDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';

export default function GruposConfig() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [isModalDetallesOpen, setIsModalDetallesOpen] = useState(false);
  const [isModalCrearOpen, setIsModalCrearOpen] = useState(false);
  const [isModalConfiguracionOpen, setIsModalConfiguracionOpen] = useState(false);
  const [newlyCreatedGroupId, setNewlyCreatedGroupId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [licenciaturaFilter, setLicenciaturaFilter] = useState('');
  const [turnoFilter, setTurnoFilter] = useState('');
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
  const { activeCicloId } = useAppStore();

  useEffect(() => {
    if (activeCicloId) {
      fetchGrupos();
    }
  }, [activeCicloId]);

  const fetchGrupos = async () => {
    try {
      setLoading(true);
      
      // Obtenemos el nombre del ciclo activo para poder traer los grupos tanto Semestrales como Cuatrimestrales
      const { data: cicloActivo } = await supabase
        .from('ciclos_escolares')
        .select('nombre')
        .eq('id', activeCicloId)
        .single();
        
      if (!cicloActivo) {
        setGrupos([]);
        return;
      }

      const { data, error } = await supabase
        .from('grupos')
        .select('*, ciclo:ciclos_escolares!inner(*), plan:planes_estudio(*, carrera:carreras(nombre)), alumnos:alumnos_grupos(count)')
        .eq('ciclos_escolares.nombre', cicloActivo.nombre)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setGrupos(data as unknown as Grupo[]);
    } catch (error: any) {
      toast.error('Error al cargar los grupos: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteGrupo = async (id: string, codigo: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Grupo',
      message: `¿Estás seguro de que deseas eliminar el grupo ${codigo}? Esta acción eliminará las materias y alumnos vinculados al grupo y no se puede deshacer.`,
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          // Delete child rows first just in case there's no ON DELETE CASCADE
          await supabase.from('docentes_grupos_asignaturas').delete().eq('grupo_id', id);
          await supabase.from('alumnos_grupos').delete().eq('grupo_id', id);
          
          const { error } = await supabase.from('grupos').delete().eq('id', id);
          if (error) throw error;
          toast.success('Grupo eliminado exitosamente');
          fetchGrupos();
        } catch (error: any) {
          toast.error('Error al eliminar grupo: ' + error.message);
          console.error(error);
        }
      }
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(grupos.map(g => g.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkEstatus = async (nuevoEstatus: 'activo' | 'inactivo') => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('grupos')
        .update({ estatus: nuevoEstatus })
        .in('id', selectedIds);
      if (error) throw error;
      toast.success(`Estatus actualizado para ${selectedIds.length} grupos`);
      setSelectedIds([]);
      fetchGrupos();
    } catch (error: any) {
      toast.error('Error al actualizar estatus: ' + error.message);
      setLoading(false);
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Grupos Múltiples',
      message: `¿Estás seguro de que deseas eliminar ${selectedIds.length} grupos? Esta acción eliminará las materias y alumnos vinculados y no se puede deshacer.`,
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setLoading(true);
          await supabase.from('docentes_grupos_asignaturas').delete().in('grupo_id', selectedIds);
          await supabase.from('alumnos_grupos').delete().in('grupo_id', selectedIds);
          
          const { error } = await supabase.from('grupos').delete().in('id', selectedIds);
          if (error) throw error;
          toast.success(`${selectedIds.length} grupos eliminados correctamente`);
          setSelectedIds([]);
          fetchGrupos();
        } catch (error: any) {
          toast.error('Error al eliminar grupos: ' + error.message);
          setLoading(false);
        }
      }
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredGrupos = useMemo(() => {
    let result = [...grupos];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(g => 
        g.codigo_grupo?.toLowerCase().includes(term) ||
        g.plan?.nombre?.toLowerCase().includes(term) ||
        g.plan?.carrera?.nombre?.toLowerCase().includes(term)
      );
    }

    if (licenciaturaFilter) {
      result = result.filter(g => {
        const lic = g.plan?.carrera?.nombre || g.plan?.nombre || '';
        return lic === licenciaturaFilter;
      });
    }

    if (turnoFilter) {
      result = result.filter(g => g.turno === turnoFilter);
    }

    return result;
  }, [grupos, searchTerm, licenciaturaFilter, turnoFilter]);

  const sortedGrupos = useMemo(() => {
    let sortable = [...filteredGrupos];
    if (sortConfig !== null) {
      sortable.sort((a: any, b: any) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.key === 'codigo') {
          valA = a.codigo_grupo;
          valB = b.codigo_grupo;
        } else if (sortConfig.key === 'licenciatura') {
          valA = a.plan?.carrera?.nombre || a.plan?.nombre || '';
          valB = b.plan?.carrera?.nombre || b.plan?.nombre || '';
        } else if (sortConfig.key === 'ciclo') {
          valA = a.ciclo?.nombre || a.ciclo?.descripcion || '';
          valB = b.ciclo?.nombre || b.ciclo?.descripcion || '';
        } else if (sortConfig.key === 'grado_turno') {
          valA = `${a.grado} ${a.turno}`;
          valB = `${b.grado} ${b.turno}`;
        } else if (sortConfig.key === 'alumnos') {
          valA = a.alumnos?.[0]?.count || 0;
          valB = b.alumnos?.[0]?.count || 0;
        } else if (sortConfig.key === 'estatus') {
          valA = a.estatus || '';
          valB = b.estatus || '';
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredGrupos, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) {
      return <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-[#1456f0]" /> : <ChevronDown size={14} className="text-[#1456f0]" />;
  };

  const ThSortable = ({ label, columnKey, className = "" }: { label: string, columnKey: string, className?: string }) => (
    <th 
      className={`px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a3038] transition-colors group select-none ${className}`}
      onClick={() => handleSort(columnKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon columnKey={columnKey} />
      </div>
    </th>
  );

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-[#181e25] flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] dark:text-gray-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Gestión de Grupos
              </h1>
              <p className="text-sm text-[#45515e] dark:text-gray-400 mt-1">
                Administra los grupos y clases asignadas en los ciclos escolares.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsModalCrearOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-lg transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus size={18} /> Nuevo Grupo
              </button>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por código, plan o licenciatura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1456f0] transition-shadow text-sm"
              />
            </div>
            
            <div className="flex gap-4">
              <select
                value={licenciaturaFilter}
                onChange={(e) => setLicenciaturaFilter(e.target.value)}
                className="w-48 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1456f0] text-sm"
              >
                <option value="">Todas las licenciaturas</option>
                {Array.from(new Set(grupos.map((g: any) => g.plan?.carrera?.nombre || g.plan?.nombre || '').filter(Boolean))).map((lic: any) => (
                  <option key={lic} value={lic}>{lic}</option>
                ))}
              </select>

              <select
                value={turnoFilter}
                onChange={(e) => setTurnoFilter(e.target.value)}
                className="w-40 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1456f0] text-sm"
              >
                <option value="">Todos los turnos</option>
                {Array.from(new Set(grupos.map((g: any) => g.turno).filter(t => !!t && t !== 'undefined' && t !== 'null'))).map((t: any) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-[20px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 dark:bg-[#222830] text-[#45515e] dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-[rgba(255,255,255,0.08)]">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input 
                      type="checkbox"
                      checked={grupos.length > 0 && selectedIds.length === grupos.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0] focus:ring-2 bg-gray-50 dark:bg-[#181e25] dark:border-gray-600 cursor-pointer"
                    />
                  </th>
                  <ThSortable label="Código" columnKey="codigo" />
                  <ThSortable label="Licenciatura / Plan" columnKey="licenciatura" />
                  <ThSortable label="Ciclo" columnKey="ciclo" />
                  <ThSortable label="Grado / Turno" columnKey="grado_turno" />
                  <ThSortable label="Alumnos" columnKey="alumnos" />
                  <ThSortable label="Estatus" columnKey="estatus" />
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[rgba(255,255,255,0.04)]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Cargando grupos...
                    </td>
                  </tr>
                ) : grupos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay grupos registrados.
                    </td>
                  </tr>
                ) : (
                  sortedGrupos.map((grupo: any) => (
                    <tr key={grupo.id} className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group ${selectedIds.includes(grupo.id) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(grupo.id)}
                          onChange={() => handleSelectOne(grupo.id)}
                          className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0] focus:ring-2 bg-gray-50 dark:bg-[#181e25] dark:border-gray-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#222222] dark:text-gray-100">{grupo.codigo_grupo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#45515e] dark:text-gray-300 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={grupo.plan?.carrera?.nombre || grupo.plan?.nombre || 'Sin Plan'}>
                          {grupo.plan?.carrera?.nombre || grupo.plan?.nombre || 'Sin Plan'}
                        </div>
                        <div className="text-xs text-[#8e8e93] mt-0.5">{grupo.plan?.nombre || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-[#45515e] dark:text-gray-300">
                        {grupo.ciclo?.nombre || grupo.ciclo?.descripcion || (grupo.ciclo as any)?.periodo || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#45515e] dark:text-gray-300">{grupo.grado || '-'}</div>
                        <div className="text-xs text-[#8e8e93] mt-0.5">{grupo.turno || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-sm">
                          {grupo.alumnos?.[0]?.count || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {grupo.estatus?.toLowerCase() === 'activo' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                            {grupo.estatus || 'Inactivo'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => {
                              setSelectedGrupo(grupo);
                              setIsModalDetallesOpen(true);
                            }}
                            className="text-sm font-semibold text-[#1456f0] hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            Ver Detalles
                          </button>
                          <button 
                            onClick={() => handleDeleteGrupo(grupo.id, grupo.codigo_grupo)}
                            className="text-sm font-semibold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ModalDetallesGrupo
        isOpen={isModalDetallesOpen}
        onClose={() => {
          setIsModalDetallesOpen(false);
          setSelectedGrupo(null);
        }}
        grupo={selectedGrupo}
      />

      <ModalCrearGrupo
        isOpen={isModalCrearOpen}
        onClose={() => setIsModalCrearOpen(false)}
        onGrupoCreated={(grupoId) => {
          fetchGrupos();
          if (grupoId) {
            setNewlyCreatedGroupId(grupoId);
            setIsModalConfiguracionOpen(true);
          }
        }}
      />

      <ModalConfiguracionGrupo
        isOpen={isModalConfiguracionOpen}
        onClose={() => {
          setIsModalConfiguracionOpen(false);
          const wasNew = !!newlyCreatedGroupId;
          setNewlyCreatedGroupId(null);
          fetchGrupos();
          
          if (wasNew) {
            setConfirmModal({
              isOpen: true,
              title: '¡Grupo Configurado!',
              message: 'El grupo y sus alumnos iniciales han sido guardados. Recuerda que queda pendiente la asignación de docentes para cada materia. Para realizarlo, selecciona el grupo en la tabla y usa la opción "Gestionar Materias / Docentes".',
              type: 'info',
              isAlert: true,
              confirmText: 'Entendido',
              onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
              onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
            });
          }
        }}
        grupoId={newlyCreatedGroupId || ''}
        isNewGroup={true}
      />
      
      <ModalConfirmacion {...confirmModal} />

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#181C25] border border-[rgba(255,255,255,0.08)] p-2 pr-4 rounded-[30px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 flex items-center gap-4 text-white font-sans">
          
          <div className="flex items-center gap-3 pl-2">
            <div className="w-6 h-6 rounded-full bg-[#1456f0] flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_rgba(20,86,240,0.5)]">
              {selectedIds.length}
            </div>
            <span className="text-sm font-semibold">
              seleccionados
            </span>
          </div>

          <div className="w-px h-6 bg-[rgba(255,255,255,0.15)] mx-1"></div>

          <div className="flex items-center gap-2">
            <select
              className="bg-transparent border border-[rgba(255,255,255,0.1)] rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#1456f0] cursor-pointer"
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkEstatus(e.target.value as 'activo' | 'inactivo');
                  e.target.value = "";
                }
              }}
              defaultValue=""
            >
              <option value="" disabled className="bg-[#181c25]">Cambiar a...</option>
              <option value="activo" className="bg-[#181c25]">Activar</option>
              <option value="inactivo" className="bg-[#181c25]">Inactivar</option>
            </select>
            
            <div className="w-px h-6 bg-[rgba(255,255,255,0.15)] mx-2"></div>

            <button
              onClick={handleBulkDelete}
              className="px-4 py-1.5 text-sm font-semibold text-[#f87171] bg-[rgba(248,113,113,0.1)] hover:bg-[rgba(248,113,113,0.2)] rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>

          <div className="w-px h-6 bg-[rgba(255,255,255,0.15)] ml-2"></div>
          <button 
            onClick={() => setSelectedIds([])}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
