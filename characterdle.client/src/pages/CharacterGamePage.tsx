import { CharacterGuessRow } from '../components/game/CharacterGuessRow';
import { PrototypeControls } from '../components/game/PrototypeControls';
import { characterGuesses } from '../data/prototypeData';
import type { NavigateToPage } from '../types/routes';

interface CharacterGamePageProps {
  onNavigate: NavigateToPage;
}

export function CharacterGamePage({ onNavigate }: CharacterGamePageProps) {
  return (
    <main className="page centered-page">
      <section className="game-hero">
        <p className="eyebrow">Universe: ASOIAF</p>
        <h1>Daily Character Game</h1>
        <p>Guess the hidden character using the available attribute clues.</p>
      </section>

      <label className="search-box">
        <span>Search</span>
        <input type="text" placeholder="Type a character name..." />
      </label>

      <section className="guess-table" aria-label="Character guesses">
        <div className="guess-header">
          <span>Character</span>
          <span>House</span>
          <span>Culture</span>
          <span>Region</span>
          <span>Allegiance</span>
          <span>First book</span>
        </div>
        {characterGuesses.map((guess) => (
          <CharacterGuessRow key={guess.name} guess={guess} />
        ))}
      </section>

      <PrototypeControls
        onBeatCharacterGame={() => onNavigate('quote')}
        onTestVictory={() => onNavigate('stats')}
      />
    </main>
  );
}
