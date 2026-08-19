import { StateCreator } from 'zustand';
import { CatalogoItem, Catalogos } from '../../types';

export const buildCatalogos = (items: CatalogoItem[]): Catalogos => ({
  conceptos: Array.from(new Set(items.filter(i => i.tipo === 'concepto' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  licenciaturas: Array.from(new Set(items.filter(i => i.tipo === 'licenciatura' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  beca_tipos: Array.from(new Set(items.filter(i => i.tipo === 'beca_tipo' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  beca_porcentajes: Array.from(new Set(items.filter(i => i.tipo === 'beca_porcentaje' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  grados: Array.from(new Set(items.filter(i => i.tipo === 'grado' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  turnos: Array.from(new Set(items.filter(i => i.tipo === 'turno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  estatus_alumnos: Array.from(new Set(items.filter(i => i.tipo === 'estatus_alumno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  empresas_ss: Array.from(new Set(items.filter(i => i.tipo === 'empresa_ss' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  modalidades_titulacion: Array.from(new Set(items.filter(i => i.tipo === 'modalidad_titulacion' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  licenciaturasMetadata: Object.fromEntries(
    items
      .filter(i => i.tipo === 'licenciatura' && i.activo && i.metadata)
      .map(i => [i.valor, i.metadata!])
  ),
});

export interface CatalogosSlice {
  catalogoItems: CatalogoItem[];
  catalogos: Catalogos;
  setCatalogoItems: (updater: CatalogoItem[] | ((prev: CatalogoItem[]) => CatalogoItem[])) => void;
}

export const createCatalogosSlice: StateCreator<CatalogosSlice> = (set) => ({
  catalogoItems: [],
  catalogos: buildCatalogos([]),
  setCatalogoItems: (updater) => set((state) => {
    const newItems = typeof updater === 'function' ? updater(state.catalogoItems) : updater;
    return { 
      catalogoItems: newItems, 
      catalogos: buildCatalogos(newItems) 
    };
  }),
});
