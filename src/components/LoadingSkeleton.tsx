import React from 'react';
import { Loader2 } from 'lucide-react';

interface SkeletonProps {
  type?: 'full' | 'table' | 'cards' | 'list';
  text?: string;
}

export default function LoadingSkeleton({ type = 'full', text = 'Cargando datos...' }: SkeletonProps) {
  if (type === 'full') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 w-full transition-colors duration-300">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header Skeleton */}
          <div className="w-full bg-white dark:bg-gray-900 h-20 sm:h-24 rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-pulse">
             <div className="flex items-center gap-4 w-full sm:w-auto">
               <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-800 rounded-xl shrink-0"></div>
               <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-800 w-48 sm:w-64 rounded-lg"></div>
             </div>
             <div className="hidden md:flex items-center gap-4">
               <div className="w-32 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
               <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
             </div>
          </div>

          {/* Saludo y Stats Skeleton */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm animate-pulse">
             <div className="h-8 bg-gray-200 dark:bg-gray-800 w-1/2 sm:w-1/3 rounded-lg mb-2"></div>
             <div className="h-4 bg-gray-200 dark:bg-gray-800 w-1/3 sm:w-1/4 rounded mb-6"></div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800/50 h-28 sm:h-32 rounded-xl p-4 flex flex-col gap-2 border border-gray-100 dark:border-gray-800">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
                    <div className="mt-auto">
                      <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-1.5"></div>
                      <div className="h-2.5 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Secciones Inferiores Skeleton */}
          <div className="w-full bg-white dark:bg-gray-900 h-20 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 sm:p-6 flex items-center justify-between animate-pulse">
             <div className="flex items-center gap-3 w-full">
               <div className="w-5 h-5 bg-gray-200 dark:bg-gray-800 rounded"></div>
               <div className="h-5 bg-gray-200 dark:bg-gray-800 w-48 rounded-md"></div>
             </div>
             <div className="w-5 h-5 bg-gray-200 dark:bg-gray-800 rounded shrink-0"></div>
          </div>
          
          <div className="w-full bg-white dark:bg-gray-900 h-20 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 sm:p-6 flex items-center justify-between animate-pulse">
             <div className="flex items-center gap-3 w-full">
               <div className="w-5 h-5 bg-gray-200 dark:bg-gray-800 rounded"></div>
               <div className="h-5 bg-gray-200 dark:bg-gray-800 w-48 rounded-md"></div>
             </div>
             <div className="w-5 h-5 bg-gray-200 dark:bg-gray-800 rounded shrink-0"></div>
          </div>

        </div>

        {/* Loader flotante inferior minimalista */}
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 z-50">
            <div className="relative flex justify-center items-center">
               <div className="absolute inset-0 bg-indigo-500 rounded-full blur animate-ping opacity-20"></div>
               <Loader2 size={24} className="animate-spin text-indigo-600 dark:text-indigo-400 relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-gray-800 dark:text-gray-200 tracking-tight">{text}</span>
              <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-widest leading-none mt-0.5">Sincronizando BD</span>
            </div>
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-6 animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded w-1/3"></div>
              <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded w-1/4"></div>
              <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded w-1/4"></div>
              <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 w-full">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-gray-900 h-36 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 animate-pulse flex flex-col justify-between">
            <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-4"></div>
            <div className="h-10 bg-gray-100 dark:bg-gray-800/60 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800/60 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="flex flex-col gap-3 p-4 w-full">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex gap-4 items-center p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 animate-pulse shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0"></div>
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
              <div className="h-3 bg-gray-100 dark:bg-gray-800/60 rounded w-1/4"></div>
            </div>
            <div className="w-20 h-8 bg-gray-100 dark:bg-gray-800/60 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
