'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { ItemType } from '@/types'

const supabase = createClient()

export function useInventory() {
  const { user } = useAuthStore()
  const { items, setItems, deductItem, addItem, getQuantity } = useInventoryStore()

  const refreshInventory = async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_inventory')
      .select('item_type, quantity')
      .eq('user_id', user.id)
    if (data) {
      setItems(data.map(d => ({ item_type: d.item_type as ItemType, quantity: d.quantity })))
    }
  }

  useEffect(() => {
    if (!user) return
    refreshInventory()
  }, [user])

  return {
    items,
    refreshInventory,
    getQuantity,
    deductItem,
    addItem,
  }
}
