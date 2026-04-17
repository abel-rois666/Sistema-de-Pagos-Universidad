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
    <div className="relative min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden transition-colors duration-300 bg-white dark:bg-[#181e25]"
         style={{ fontFamily: 'var(--font-ui)' }}>

      {/* Background Decorators — conservamos blobs pero con tintes MiniMax blue */}
      <div className="absolute -left-40 top-1/4 w-96 h-96 bg-[#3b82f6]/10 dark:bg-[#3b82f6]/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -right-40 bottom-1/4 w-96 h-96 bg-[#1456f0]/10 dark:bg-[#1456f0]/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Main Content Container */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo / Ícono */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex justify-center mb-8 relative"
        >
          <div className="absolute inset-0 bg-[#1456f0]/15 dark:bg-[#3b82f6]/15 blur-xl rounded-full scale-110 animate-pulse pointer-events-none" />
          
          {logoUrl ? (
            <div className="animate-float relative z-10 flex items-center justify-center">
              <img 
                src={logoUrl}
                alt="Logo Universidad" 
                className="h-24 w-auto object-contain drop-shadow-xl"
              />
            </div>
          ) : (
            <div className="animate-float w-20 h-20 bg-[#181e25] dark:bg-[#1456f0] rounded-[20px] flex items-center justify-center shadow-[var(--shadow-brand)] relative z-10">
              <span className="text-white font-semibold text-4xl tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>U</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <h2 className="text-center text-[32px] font-semibold text-[#222222] dark:text-white tracking-tight leading-[1.10]"
              style={{ fontFamily: 'var(--font-display)' }}>
            Bienvenido al Sistema de Pagos
          </h2>
          <p className="mt-3 text-center text-base font-normal text-[#45515e] dark:text-[#8e8e93] max-w-sm mx-auto leading-[1.50]">
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
        <div className="glass-card py-8 px-4 sm:rounded-[24px] sm:px-10 transition-colors duration-300">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-[13px] font-semibold text-[#45515e] dark:text-[#8e8e93] uppercase tracking-wider mb-1.5">
                Nombre de Usuario
              </label>
              <div className="relative rounded-[8px]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                  <User size={17} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 sm:text-base rounded-[8px] bg-white dark:bg-[#181e25] py-3 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-[#222222] dark:text-gray-100 placeholder-[#8e8e93] outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all"
                  placeholder="usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-semibold text-[#45515e] dark:text-[#8e8e93] uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative rounded-[8px]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
                  <Lock size={17} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 sm:text-base rounded-[8px] bg-white dark:bg-[#181e25] py-3 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] text-[#222222] dark:text-gray-100 placeholder-[#8e8e93] outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-[8px] bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800/40">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-red-500 dark:text-red-400 shrink-0" size={17} />
                  <h3 className="text-sm font-medium text-red-700 dark:text-red-300">{error}</h3>
                </div>
              </motion.div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2.5 py-3 px-5 border border-transparent rounded-[8px] text-base font-medium text-white bg-[#181e25] hover:bg-[#222222] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3b82f6] dark:focus:ring-offset-[#181e25] transition-colors disabled:opacity-70 shadow-[var(--shadow-subtle)]"
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
