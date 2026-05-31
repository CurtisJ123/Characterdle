import { useEffect, useState } from 'react';
import { getCharacterPortraitUrl } from '../../lib/characterPortraits';
import type { UniverseCharacter } from '../../types/universeGame';

interface CharacterPortraitProps {
  character: Pick<UniverseCharacter, 'displayName' | 'portraitUrl'>;
  variant: 'guess' | 'suggestion';
}

export function CharacterPortrait({ character, variant }: CharacterPortraitProps) {
  const portraitUrl = getCharacterPortraitUrl(character);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [portraitUrl]);

  const className = variant === 'suggestion' ? 'suggestion-avatar' : 'character-orb';

  if (portraitUrl && !hasImageError) {
    return (
      <img
        className={className}
        src={portraitUrl}
        alt=""
        aria-hidden="true"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return <span className={`${className} is-placeholder`} aria-hidden="true" />;
}
