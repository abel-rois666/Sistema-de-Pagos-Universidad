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
    rol: 'COORDINADOR' as 'ADMINISTRADOR' | 'COORDINADOR',
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
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // ── Abrir modales ─────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingUser(null);
    setFormData({ username: '', password: '', rol: 'COORDINADOR' });
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
    setFormData({ username: '', password: '', rol: 'COORDINADOR' });
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white rounded-full transition-colors text-gray-600 hover:text-gray-900 hover:shadow-sm"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                <Shield className="text-amber-500" />
                Gestión de Usuarios
              </h1>
              <p className="text-gray-500 mt-1">Administra los accesos y roles del sistema</p>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Plus size={20} />
            Nuevo Usuario
          </button>
        </div>

        {/* Barra de filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
            <Search className="text-gray-400 shrink-0" size={20} />
            <input
              type="text"
              placeholder="Buscar usuario..."
              className="w-full text-gray-700 outline-none bg-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(['active', 'inactive', 'all'] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f === 'active' ? 'Activos' : f === 'inactive' ? 'Inactivos' : 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de usuarios */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <LoadingSkeleton type="list" text="Cargando usuarios..." />
          ) : filteredUsuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Shield size={48} className="mb-4 text-gray-300" />
              <p className="text-lg">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-xs font-bold text-gray-500 tracking-wider">
                    <th className="p-4 pl-6">Usuario</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsuarios.map(u => (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50/50 transition-colors ${u.activo === false ? 'opacity-60' : ''}`}
                    >
                      {/* Username */}
                      <td className="p-4 pl-6 font-semibold text-gray-800">
                        {u.username}
                        {u.id === currentUser.id && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                            Tú
                          </span>
                        )}
                      </td>

                      {/* Rol */}
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.rol === 'ADMINISTRADOR'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {u.rol}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.activo === false
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {u.activo === false
                            ? <><UserX size={11} />Inactivo</>
                            : <><UserCheck size={11} />Activo</>
                          }
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="p-4 pr-6">
                        {confirmDeactivateId === u.id ? (
                          /* Confirmación inline */
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-red-700 font-medium">¿Desactivar?</span>
                            <button
                              onClick={() => handleDeactivate(u)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeactivateId(null)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : u.activo === false ? (
                          /* Usuario inactivo: solo botón reactivar */
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleReactivate(u)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-semibold transition-colors"
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
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar rol"
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              onClick={() => handleOpenPassword(u)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Cambiar contraseña"
                            >
                              <KeyRound size={17} />
                            </button>
                            <button
                              onClick={() => u.id !== currentUser.id && setConfirmDeactivateId(u.id)}
                              disabled={u.id === currentUser.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header modal */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                <Shield className="text-indigo-600" />
                {formMode === 'create' ? 'Nuevo Usuario'
                  : formMode === 'edit' ? 'Editar Rol'
                  : 'Cambiar Contraseña'}
              </h3>
              {formMode !== 'create' && (
                <p className="text-sm text-gray-500 mt-1 font-mono">{editingUser?.username}</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">

              {/* Error */}
              {errorInput && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 font-medium">
                  {errorInput}
                </div>
              )}

              {/* Username — solo en creación */}
              {formMode === 'create' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Nombre de Usuario
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. carlos_recepcion"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow bg-gray-50 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Solo minúsculas y guiones bajos. El email interno será <span className="font-mono">{formData.username || 'usuario'}@cuom.sistema</span>
                  </p>
                </div>
              )}

              {/* Rol — en creación y edición de rol */}
              {(formMode === 'create' || formMode === 'edit') && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as 'ADMINISTRADOR' | 'COORDINADOR' })}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm font-semibold text-gray-700"
                  >
                    <option value="COORDINADOR">Coordinador — Acceso Limitado</option>
                    <option value="ADMINISTRADOR">Administrador — Acceso Total</option>
                  </select>
                </div>
              )}

              {/* Contraseña — en creación y cambio de contraseña */}
              {(formMode === 'create' || formMode === 'password') && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {formMode === 'create' ? 'Contraseña' : 'Nueva Contraseña'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow bg-gray-50 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres.</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all text-sm shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
