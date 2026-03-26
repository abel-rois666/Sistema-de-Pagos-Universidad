import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

interface Props {
  initialTheme?: string;
  onChange?: (isDark: boolean) => void;
}

export default function DarkModeToggle({ initialTheme, onChange }: Props) {
  const [isDark, setIsDark] = useState(() => {
    if (initialTheme) return initialTheme === 'dark';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (initialTheme && initialTheme !== (isDark ? 'dark' : 'light')) {
      setIsDark(initialTheme === 'dark');
    }
  }, [initialTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => {
        const newVal = !isDark;
        setIsDark(newVal);
        if (onChange) onChange(newVal);
      }}
      className="relative w-[64px] h-[32px] rounded-full bg-[#dcdbe4] border border-[#d0cbdc] dark:bg-gray-700 dark:border-gray-600 transition-colors shadow-inner flex items-center px-1 shrink-0"
      aria-label="Alternar Modo Oscuro"
    >
      <div className="absolute w-full left-0 px-2.5 flex justify-between items-center pointer-events-none">
        <Moon size={14} className="text-[#3d2793] dark:text-gray-400" />
        <Sun size={15} className="text-amber-500" />
      </div>

      <div 
        className={`w-6 h-6 bg-white dark:bg-gray-800 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.15)] dark:shadow-black/40 transition-transform duration-300 flex items-center justify-center z-10 ${
          isDark ? 'translate-x-[30px]' : 'translate-x-0'
        }`}
      >
         {isDark ? <Sun size={13} className="text-amber-500" /> : <Moon size={13} className="text-[#3d2793]" />}
      </div>
    </button>
  );
}
