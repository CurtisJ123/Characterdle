import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import type { AdminDashboardStats } from '../../types/admin';
import { UpdatesError } from '../updates/UpdatesCommon';
import './AdminDashboard.css';

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="admin-metric">
    <dt>{label}</dt>
    <dd><strong className="admin-metric-value">{value.toLocaleString()}</strong><span className="admin-metric-detail">{detail}</span></dd>
  </div>;
}

export function AdminDashboard({ token }: { token: string }) {
  const stats = useUpdatesResource<AdminDashboardStats>('/api/admin/dashboard', token);
  const data = stats.data;
  return <section className="glass-card admin-dashboard" aria-labelledby="admin-home-title" aria-busy={stats.loading}>
    <div className="updates-editor-heading">
      <div><h2 id="admin-home-title">Site overview</h2><p className="admin-dashboard-caption">All-time totals unless noted.</p></div>
      <button type="button" className="secondary-button" disabled={stats.loading} onClick={stats.reload}>Refresh</button>
    </div>
    {stats.loading && <p role="status">Loading site statistics...</p>}
    <UpdatesError message={stats.error ? 'Site statistics could not be loaded. Please try again.' : undefined} retry={stats.reload} />
    {data && <>
      <section className="admin-dashboard-group" aria-labelledby="admin-accounts-title">
        <h3 id="admin-accounts-title">Accounts</h3>
        <dl className="admin-metrics admin-metrics--accounts">
          <Metric label="Profiles created" value={data.profiles} detail="Existing player profiles." />
          <Metric label="New profiles" value={data.newProfiles} detail="Created in the last 7 days." />
          <Metric label="Accounts that played" value={data.accountsWithCompletedGames} detail="At least one saved win or loss." />
        </dl>
      </section>
      <section className="admin-dashboard-group" aria-labelledby="admin-premium-title">
        <h3 id="admin-premium-title">Premium</h3>
        <dl className="admin-metrics">
          <Metric label="Premium users" value={data.premium.users} detail="All accounts with Premium access, including trials and manual grants." />
          <Metric label="Trial users" value={data.premium.trialUsers} detail="Trialing accounts with Premium access." />
          <Metric label="Active subscriptions" value={data.premium.activeSubscriptions} detail="Active Stripe subscriptions with access; excludes trials." />
          <Metric label="Past-due subscriptions" value={data.premium.pastDueSubscriptions} detail="Payment overdue; may still have Premium access." />
        </dl>
        <p className="admin-dashboard-note">Subscription status comes from the site's stored billing state, not a live Stripe check. Active does not necessarily mean paid, for example with a 100% discount.</p>
      </section>
      <section className="admin-dashboard-group" aria-labelledby="admin-players-title">
        <h3 id="admin-players-title">Gameplay</h3>
        <dl className="admin-metrics">
          <Metric label="Unique tracked players" value={data.players.uniquePlayers} detail="Distinct participant keys across recorded games." />
          <Metric label="Active players" value={data.players.activePlayers} detail="Participant keys with game activity in the last 7 days." />
          <Metric label="Games started" value={data.players.startedGames} detail="Recorded participant/game/mode combinations." />
          <Metric label="Games completed" value={data.players.completedGames} detail="Recorded wins and losses, with or without hints." />
        </dl>
        <p className="admin-dashboard-note">Character and Quote daily/archive games only; random practice is not tracked. Player counts are estimates, not verified people or site visitors. Different browsers or cleared storage can count one person more than once.</p>
      </section>
      <footer className="admin-dashboard-footer">
        <span>Updated <time dateTime={data.generatedAt}>{new Date(data.generatedAt).toLocaleString()}</time></span>
        <span>7-day window starts <time dateTime={data.activitySince}>{new Date(data.activitySince).toLocaleString()}</time></span>
      </footer>
    </>}
  </section>;
}
