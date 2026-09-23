// ═══════════════════════════════════════════════════════════════════════════
// React Hook for Real-Time Mobile Dashboard Data
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { firestoreLiveService, type MobileLiveState } from '../services/firestoreLiveService';

export function useMobileLive() {
  const [state, setState] = useState<MobileLiveState>(() => firestoreLiveService.getState());

  useEffect(() => {
    const unsubscribe = firestoreLiveService.subscribe((updatedState) => {
      setState(updatedState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    refresh: () => firestoreLiveService.loadFromLocalDexie(),
  };
}
