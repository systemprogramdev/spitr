import { create } from 'zustand'
import { ItemType } from '@/types'

interface InventoryItem {
  item_type: ItemType
  quantity: number
}

interface InventoryState {
  items: InventoryItem[]
  setItems: (items: InventoryItem[]) => void
  deductItem: (itemType: ItemType) => void
  addItem: (itemType: ItemType, qty?: number) => void
  getQuantity: (itemType: ItemType) => number
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  setItems: (items) => set({ items }),
  deductItem: (itemType) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.item_type === itemType ? { ...i, quantity: i.quantity - 1 } : i
      ),
    })),
  addItem: (itemType, qty = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.item_type === itemType)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.item_type === itemType ? { ...i, quantity: i.quantity + qty } : i
          ),
        }
      }
      return { items: [...state.items, { item_type: itemType, quantity: qty }] }
    }),
  getQuantity: (itemType) => {
    const item = get().items.find((i) => i.item_type === itemType)
    return item?.quantity || 0
  },
}))
