import { create } from 'zustand'
import { UserCreditCard, CreditCardTransaction } from '@/types'

interface CreditCardState {
  card: UserCreditCard | null
  transactions: CreditCardTransaction[]
  loaded: boolean
  setCard: (card: UserCreditCard | null) => void
  setTransactions: (txns: CreditCardTransaction[]) => void
  setLoaded: (loaded: boolean) => void
}

export const useCreditCardStore = create<CreditCardState>((set) => ({
  card: null,
  transactions: [],
  loaded: false,
  setCard: (card) => set({ card }),
  setTransactions: (transactions) => set({ transactions }),
  setLoaded: (loaded) => set({ loaded }),
}))
