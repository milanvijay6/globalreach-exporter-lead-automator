import { create } from 'zustand';
import { Importer } from '../types';

interface AppState {
  importers: Importer[];
  selectedId: string | null;
  setImporters: (importers: Importer[]) => void;
  setSelectedId: (id: string | null) => void;
  updateImporter: (id: string, updates: Partial<Importer>) => void;
  addImporter: (importer: Importer) => void;
  removeImporter: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  importers: [],
  selectedId: null,
  setImporters: (importers) => set({ importers }),
  setSelectedId: (selectedId) => set({ selectedId }),
  updateImporter: (id, updates) => set((state) => ({
    importers: state.importers.map(imp => 
      imp.id === id ? { ...imp, ...updates } : imp
    )
  })),
  addImporter: (importer) => set((state) => ({
    importers: [...state.importers, importer]
  })),
  removeImporter: (id) => set((state) => ({
    importers: state.importers.filter(imp => imp.id !== id)
  })),
}));






