import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Docente } from '../types';
import ModalDocente from './modals/ModalDocente';
import { Plus, Edit2, Search, Trash2, ChevronUp, ChevronDown, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalConfirmacion, { ModalConfirmacionProps } from './ui/ModalConfirmacion';

export default function DocentesConfig() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocente, setSelectedDocente] = useState<Docente | null>(null);
  const [isModalDocenteOpen, setIsModalDocenteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [omitirInactivos, setOmitirInactivos] = useState(() => localStorage.getItem('docentes_omitir_inactivos') !== 'false');
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });

  useEffect(() => {
    fetchDocentes();
  }, []);

  useEffect(() => {
    localStorage.setItem('docentes_omitir_inactivos', String(omitirInactivos));
  }, [omitirInactivos]);

  const fetchDocentes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('docentes')
        .select('*')
        .order('nombre_completo', { ascending: true });

      if (error) {
        throw error;
      }

      setDocentes(data as unknown as Docente[]);
    } catch (error: any) {
      toast.error('Error al cargar los docentes: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEstatus = async (nuevoEstatus: 'activo' | 'inactivo') => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('docentes')
        .update({ estatus: nuevoEstatus })
        .in('id', selectedIds);
      if (error) throw error;
      toast.success(`Estatus actualizado para ${selectedIds.length} docentes`);
      setSelectedIds([]);
      fetchDocentes();
    } catch (error: any) {
      toast.error('Error al actualizar estatus: ' + error.message);
      setLoading(false);
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Docentes Múltiples',
      message: `¿Estás seguro de que deseas eliminar a ${selectedIds.length} docentes? Esta acción fallará si alguno de ellos ya tiene grupos asignados.`,
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          setLoading(true);
          const { error } = await supabase.from('docentes').delete().in('id', selectedIds);
          if (error) throw error;
          toast.success(`${selectedIds.length} docentes eliminados correctamente`);
          setSelectedIds([]);
          fetchDocentes();
        } catch (error: any) {
          toast.error('Error al eliminar docentes: ' + error.message);
          setLoading(false);
        }
      }
    });
  };

  const handleDeleteDocente = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Docente',
      message: '¿Estás seguro de que deseas eliminar a este docente? Esta acción no se puede deshacer.',
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase.from('docentes').delete().eq('id', id);
          if (error) throw error;
          toast.success('Docente eliminado correctamente');
          fetchDocentes();
        } catch (error: any) {
          toast.error('Error al eliminar docente: ' + error.message);
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

  const filteredAndSortedDocentes = React.useMemo(() => {
    let result = [...docentes];

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.nombre_completo?.toLowerCase().includes(lowerQuery) ||
        d.clave_legado?.toLowerCase().includes(lowerQuery) ||
        d.email?.toLowerCase().includes(lowerQuery) ||
        d.rfc?.toLowerCase().includes(lowerQuery) ||
        d.curp?.toLowerCase().includes(lowerQuery)
      );
    }

    if (omitirInactivos) {
      result = result.filter(d => (d.estatus?.toLowerCase() || 'inactivo') === 'activo');
    }

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
        const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [docentes, searchQuery, omitirInactivos, sortConfig]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredAndSortedDocentes.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />;
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-[#181e25] flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] dark:text-gray-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Gestión de Docentes
            </h1>
            <p className="text-sm text-[#45515e] dark:text-gray-400 mt-1">
              Administra el catálogo de profesores y su información general.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar docente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#222830] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[#222222] dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1456f0] focus:border-transparent transition-all"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#45515e] dark:text-gray-300 bg-white dark:bg-[#222830] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 transition-all hover:bg-gray-50 dark:hover:bg-[#2c333b]">
              <input 
                type="checkbox" 
                checked={omitirInactivos}
                onChange={(e) => setOmitirInactivos(e.target.checked)}
                className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0] focus:ring-2 bg-gray-50 dark:bg-[#181e25] dark:border-gray-600"
              />
              <span className="select-none">Omitir inactivos</span>
            </label>
            <button 
              onClick={() => {
                setSelectedDocente(null);
                setReadOnlyMode(false);
                setIsModalDocenteOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#1456f0] hover:bg-blue-700 rounded-lg transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={18} /> Nuevo Docente
            </button>
          </div>
        </div>



        {/* Tabla */}
        <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-[20px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 dark:bg-[#222830] text-[#45515e] dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-[rgba(255,255,255,0.08)] select-none">
                <tr>
                  <th className="px-4 py-4 w-10">
                    <input 
                      type="checkbox"
                      checked={filteredAndSortedDocentes.length > 0 && selectedIds.length === filteredAndSortedDocentes.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0] focus:ring-2 bg-gray-50 dark:bg-[#181e25] dark:border-gray-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2c333b] transition-colors" onClick={() => handleSort('clave_legado')}>
                    <div className="flex items-center gap-2">Clave <SortIcon columnKey="clave_legado" /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2c333b] transition-colors" onClick={() => handleSort('nombre_completo')}>
                    <div className="flex items-center gap-2">Nombre Completo <SortIcon columnKey="nombre_completo" /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2c333b] transition-colors" onClick={() => handleSort('rfc')}>
                    <div className="flex items-center gap-2">Identificadores <SortIcon columnKey="rfc" /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2c333b] transition-colors" onClick={() => handleSort('estatus')}>
                    <div className="flex items-center gap-2">Estatus <SortIcon columnKey="estatus" /></div>
                  </th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[rgba(255,255,255,0.04)]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Cargando docentes...
                    </td>
                  </tr>
                ) : filteredAndSortedDocentes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No hay docentes registrados o no se encontraron coincidencias.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedDocentes.map((docente) => (
                    <tr key={docente.id} className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group ${selectedIds.includes(docente.id) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(docente.id)}
                          onChange={() => handleSelectOne(docente.id)}
                          className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0] focus:ring-2 bg-gray-50 dark:bg-[#181e25] dark:border-gray-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#222222] dark:text-gray-100">
                        {docente.clave_legado}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#222222] dark:text-gray-200 font-medium">{docente.nombre_completo}</div>
                        <div className="text-xs text-[#8e8e93] mt-0.5">{docente.email || 'Sin correo'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#45515e] dark:text-gray-300">RFC: {docente.rfc || '-'}</div>
                        <div className="text-xs text-[#8e8e93] mt-0.5">CURP: {docente.curp || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {docente.estatus?.toLowerCase() === 'activo' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                            {docente.estatus || 'Inactivo'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setSelectedDocente(docente);
                            setReadOnlyMode(true);
                            setIsModalDocenteOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                          title="Ver Detalles"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedDocente(docente);
                            setReadOnlyMode(false);
                            setIsModalDocenteOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-[#1456f0] dark:hover:text-blue-400 transition-colors"
                          title="Editar Docente"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteDocente(docente.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar Docente"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ModalDocente
        isOpen={isModalDocenteOpen}
        onClose={() => {
          setIsModalDocenteOpen(false);
          setSelectedDocente(null);
        }}
        docente={selectedDocente}
        onDocenteSaved={fetchDocentes}
        readOnly={readOnlyMode}
      />
      <ModalConfirmacion {...confirmModal} />

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#181C25] border border-[rgba(255,255,255,0.08)] p-2 pr-4 rounded-[30px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 flex items-center gap-4 text-white font-sans">
          
          {/* Badge & Text */}
          <div className="flex items-center gap-3 pl-2">
            <div className="w-6 h-6 rounded-full bg-[#1456f0] flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_rgba(20,86,240,0.5)]">
              {selectedIds.length}
            </div>
            <span className="text-sm font-semibold">
              seleccionados
            </span>
          </div>

          <div className="w-px h-6 bg-[rgba(255,255,255,0.15)] mx-1"></div>

          {/* Actions */}
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

          {/* Close / Clear */}
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
