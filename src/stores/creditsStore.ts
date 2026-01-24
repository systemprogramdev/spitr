import { create } from 'zustand'

interface CreditsState {
  balance: number
  setBalance: (balance: number) => void
  deduct: (amount?: number) => void
}

export const useCreditsStore = create<CreditsState>((set) => ({
  balance: 0,
  setBalance: (balance) => set({ balance }),
  deduct: (amount = 1) => set((state) => ({ balance: state.balance - amount })),
}))
