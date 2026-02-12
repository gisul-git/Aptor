import { create } from 'zustand';

/**
 * UI Store
 * 
 * Manages UI state (modals, toasts, sidebars, etc.)
 */

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface UIState {
  // Modals
  isModalOpen: boolean;
  modalContent: React.ReactNode | null;
  
  // Toasts
  toasts: Toast[];
  
  // Sidebar
  isSidebarOpen: boolean;
  
  // Actions
  openModal: (content: React.ReactNode) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isModalOpen: false,
  modalContent: null,
  toasts: [],
  isSidebarOpen: false,
  
  openModal: (content) => set({ 
    isModalOpen: true, 
    modalContent: content 
  }),
  closeModal: () => set({ 
    isModalOpen: false, 
    modalContent: null 
  }),
  addToast: (toast) => set((state) => ({
    toasts: [
      ...state.toasts,
      {
        ...toast,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        duration: toast.duration || 5000,
      },
    ],
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id),
  })),
  toggleSidebar: () => set((state) => ({ 
    isSidebarOpen: !state.isSidebarOpen 
  })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
}));




