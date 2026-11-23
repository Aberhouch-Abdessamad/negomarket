import { create } from 'zustand'
import { negotiationService } from './negotiationService'

interface NegotiationBadgeState {
  unread: number
  setUnread: (count: number) => void
  refresh: () => Promise<void>
  reset: () => void
}

/** Shared unread-message badge, refreshed by the header poll and after reads. */
export const useNegotiationBadgeStore = create<NegotiationBadgeState>((set) => ({
  unread: 0,
  setUnread: (unread) => set({ unread }),
  refresh: async () => {
    try {
      set({ unread: await negotiationService.unreadCount() })
    } catch {
      // A failed badge request must never interrupt browsing.
    }
  },
  reset: () => set({ unread: 0 }),
}))
