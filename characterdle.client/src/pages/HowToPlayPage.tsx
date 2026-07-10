import './InformationalPage.css';
import type { NavigateToPage } from '../types/routes';

interface HowToPlayPageProps {
  onNavigate: NavigateToPage;
}

const faqItems = [
  {
    question: 'Do I need an account to play?',
    answer: 'No. You can play as a guest, but an account is required for saved stats, streak tracking, and leaderboard placement.',
  },
  {
    question: 'What happens when I use hints?',
    answer: 'Hints help you finish the board, but hinted rounds do not count toward ranked stats in the same way as a clean solve.',
  },
  {
    question: 'When do new daily games start?',
    answer: 'The daily character and quote boards roll over once per day. Archive boards stay available so older rounds can still be replayed later.',
  },
  {
    question: 'What is the difference between daily and random games?',
    answer: 'Daily games affect archives, stats, and streaks. Random premium practice games are pulled from the database for extra play and do not change daily progress.',
  },
];

export function HowToPlayPage({ onNavigate }: HowToPlayPageProps) {
  return (
    <main className="page informational-page">
      <section className="glass-card informational-hero">
        <div className="informational-hero-copy">
          <p className="eyebrow">How To Play</p>
          <h1>Learn the daily Characterdle loop.</h1>
          <p className="muted-copy">
            Characterdle has two daily Game of Thrones guessing games: one for characters and one for quotes.
            Both are built to be quick to start, readable on repeat visits, and deep enough to reward knowledge of the show.
          </p>
        </div>

        <div className="informational-hero-actions">
          <button className="primary-button informational-action-button" type="button" onClick={() => onNavigate('launcher')}>
            Start playing
          </button>
          <button className="secondary-button informational-action-button" type="button" onClick={() => onNavigate('support')}>
            Get support
          </button>
        </div>
      </section>

      <section className="informational-grid" aria-label="How to play Characterdle">
        <article className="glass-card informational-card">
          <p className="card-kicker">Character Game</p>
          <h2>Deduce the hidden character</h2>
          <ol className="informational-list">
            <li>Type a Game of Thrones name and submit it as a guess.</li>
            <li>Read the comparison row to see how your guess matches by gender, species, house, role, debut season, last season, and status.</li>
            <li>Use the season arrows to tell whether the hidden answer appears earlier or later than your guess.</li>
            <li>Keep narrowing the field until every attribute lines up and you identify the correct character.</li>
          </ol>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Quote Game</p>
          <h2>Name the speaker</h2>
          <ol className="informational-list">
            <li>Read the quote and guess which character said it in the show.</li>
            <li>If you get stuck, hints can reveal episode context, role information, and the first letter.</li>
            <li>The quote game is a separate daily board, so solving it adds to your profile and overall wins independently.</li>
          </ol>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Hints And Results</p>
          <h2>Know what counts</h2>
          <ul className="informational-list">
            <li>Hints are available in both game modes when you need help.</li>
            <li>Hinted rounds are still playable and still useful, but they are treated differently from clean ranked solves.</li>
            <li>After a win, Characterdle shows your guess count along with board-specific performance stats.</li>
          </ul>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Archive And Leaderboard</p>
          <h2>Keep playing after today</h2>
          <ul className="informational-list">
            <li>The archive lets you revisit older daily character and quote boards.</li>
            <li>The leaderboard highlights players with strong win totals, efficient solves, and long daily streaks.</li>
            <li>Profile pages collect your wins, average guesses, completion, and recent game history in one place.</li>
          </ul>
        </article>
      </section>

      <section className="glass-card informational-card" aria-label="Characterdle frequently asked questions">
        <p className="card-kicker">FAQ</p>
        <h2>Common questions</h2>
        <div className="informational-faq">
          {faqItems.map((item) => (
            <article key={item.question} className="informational-faq-item">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
