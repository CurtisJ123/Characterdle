export function StreakCard() {
  return (
    <article className="glass-card streak-card">
      <p className="card-kicker">Daily Streak</p>
      <div className="streak-number">
        <span>12</span>
        <small>Days</small>
      </div>
      <div className="streak-bars" aria-label="Five of seven streak bars complete">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span className="is-empty" />
        <span className="is-empty" />
      </div>
      <p className="muted-copy">Keep it up. 5 days to the Maester badge.</p>
    </article>
  );
}
