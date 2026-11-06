import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal911({
  titulo,
  onClose,
  children
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement;
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const all = ref.current?.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex="0"]');
        if (!all?.length) return;
        const a = all[0],
          b = all[all.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      anterior?.focus();
    };
  }, [onClose]);
  return <div className="s911-modal" role="presentation"><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} className="s911-dialog"><header><h2>{titulo}</h2><button type="button" aria-label="Cerrar" onClick={onClose}><X size={21} /></button></header>{children}</div></div>;
}
