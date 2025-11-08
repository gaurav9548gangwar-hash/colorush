
import { create } from 'zustand'

interface GameState {
  currentRoundId: string;
  isProcessing: boolean;
  gameResult: any | null;
  startNewRound: () => void;
  setProcessing: (isProcessing: boolean) => void;
  setGameResult: (result: any | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentRoundId: new Date().getTime().toString(),
  isProcessing: false,
  gameResult: null,
  startNewRound: () => set({ 
    isProcessing: false,
    gameResult: null,
    currentRoundId: new Date().getTime().toString()
  }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setGameResult: (result) => set({ gameResult: result }),
}))
