import { createContext, useMemo, useState, type PropsWithChildren } from 'react';
import { defaultUniverseId, getUniverseById, universes } from '../data/universeCatalog';
import { getDefaultUniverseIdForLocation } from '../lib/siteRouting';
import type { Universe } from '../types/game';

interface UniverseContextValue {
  selectedUniverse: Universe;
  selectedUniverseId: string;
  setSelectedUniverseId: (universeId: string) => void;
  universes: Universe[];
}

export const UniverseContext = createContext<UniverseContextValue | null>(null);

export function UniverseProvider({ children }: PropsWithChildren) {
  const [selectedUniverseId, setSelectedUniverseIdState] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultUniverseId;
    }

    return getDefaultUniverseIdForLocation(window.location.hostname, window.location.pathname);
  });

  const selectedUniverse = getUniverseById(selectedUniverseId) ?? universes[0];

  const value = useMemo<UniverseContextValue>(() => ({
    selectedUniverse,
    selectedUniverseId: selectedUniverse.id,
    setSelectedUniverseId: (universeId: string) => {
      const universe = getUniverseById(universeId);

      if (universe?.isPlayable) {
        setSelectedUniverseIdState(universeId);
      }
    },
    universes,
  }), [selectedUniverse]);

  return (
    <UniverseContext.Provider value={value}>
      {children}
    </UniverseContext.Provider>
  );
}
