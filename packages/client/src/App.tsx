import React, { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Game } from './screens/Game';
import { GameOver } from './screens/GameOver';
import '@fontsource/noto-sans-bengali';

export const App: React.FC = () => {
  const { state, initSocket } = useGameStore();

  useEffect(() => {
    initSocket();
  }, [initSocket]);

  // Section 12: beforeunload warning during an active game
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state && state.phase !== 'lobby' && state.phase !== 'gameOver') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  if (!state) {
    return <Home />;
  }

  if (state.phase === 'lobby') {
    return <Lobby state={state} />;
  }

  if (state.phase === 'gameOver') {
    return <GameOver state={state} />;
  }

  return <Game state={state} />;
};

export default App;
