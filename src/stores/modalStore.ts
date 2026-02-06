import { create } from 'zustand'
import { SpitWithAuthor } from '@/types'

interface ModalState {
  isSpitModalOpen: boolean
  replyToId: string | null
  replyToHandle: string | null
  quoteSpit: SpitWithAuthor | null
  openSpitModal: (replyTo?: { id: string; handle: string }) => void
  openQuoteModal: (spit: SpitWithAuthor) => void
  closeSpitModal: () => void
  // Chest modals
  isChestClaimModalOpen: boolean
  openChestClaimModal: () => void
  closeChestClaimModal: () => void
  isChestOpenModalOpen: boolean
  openingChestId: string | null
  openChestOpenModal: (chestId: string) => void
  closeChestOpenModal: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  isSpitModalOpen: false,
  replyToId: null,
  replyToHandle: null,
  quoteSpit: null,
  openSpitModal: (replyTo) =>
    set({
      isSpitModalOpen: true,
      replyToId: replyTo?.id || null,
      replyToHandle: replyTo?.handle || null,
      quoteSpit: null,
    }),
  openQuoteModal: (spit) =>
    set({
      isSpitModalOpen: true,
      replyToId: null,
      replyToHandle: null,
      quoteSpit: spit,
    }),
  closeSpitModal: () =>
    set({
      isSpitModalOpen: false,
      replyToId: null,
      replyToHandle: null,
      quoteSpit: null,
    }),
  // Chest modals
  isChestClaimModalOpen: false,
  openChestClaimModal: () => set({ isChestClaimModalOpen: true }),
  closeChestClaimModal: () => set({ isChestClaimModalOpen: false }),
  isChestOpenModalOpen: false,
  openingChestId: null,
  openChestOpenModal: (chestId: string) =>
    set({ isChestOpenModalOpen: true, openingChestId: chestId }),
  closeChestOpenModal: () =>
    set({ isChestOpenModalOpen: false, openingChestId: null }),
}))
