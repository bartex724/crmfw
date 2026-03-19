import { create } from 'zustand';

type ModuleKey = 'inventory' | 'events' | 'boxes';
type SortBy = 'name' | 'code' | 'quantity' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

type UiState = {
  activeModule: ModuleKey;
  search: string;
  categoryId: string;
  hideUnavailable: boolean;
  sortBy: SortBy;
  sortOrder: SortOrder;
  setActiveModule: (value: ModuleKey) => void;
  setSearch: (value: string) => void;
  setCategoryId: (value: string) => void;
  setHideUnavailable: (value: boolean) => void;
  setSortBy: (value: SortBy) => void;
  setSortOrder: (value: SortOrder) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeModule: 'inventory',
  search: '',
  categoryId: '',
  hideUnavailable: false,
  sortBy: 'name',
  sortOrder: 'asc',
  setActiveModule: (value) => set({ activeModule: value }),
  setSearch: (value) => set({ search: value }),
  setCategoryId: (value) => set({ categoryId: value }),
  setHideUnavailable: (value) => set({ hideUnavailable: value }),
  setSortBy: (value) => set({ sortBy: value }),
  setSortOrder: (value) => set({ sortOrder: value })
}));
