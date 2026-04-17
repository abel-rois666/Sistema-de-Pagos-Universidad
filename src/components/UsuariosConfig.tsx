import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Search, Edit2, Loader2, Shield,
  Eye, EyeOff, UserX, UserCheck, KeyRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../types';
import LoadingSkeleton from './LoadingSkeleton';

interface UsuariosConfigProps {
  currentUser: Usuario;
  onBack: () => void;
}

type FormMode = 'create' | 'edit' | 'password';
type FilterStatus = 'active' | 'inactive' | 'all';

export default function UsuariosConfig({ currentUser, onBack }: UsuariosConfigProps) {
  // ── Estado principal ───────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorInput, setErrorInput] = useState('');

  // ── Formulario ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rol: 'CAJERO' as 'ADMINISTRADOR' | 'COORDINADOR' | 'CAJERO',
  });

  // ── Confirmación desactivar (inline) ──────────────────────────────────────
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  useEffect(() => { fetchUsuarios(); }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, username, rol, preferencia_tema, ultimo_ciclo_id, auth_id, activo')
        .order('username');
      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Llamada a Edge Function ───────────────────────────────────────────────
  const invokeManageUsers = async (action: string, payload: Record<string, unknown>) => {
    // 1. Obtener la sesión activa para asegurar que enviamos el token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    // 2. Extraer parámetros del cliente para no tener hardcoded la URL base
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const functionUrl = `${supabaseUrl}/functions/v1/manage-users`;

    // 3. Invocar directamente mediante Fetch para atrapar perfectamente la respuesta 401/403/500
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey
      },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
      let errMessage = `Error HTTP: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errMessage = errorData.error;
        }
      } catch (e) {
        // No era JSON
      }
      throw new Error(`Edge Function falló (${response.status}): ${errMessage}`);
    }

    const data = await response.json();
    return data;
  };

  // ── Abrir modales ─────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingUser(null);
    setFormData({ username: '', password: '', rol: 'CAJERO' });
    setErrorInput('');
    setShowPassword(false);
    setShowModal(true);
  };

  const handleOpenEdit = (user: Usuario) => {
    setFormMode('edit');
    setEditingUser(user);
    setFormData({ username: user.username, password: '', rol: user.rol });
    setErrorInput('');
    setShowPassword(false);
    setShowModal(true);
  };

  const handleOpenPassword = (user: Usuario) => {
    setFormMode('password');
    setEditingUser(user);
    setFormData({ username: user.username, password: '', rol: user.rol });
    setErrorInput('');
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ username: '', password: '', rol: 'CAJERO' });
    setErrorInput('');
  };

  // ── Guardar (Crear / Editar rol / Cambiar contraseña) ─────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorInput('');

    try {
      if (formMode === 'create') {
        if (!formData.username.trim()) { setErrorInput('El nombre de usuario es obligatorio.'); return; }
        if (!formData.password) { setErrorInput('La contraseña es obligatoria.'); return; }
        if (formData.password.length < 8) { setErrorInput('La contraseña debe tener al menos 8 caracteres.'); return; }

        await invokeManageUsers('CREATE', {
          username: formData.username.trim(),
          password: formData.password,
          rol: formData.rol,
        });

      } else if (formMode === 'edit') {
        if (!editingUser?.auth_id) { setErrorInput('Este usuario no tiene sesión de Auth vinculada.'); return; }

        await invokeManageUsers('UPDATE', {
          authId: editingUser.auth_id,
          rol: formData.rol,
        });

      } else if (formMode === 'password') {
        if (!editingUser?.auth_id) { setErrorInput('Este usuario no tiene sesión de Auth vinculada.'); return; }
        if (!formData.password) { setErrorInput('Ingresa la nueva contraseña.'); return; }
        if (formData.password.length < 8) { setErrorInput('La contraseña debe tener al menos 8 caracteres.'); return; }

        await invokeManageUsers('UPDATE', {
          authId: editingUser.auth_id,
          password: formData.password,
        });
      }

      await fetchUsuarios();
      closeModal();
    } catch (error: any) {
      setErrorInput(error.message || 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Desactivar usuario (soft delete) ──────────────────────────────────────
  const handleDeactivate = async (user: Usuario) => {
    if (!user.auth_id) { alert('Este usuario no tiene sesión de Auth vinculada.'); return; }
    try {
      await invokeManageUsers('DEACTIVATE', { authId: user.auth_id });
      setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, activo: false } : u));
      setConfirmDeactivateId(null);
    } catch (error: any) {
      alert(error.message || 'Error al desactivar el usuario.');
    }
  };

  // ── Reactivar usuario ─────────────────────────────────────────────────────
  const handleReactivate = async (user: Usuario) => {
    if (!user.auth_id) { alert('Este usuario no tiene sesión de Auth vinculada.'); return; }
    try {
      await invokeManageUsers('REACTIVATE', { authId: user.auth_id });
      setUsuarios(prev => prev.map(u => u.id === user.id ? { ...u, activo: true } : u));
    } catch (error: any) {
      alert(error.message || 'Error al reactivar el usuario.');
    }
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filteredUsuarios = usuarios.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'active' ? u.activo !== false :
      u.activo === false;
    return matchSearch && matchStatus;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f2f3f5] dark:bg-gray-950 p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white dark:hover:bg-[#1c2228] rounded-full transition-colors text-[#45515e] dark:text-[#8e8e93] hover:text-gray-900 dark:hover:text-white hover:shadow-[var(--shadow-subtle)] shrink-0"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <Shield className="text-amber-500" size={28} />
                Gestión de Usuarios
              </h1>
              <p className="text-[#8e8e93] dark:text-[#8e8e93] mt-1 text-sm">Administra los accesos y roles del sistema</p>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1456f0] text-white hover:bg-[#1d4ed8] rounded-[13px] font-semibold transition-all shadow-[var(--shadow-subtle)] hover:shadow-md w-full sm:w-auto justify-center"
          >
            <Plus size={20} />
            Nuevo Usuario
          </button>
        </div>

        {/* Barra de filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-gray-800 flex items-center gap-3 transition-colors">
            <Search className="text-[#8e8e93] dark:text-[#8e8e93] shrink-0" size={20} />
            <input
              type="text"
              placeholder="Buscar usuario..."
              className="w-full text-[#45515e] dark:text-gray-200 outline-none bg-transparent placeholder-gray-400 dark:placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(['active', 'inactive', 'all'] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 sm:px-4 py-2 rounded-[13px] text-sm font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-none ${
                  filterStatus === f
                    ? 'bg-[#1456f0] text-white shadow-[var(--shadow-subtle)]'
                    : 'bg-white dark:bg-gray-900 text-[#45515e] dark:text-[#8e8e93] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] hover:bg-[#f2f3f5] dark:hover:bg-[#1c2228]'
                }`}
              >
                {f === 'active' ? 'Activos' : f === 'inactive' ? 'Inactivos' : 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de usuarios */}
        <div className="bg-white dark:bg-gray-900 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-gray-800 overflow-hidden transition-colors">
          {loading ? (
            <LoadingSkeleton type="list" text="Cargando usuarios..." />
          ) : filteredUsuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#8e8e93] dark:text-[#45515e]">
              <Shield size={48} className="mb-4 text-gray-300 dark:text-[#45515e]" />
              <p className="text-lg">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-[#f2f3f5] dark:border-gray-800 uppercase text-xs font-bold text-[#8e8e93] dark:text-[#8e8e93] tracking-wider">
                    <th className="p-4 pl-5">Usuario</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right pr-5">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsuarios.map(u => (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors ${u.activo === false ? 'opacity-60' : ''}`}
                    >
                      {/* Username */}
                      <td className="p-4 pl-5 font-semibold text-[#222222] dark:text-gray-100">
                        {u.username}
                        {u.id === currentUser.id && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#bfdbfe] dark:bg-indigo-900/50 text-[#1456f0] dark:text-indigo-300">
                            Tú
                          </span>
                        )}
                      </td>

                      {/* Rol */}
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.rol === 'ADMINISTRADOR'
                            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : u.rol === 'COORDINADOR'
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}>
                          {u.rol}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.activo === false
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                        }`}>
                          {u.activo === false
                            ? <><UserX size={11} />Inactivo</>
                            : <><UserCheck size={11} />Activo</>
                          }
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="p-4 pr-5">
                        {confirmDeactivateId === u.id ? (
                          /* Confirmación inline */
                          <div className="flex items-center gap-2 justify-end flex-wrap">
                            <span className="text-xs text-red-700 dark:text-red-400 font-medium whitespace-nowrap">¿Desactivar?</span>
                            <button
                              onClick={() => handleDeactivate(u)}
                              className="px-3 py-1 bg-red-600 text-white rounded-[8px] text-xs font-bold hover:bg-red-700 transition-colors"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeactivateId(null)}
                              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-[#45515e] dark:text-gray-300 rounded-[8px] text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : u.activo === false ? (
                          /* Usuario inactivo: solo botón reactivar */
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleReactivate(u)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-[8px] text-xs font-semibold transition-colors"
                              title="Reactivar usuario"
                            >
                              <UserCheck size={14} />
                              Reactivar
                            </button>
                          </div>
                        ) : (
                          /* Usuario activo: editar, contraseña, desactivar */
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-blue-900/30 rounded-[8px] transition-colors"
                              title="Editar rol"
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              onClick={() => handleOpenPassword(u)}
                              className="p-2 text-[#1456f0] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-[8px] transition-colors"
                              title="Cambiar contraseña"
                            >
                              <KeyRound size={17} />
                            </button>
                            <button
                              onClick={() => u.id !== currentUser.id && setConfirmDeactivateId(u.id)}
                              disabled={u.id === currentUser.id}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-[8px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={u.id === currentUser.id ? 'No puedes desactivar tu propia cuenta' : 'Desactivar usuario'}
                            >
                              <UserX size={17} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal CRUD ───────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-[var(--shadow-brand)] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] transition-colors">

            {/* Header modal */}
            <div className="p-6 border-b border-[#f2f3f5] dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#222222] dark:text-gray-100">
                <Shield className="text-[#1456f0] dark:text-indigo-400" />
                {formMode === 'create' ? 'Nuevo Usuario'
                  : formMode === 'edit' ? 'Editar Rol'
                  : 'Cambiar Contraseña'}
              </h3>
              {formMode !== 'create' && (
                <p className="text-sm text-[#8e8e93] dark:text-[#8e8e93] mt-1 font-mono">{editingUser?.username}</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">

              {/* Error */}
              {errorInput && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-[13px] text-sm border border-red-100 dark:border-red-900/60 font-medium">
                  {errorInput}
                </div>
              )}

              {/* Username — solo en creación */}
              {formMode === 'create' && (
                <div>
                  <label className="block text-sm font-bold text-[#45515e] dark:text-gray-300 mb-1">
                    Nombre de Usuario
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. carlos_recepcion"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    className="w-full p-3 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] outline-none focus:ring-2 focus:ring-[#3b82f6] transition-shadow bg-[#f2f3f5] dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <p className="text-xs text-[#8e8e93] dark:text-[#8e8e93] mt-1">
                    Solo minúsculas y guiones bajos. El email interno será <span className="font-mono">{formData.username || 'usuario'}@cuom.sistema</span>
                  </p>
                </div>
              )}

              {/* Rol — en creación y edición de rol */}
              {(formMode === 'create' || formMode === 'edit') && (
                <div>
                  <label className="block text-sm font-bold text-[#45515e] dark:text-gray-300 mb-1">Rol</label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as 'ADMINISTRADOR' | 'COORDINADOR' | 'CAJERO' })}
                    className="w-full p-3 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] outline-none bg-[#eef2ff] dark:bg-[#1c2228] text-[#45515e] dark:text-gray-200 focus:ring-2 focus:ring-[#3b82f6] cursor-pointer text-sm font-semibold"
                  >
                    <option value="CAJERO">Cajero — Solo crear/editar planes y cobrar</option>
                    <option value="COORDINADOR">Coordinador — Acceso Limitado</option>
                    <option value="ADMINISTRADOR">Administrador — Acceso Total</option>
                  </select>
                </div>
              )}

              {/* Contraseña — en creación y cambio de contraseña */}
              {(formMode === 'create' || formMode === 'password') && (
                <div>
                  <label className="block text-sm font-bold text-[#45515e] dark:text-gray-300 mb-1">
                    {formMode === 'create' ? 'Contraseña' : 'Nueva Contraseña'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-3 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] outline-none focus:ring-2 focus:ring-[#3b82f6] transition-shadow bg-[#f2f3f5] dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 pr-12 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8e8e93] dark:text-[#8e8e93] hover:text-[#45515e] dark:hover:text-gray-300 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-[#8e8e93] dark:text-[#8e8e93] mt-1">Mínimo 8 caracteres.</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-[#45515e] dark:text-gray-300 bg-gray-100 dark:bg-[#1c2228] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-[13px] font-semibold transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#1456f0] text-white hover:bg-[#1d4ed8] rounded-[13px] font-bold transition-all text-sm shadow-[var(--shadow-subtle)] flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
