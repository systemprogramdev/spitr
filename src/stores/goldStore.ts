import { create } from 'zustand'

interface GoldState {
  balance: number
  setBalance: (balance: number) => void
  deduct: (amount: number) => void
  add: (amount: number) => void
}

export const useGoldStore = create<GoldState>((set) => ({
  balance: 0,
  setBalance: (balance) => set({ balance }),
  deduct: (amount) => set((state) => ({ balance: state.balance - amount })),
  add: (amount) => set((state) => ({ balance: state.balance + amount })),
}))
