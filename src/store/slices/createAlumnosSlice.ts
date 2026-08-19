import { StateCreator } from 'zustand';
import { Alumno } from '../../types';

export interface AlumnosSlice {
  alumnos: Alumno[];
  setAlumnos: (updater: Alumno[] | ((prev: Alumno[]) => Alumno[])) => void;
}

export const createAlumnosSlice: StateCreator<AlumnosSlice> = (set) => ({
  alumnos: [],
  setAlumnos: (updater) => set((state) => ({ 
    alumnos: typeof updater === 'function' ? updater(state.alumnos) : updater 
  })),
});
