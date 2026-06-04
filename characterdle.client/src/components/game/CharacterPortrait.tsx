import { useEffect, useMemo, useState } from 'react';
import { getCharacterPortraitCandidates } from '../../lib/characterPortraits';
import type { UniverseCharacter } from '../../types/universeGame';

interface CharacterPortraitProps {
  character: Pick<UniverseCharacter, 'displayName' | 'portraitUrl'>;
  variant: 'guess' | 'history' | 'suggestion';
}

export function CharacterPortrait({ character, variant }: CharacterPortraitProps) {
  const portraitCandidates = useMemo(
    () => getCharacterPortraitCandidates(character),
    [character.displayName, character.portraitUrl],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [portraitCandidates]);

  const className = variant === 'suggestion'
    ? 'suggestion-avatar'
    : variant === 'history'
      ? 'history-avatar'
      : 'character-orb';
  const portraitUrl = portraitCandidates[candidateIndex] ?? null;

  if (portraitUrl) {
    return (
      <img
        className={className}
        src={portraitUrl}
        alt=""
        aria-hidden="true"
        onError={() => setCandidateIndex((currentIndex) => currentIndex + 1)}
      />
    );
  }

  return <span className={`${className} is-placeholder`} aria-hidden="true" />;
}
