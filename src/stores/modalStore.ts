import { create } from 'zustand'

interface ModalState {
  isSpitModalOpen: boolean
  replyToId: string | null
  replyToHandle: string | null
  openSpitModal: (replyTo?: { id: string; handle: string }) => void
  closeSpitModal: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  isSpitModalOpen: false,
  replyToId: null,
  replyToHandle: null,
  openSpitModal: (replyTo) =>
    set({
      isSpitModalOpen: true,
      replyToId: replyTo?.id || null,
      replyToHandle: replyTo?.handle || null,
    }),
  closeSpitModal: () =>
    set({
      isSpitModalOpen: false,
      replyToId: null,
      replyToHandle: null,
    }),
}))
