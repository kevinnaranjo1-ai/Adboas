import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MiniPlayerState {
  url: string;
  title: string;
}

interface MiniPlayerContextType {
  playerState: MiniPlayerState | null;
  isMinimized: boolean;
  startPlaying: (url: string, title: string) => void;
  closePlayer: () => void;
  toggleMinimize: () => void;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | undefined>(undefined);

export const MiniPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playerState, setPlayerState] = useState<MiniPlayerState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const startPlaying = (url: string, title: string) => {
    setPlayerState({ url, title });
    setIsMinimized(false);
  };

  const closePlayer = () => {
    setPlayerState(null);
  };

  const toggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  return (
    <MiniPlayerContext.Provider
      value={{
        playerState,
        isMinimized,
        startPlaying,
        closePlayer,
        toggleMinimize,
      }}
    >
      {children}
    </MiniPlayerContext.Provider>
  );
};

export const useMiniPlayer = () => {
  const context = useContext(MiniPlayerContext);
  if (!context) {
    throw new Error('useMiniPlayer must be used within a MiniPlayerProvider');
  }
  return context;
};
