import { create } from 'zustand';
import { currentMonth } from '../domain/dates';

/** Small UI-only store: which month the app is currently viewing. */
interface UiState {
  activeMonth: string; // 'YYYY-MM'
  setActiveMonth: (month: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeMonth: currentMonth(),
  setActiveMonth: (activeMonth) => set({ activeMonth }),
}));
