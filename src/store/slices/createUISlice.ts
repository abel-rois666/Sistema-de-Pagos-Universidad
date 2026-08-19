import { StateCreator } from 'zustand';
import { AppConfig } from '../../types';

export interface UISlice {
  loading: boolean;
  appConfig: AppConfig | null;
  setLoading: (loading: boolean) => void;
  setAppConfig: (config: AppConfig | null) => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  loading: false,
  appConfig: null,
  setLoading: (loading) => set({ loading }),
  setAppConfig: (config) => set({ appConfig: config }),
});
