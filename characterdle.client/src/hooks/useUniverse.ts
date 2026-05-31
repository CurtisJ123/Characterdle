import { useContext } from 'react';
import { UniverseContext } from '../contexts/UniverseContext';

export function useUniverse() {
  const universeContext = useContext(UniverseContext);

  if (!universeContext) {
    throw new Error('useUniverse must be used within a UniverseProvider.');
  }

  return universeContext;
}
