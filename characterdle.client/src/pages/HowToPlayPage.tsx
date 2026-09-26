import './InformationalPage.css';
import { RouteLink } from '../components/ui/RouteLink';
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
    answer: 'Character and Quote hints help you finish the board, but hinted rounds do not count toward ranked wins. Episode Ladder has no hint button; it gives position feedback after each attempt.',
  },
  {
    question: 'When do new daily games start?',
    answer: 'Character, Quote, and all five Episode Ladder difficulties refresh daily. Earlier games remain in the archive, with Premium required for the full archive. A completed Episode Ladder difficulty cannot be replayed.',
  },
  {
    question: 'Which games count toward my streak?',
    answer: 'While signed in, complete today\'s Character game, Quote game, or any Episode Ladder difficulty to keep your streak. Wins and losses count, including Character and Quote games finished with hints or by giving up. Multiple completions on the same day still count as one day. Random rounds and past archive games do not count.',
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
            Characterdle is a Wordle-inspired Game of Thrones guessing game with three daily modes.
            Start with the <RouteLink href="/got">character guessing game</RouteLink>, identify a quote&apos;s
            speaker, or arrange five events in Episode Ladder.
          </p>
        </div>

        <div className="informational-hero-actions">
          <RouteLink className="primary-button informational-action-button" href="/got">
            Start playing
          </RouteLink>
          <RouteLink className="secondary-button informational-action-button" href="/support" onNavigate={() => onNavigate('support')}>
            Get support
          </RouteLink>
        </div>
      </section>

      <section className="informational-grid" aria-label="How to play Characterdle">
        <article className="glass-card informational-card">
          <p className="card-kicker">Wordle And Characterdle</p>
          <h2>Read character clues, not letters</h2>
          <p>
            In Wordle, feedback tells you which letters are in the answer and where they belong.
            In Characterdle, you guess a whole character and compare their attributes with the hidden
            character. A matching house or role helps narrow the answer, while season arrows tell you
            whether to look earlier or later in the show. You are not solving a five-letter word.
          </p>
        </article>

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
          <p className="card-kicker">Episode Ladder</p>
          <h2>Put the events in order</h2>
          <ol className="informational-list">
            <li>Open <RouteLink href="/got/game/episode_ladder">Episode Ladder</RouteLink> and choose Easy, Medium, Hard, Expert, or Impossible. Each has its own daily puzzle.</li>
            <li>Arrange five events from earliest to latest, then select Check order. Each event comes from a different episode; flashbacks count by when they appear on screen.</li>
            <li>Drop onto the middle of a card to swap, or between cards to insert. On mobile, use the drag handle.</li>
            <li>Green events are correct and lock in place. Yellow means one position away; grey means farther away. You have four attempts per difficulty.</li>
            <li>Easier puzzles spread events farther apart. Impossible uses five consecutive episodes.</li>
          </ol>
          <p>
            First-attempt wins earn 10, 15, 20, 25, or 30 points by difficulty, up to 100 per day.
            Wins after one, two, or three wrong guesses keep 60%, 40%, or 30% of those points,
            rounded down. Losses earn zero points.
          </p>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Hints And Results</p>
          <h2>Know what counts</h2>
          <ul className="informational-list">
            <li>Hints are available in Character and Quote games when you need help.</li>
            <li>Hinted rounds are still playable and still useful, but they are treated differently from clean ranked solves.</li>
            <li>After a win, Characterdle shows your guess count along with board-specific performance stats.</li>
          </ul>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Archive And Leaderboard</p>
          <h2>Keep playing after today</h2>
          <ul className="informational-list">
            <li>The archive includes earlier Character, Quote, and Episode Ladder games. Premium unlocks the full archive.</li>
            <li>Character and Quote leaderboards track ranked wins. Episode Ladder has a points leaderboard, and daily completions contribute to your shared Game of Thrones streak.</li>
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
