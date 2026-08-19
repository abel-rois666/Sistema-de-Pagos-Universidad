import { StateCreator } from 'zustand';
import { Usuario } from '../../types';

export interface AuthSlice {
  currentUser: Usuario | null;
  authChecked: boolean;
  setCurrentUser: (user: Usuario | null) => void;
  setAuthChecked: (checked: boolean) => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  currentUser: null,
  authChecked: false,
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthChecked: (checked) => set({ authChecked: checked }),
});
