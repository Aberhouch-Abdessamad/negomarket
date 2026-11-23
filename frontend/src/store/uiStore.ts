import { create } from 'zustand'

interface UiState {
  mobileNavOpen: boolean
  toggleMobileNav: () => void
  closeMobileNav: () => void
}

/** Global UI state (navigation drawers, later: toasts, modals). */
export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
  closeMobileNav: () => set({ mobileNavOpen: false }),
}))
