import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UnionState {
  activeUnionId: string | null;
  setActiveUnionId: (id: string) => void;
  clearActiveUnionId: () => void;
}

export const useUnionStore = create<UnionState>()(
  persist(
    (set) => ({
      activeUnionId: null,
      setActiveUnionId: (id) => set({ activeUnionId: id }),
      clearActiveUnionId: () => set({ activeUnionId: null }),
    }),
    { name: 'farmu-union' },
  ),
);
