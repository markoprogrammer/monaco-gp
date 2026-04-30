import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStore {
  username: string | null;
  setUsername: (name: string) => void;
  clear: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      username: null,
      setUsername: (name) => set({ username: name.trim().slice(0, 20) }),
      clear: () => set({ username: null }),
    }),
    { name: "mgp:user" },
  ),
);

export function sanitizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 20);
}

export function isValidUsername(raw: string): boolean {
  const s = sanitizeUsername(raw);
  return s.length >= 2 && s.length <= 20;
}
