import { CharacterPortrait } from './CharacterPortrait';
import type { EpisodeLadderGame } from '../../types/episodeLadder';

export function EpisodeLadderPortrait({ event }: {
  event: Pick<EpisodeLadderGame['events'][number], 'characterName' | 'portraitUrl'>;
}) {
  return <span className="ladder-portrait">
    {event.characterName ?
      <CharacterPortrait character={{ displayName: event.characterName, portraitUrl: event.portraitUrl }} variant="history" /> :
      <svg className="history-avatar ladder-portrait-placeholder" viewBox="0 0 52 68" aria-hidden="true" focusable="false">
        <rect x=".5" y=".5" width="51" height="67" rx="6" fill="#1b1d1b" stroke="#c5a158" strokeOpacity=".35" />
        <path d="M19 25a7 7 0 0 1 14 0c0 6-7 6-7 12" fill="none" stroke="#c5a158" strokeWidth="3" strokeLinecap="round" />
        <circle cx="26" cy="45" r="1.8" fill="#c5a158" />
      </svg>}
  </span>;
}
