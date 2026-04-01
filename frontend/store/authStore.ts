import { create } from 'zustand';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: null,
  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
