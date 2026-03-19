import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Trash2, Edit2, Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../types';
import bcrypt from 'bcryptjs';

interface UsuariosConfigProps {
  currentUser: Usuario;
  onBack: () => void;
}

export default function UsuariosConfig({ currentUser, onBack }: UsuariosConfigProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [errorInput, setErrorInput] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rol: 'COORDINADOR' as 'ADMINISTRADOR' | 'COORDINADOR'
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('username');
      
      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
      alert('Error al cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: Usuario) => {
    setErrorInput('');
    if (user) {
      setEditingUser(user);
      setFormData({ username: user.username, rol: user.rol, password: '' });
    } else {
      setEditingUser(null);
      setFormData({ username: '', rol: 'COORDINADOR', password: '' });
    }
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ username: '', rol: 'COORDINADOR', password: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorInput('');

      if (!formData.username.trim()) {
        setErrorInput('El nombre de usuario es obligatorio.');
        return;
      }

      // Validación de contraseña en creación
      if (!editingUser && !formData.password) {
        setErrorInput('La contraseña es obligatoria para nuevos usuarios.');
        return;
      }

      let hash = undefined;
      if (formData.password) {
        hash = await bcrypt.hash(formData.password, 12);
      }

      if (editingUser) {
        // ACTUALIZAR
        const payload: any = {
          username: formData.username.trim(),
          rol: formData.rol
        };
        if (hash) {
          payload.password = hash;
        }

        const { error } = await supabase
          .from('usuarios')
          .update(payload)
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        // CREAR
        const payload = {
          id: crypto.randomUUID(),
          username: formData.username.trim(),
          rol: formData.rol,
          password: hash!
        };

        const { error } = await supabase
          .from('usuarios')
          .insert([payload]);

        if (error) {
          if (error.code === '23505') {
            setErrorInput('Ese nombre de usuario ya existe.');
            return;
          }
          throw error;
        }
      }

      await fetchUsuarios();
      closeModal();
    } catch (error: any) {
      console.error('Error saving user:', error);
      setErrorInput('Ocurrió un error al guardar. Verifica la conexión o los datos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (id === currentUser.id) {
      alert('No puedes eliminar tu propia cuenta en sesión.');
      return;
    }
    
    if (window.confirm(`¿Estás seguro de eliminar permanentemente al usuario "${username}"?`)) {
      try {
        const { error } = await supabase
          .from('usuarios')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setUsuarios(prev => prev.filter(u => u.id !== id));
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error al eliminar el usuario.');
      }
    }
  };

  const filteredUsuarios = usuarios.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <p className="text-gray-500 mt-1">
                Administra los accesos y roles del sistema
              </p>
            </div>
          </div>
          
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Plus size={20} />
            Nuevo Usuario
          </button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar usuario..."
            className="w-full text-gray-700 outline-none bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 size={32} className="animate-spin text-indigo-500 mb-4" />
              <p>Cargando usuarios...</p>
            </div>
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
                    <th className="p-4 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsuarios.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6 font-semibold text-gray-800">
                        {u.username}
                        {u.id === currentUser.id && (
                          <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                            Tú
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.rol === 'ADMINISTRADOR'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4 pr-6 flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(u)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          disabled={u.id === currentUser.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                <Shield className="text-indigo-600" />
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
              
              {errorInput && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 font-medium">
                  {errorInput}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de Usuario</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    placeholder="ej. carlos_recepcion"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow bg-gray-50 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({...formData, rol: e.target.value as 'ADMINISTRADOR' | 'COORDINADOR'})}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm font-semibold text-gray-700"
                  >
                    <option value="COORDINADOR">Coordinador (Acceso Limitado)</option>
                    <option value="ADMINISTRADOR">Administrador (Acceso Total)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editingUser}
                      placeholder={editingUser ? "Solo si deseas cambiarla..." : "••••••••"}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow bg-gray-50 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {editingUser && (
                    <p className="text-xs text-gray-500 mt-1">
                      Déjalo en blanco si quieres conservar la misma contraseña.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-8">
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
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 rounded-xl font-bold transition-all text-sm shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}
                  {isSaving ? 'Guardando...' : 'Guardar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
