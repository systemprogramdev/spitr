import { create } from 'zustand'
import { BankDeposit, UserStockHolding, LotteryTicket } from '@/types'

interface BankState {
  spitDeposits: BankDeposit[]
  goldDeposits: BankDeposit[]
  stockHolding: UserStockHolding | null
  unscratchedTickets: LotteryTicket[]
  loaded: boolean
  setSpitDeposits: (deposits: BankDeposit[]) => void
  setGoldDeposits: (deposits: BankDeposit[]) => void
  setStockHolding: (holding: UserStockHolding | null) => void
  setUnscratchedTickets: (tickets: LotteryTicket[]) => void
  setLoaded: (loaded: boolean) => void
}

export const useBankStore = create<BankState>((set) => ({
  spitDeposits: [],
  goldDeposits: [],
  stockHolding: null,
  unscratchedTickets: [],
  loaded: false,
  setSpitDeposits: (spitDeposits) => set({ spitDeposits }),
  setGoldDeposits: (goldDeposits) => set({ goldDeposits }),
  setStockHolding: (stockHolding) => set({ stockHolding }),
  setUnscratchedTickets: (unscratchedTickets) => set({ unscratchedTickets }),
  setLoaded: (loaded) => set({ loaded }),
}))
