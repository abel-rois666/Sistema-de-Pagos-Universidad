import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  formatLabel?: (v: string) => string;
}

export function MultiSelectFilter({ label, options, selected, onChange, formatLabel }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val));
    else onChange([...selected, val]);
  };

  const toggleAll = () => {
    if (selected.length === options.length) onChange([]);
    else onChange([...options]);
  };

  const isActive = selected.length > 0 && selected.length < options.length;
  const isAll = selected.length === 0 || selected.length === options.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-[8px] border text-sm font-medium transition-all whitespace-nowrap
          ${isActive
            ? 'bg-indigo-50 border-indigo-300 text-[#1456f0] dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300'
            : 'bg-white border-gray-300 text-[#45515e] hover:bg-[#f2f3f5] dark:bg-[#1c2228] dark:border-gray-600 dark:text-gray-200'}`}
      >
        <span>{label}</span>
        {isActive && (
          <span className="bg-[#1456f0] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
            {selected.length}
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full left-0 mt-1.5 bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] shadow-xl min-w-[180px] max-h-64 overflow-y-auto"
          >
            <button
              type="button"
              onClick={toggleAll}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] transition-colors
                ${isAll ? 'bg-indigo-50 text-[#1456f0] dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-[#8e8e93] dark:text-[#8e8e93] hover:bg-[#f2f3f5] dark:hover:bg-gray-700'}`}
            >
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                ${isAll ? 'bg-[#1456f0] border-indigo-600' : 'border-gray-300 dark:border-gray-500'}`}>
                {isAll && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              Todos
            </button>
            {options.map(opt => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                    ${isSel
                      ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200'
                      : 'text-[#45515e] dark:text-gray-300 hover:bg-[#f2f3f5] dark:hover:bg-gray-700'}`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                    ${isSel ? 'bg-[#1456f0] border-indigo-600' : 'border-gray-300 dark:border-gray-500'}`}>
                    {isSel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <span className="truncate text-left">{formatLabel ? formatLabel(opt) : opt}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
