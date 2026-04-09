import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, User, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { supabase, getAppConfig } from '../lib/supabase';
import type { Usuario } from '../types';

interface LoginProps {
  onLogin: (user: Usuario) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getAppConfig().then(config => {
      if (config && config.logoUrl) {
        setLogoUrl(config.logoUrl);
      }
    });
  }, []);

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
    <div className="relative min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden transition-colors duration-300 bg-slate-50 dark:bg-slate-950">

      {/* Background Decorators */}
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-50 dark:opacity-20 z-0" />
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-indigo-100/50 dark:from-indigo-900/20 to-transparent pointer-events-none z-0" />
      <div className="absolute -left-40 top-1/4 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -right-40 bottom-1/4 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Main Content Container */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo / Ícono */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex justify-center mb-8 relative"
        >
          <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-400/20 blur-xl rounded-full scale-110 animate-pulse pointer-events-none" />
          
          {logoUrl ? (
            <div className="animate-float relative z-10 flex items-center justify-center">
              <img 
                src={logoUrl}
                alt="Logo Universidad" 
                className="h-24 w-auto object-contain drop-shadow-xl"
              />
            </div>
          ) : (
            <div className="animate-float w-20 h-20 bg-gradient-to-br from-indigo-700 to-blue-900 dark:from-indigo-600 dark:to-blue-800 rounded-2xl flex items-center justify-center shadow-2xl border border-indigo-400/30 relative z-10">
              <span className="text-white font-black text-4xl tracking-tighter">U</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            Bienvenido al Sistema de Pagos CUOM
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
            Inicia sesión para gestionar alumnos y pagos
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="glass-card py-8 px-4 sm:rounded-3xl sm:px-10 transition-colors duration-300">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre de Usuario
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
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
                  className="block w-full pl-10 sm:text-sm rounded-xl bg-gray-50 dark:bg-gray-800 py-3 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
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
                  className="block w-full pl-10 sm:text-sm rounded-xl bg-gray-50 dark:bg-gray-800 py-3 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl bg-rose-50 dark:bg-rose-900/30 p-4 border border-rose-200 dark:border-rose-800/50">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-rose-600 dark:text-rose-400 shrink-0" size={18} />
                  <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">{error}</h3>
                </div>
              </motion.div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors disabled:opacity-70"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
