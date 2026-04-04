import React, { useState } from 'react';
import { Lock, User, LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../types';

interface LoginProps {
  onLogin: (user: Usuario) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // El email interno nunca se muestra al usuario.
      // Es solo el identificador técnico para Supabase Auth.
      const email = `${username.trim().toLowerCase()}@cuom.sistema`;

      // Supabase verifica la contraseña en el servidor — nunca llega al cliente.
      // authData.user.id contiene el UUID del usuario autenticado — lo usamos directamente.
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }

      console.log('✅ Login exitoso. Auth ID:', authData.user.id);

      // Obtener el perfil vinculado usando el UUID del usuario autenticado.
      // Usamos authData.user.id directamente (evita una segunda llamada a getUser() que puede fallar).
      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('id, username, rol, preferencia_tema, ultimo_ciclo_id')
        .eq('auth_id', authData.user.id)
        .maybeSingle();

      console.log('🔍 Resultado de buscar perfil:', { perfil, perfilError });

      if (perfilError || !perfil) {
        setError('Usuario autenticado pero sin perfil en el sistema. Contacta al administrador.');
        await supabase.auth.signOut();
        return;
      }

      onLogin(perfil as Usuario);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Bienvenido al Sistema de Pagos CUOM
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Inicia sesión para gestionar alumnos y pagos
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Nombre de Usuario
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl bg-gray-50 py-3 border outline-none transition-colors"
                  placeholder="admin o coordinador"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl bg-gray-50 py-3 border outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-100">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
