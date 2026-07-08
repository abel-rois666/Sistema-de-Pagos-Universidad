import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ModalConfirmacionProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
  type?: 'danger' | 'warning' | 'info';
}

export default function ModalConfirmacion({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isAlert = false,
  type = 'warning'
}: ModalConfirmacionProps) {
  if (!isOpen) return null;

  const Icon = type === 'info' ? Info : AlertTriangle;
  
  const getIconColors = () => {
    switch (type) {
      case 'danger': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'info': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'warning': default: return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const getButtonColors = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700 text-white';
      case 'info': return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'warning': default: return 'bg-amber-600 hover:bg-amber-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-white dark:bg-[#1c2228] w-full max-w-md rounded-2xl shadow-xl overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${getIconColors()}`}>
              <Icon size={24} aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-headline">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  {message}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-[#181e25] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-800">
          {!isAlert && onConfirm && (
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${getButtonColors()} focus:ring-${type === 'warning' ? 'amber' : type}-500 dark:focus:ring-offset-[#181e25]`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          )}
          {isAlert && onConfirm && (
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm bg-[#1456f0] hover:bg-blue-700 text-white focus:ring-blue-500 dark:focus:ring-offset-[#181e25]`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          )}
          {!isAlert && (
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-[#181e25]"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
