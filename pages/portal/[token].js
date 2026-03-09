import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'am', name: 'Amharic' },
  { code: 'sw', name: 'Swahili' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'es', name: 'Spanish' },
];

const POPULAR_LEAGUES = [
  { id: 2, name: 'Champions League' },
  { id: 3, name: 'Europa League' },
  { id: 39, name: 'Premier League' },
  { id: 140, name: 'La Liga' },
  { id: 135, name: 'Serie A' },
  { id: 78, name: 'Bundesliga' },
  { id: 61, name: 'Ligue 1' },
  { id: 6, name: 'AFCON' },
  { id: 12, name: 'CAF Champions League' },
  { id: 898, name: 'Ethiopian Premier League' },
  { id: 1, name: 'World Cup' },
  { id: 253, name: 'MLS' },
  { id: 307, name: 'Saudi Pro League' },
  { id: 203, name: 'Turkish Super Lig' },
  { id: 94, name: 'Primeira Liga' },
  { id: 88, name: 'Eredivisie' },
];

export default function PortalPage() {
  const router = useRouter();
  const { token } = router.query;

  const [channel, setChannel] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [form, setForm] = useState({});

  useEffect(() => { if (token) loadPortal(); }, [token]);

  async function loadPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal?token=${token}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('Invalid or expired access link');
        throw new Error('Failed to load');
      }
      const data = await res.json();
      setChannel(data.channel);
      setStats(data.stats);
      setForm({
        display_name: data.channel.display_name,
        language: data.channel.language,
        coupon_code: data.channel.coupon_code,
        bonus_offer: data.channel.bonus_offer,
        timezone: data.channel.timezone,
        leagues: data.channel.leagues || [],
        buttons: data.channel.buttons || [],
      });
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/portal?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChannel(data.channel);
      setMessage({ type: 'success', text: 'Settings saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setSaving(false);
  }

  function toggleLeague(leagueId) {
    setForm(f => ({ ...f, leagues: f.leagues.includes(leagueId) ? f.leagues.filter(l => l !== leagueId) : [...f.leagues, leagueId] }));
  }
  function addButton() { setForm(f => ({ ...f, buttons: [...f.buttons, { text: '', url: '' }] })); }
  function updateButton(idx, field, value) {
    setForm(f => { const buttons = [...f.buttons]; buttons[idx] = { ...buttons[idx], [field]: value }; return { ...f, buttons }; });
  }
  function removeButton(idx) { setForm(f => ({ ...f, buttons: f.buttons.filter((_, i) => i !== idx) })); }

  if (loading) {
    return (
      <>
        <Head><title>Loading... | SportMaster</title></Head>
        <div className="portal-center">
          <p style={{ color: 'var(--text-muted)' }}>Loading your channel portal...</p>
        </div>
        <style jsx>{portalStyles}</style>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head><title>Access Denied | SportMaster</title></Head>
        <div className="portal-center">
          <h2 style={{ color: 'var(--red)', marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Contact the admin if you think this is a mistake.</p>
        </div>
        <style jsx>{portalStyles}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{channel?.display_name || 'Channel'} Portal | SportMaster</title>
      </Head>
      <div className="portal-page">
        {/* Header */}
        <div className="portal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar">{channel.display_name?.charAt(0)?.toUpperCase()}</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>{channel.display_name}</h1>
              <code style={{ fontSize: 13, color: 'var(--text-muted)' }}>{channel.channel_id}</code>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <StatCard label="Total Posts" value={stats?.totalPosts || 0} color="var(--accent)" />
          <StatCard label="Today's Posts" value={stats?.todayPosts || 0} color="var(--green)" />
          <StatCard label="Language" value={LANGUAGES.find(l => l.code === channel.language)?.name || channel.language} color="var(--purple)" />
          <StatCard label="Coupon Code" value={channel.coupon_code} color="var(--yellow)" />
        </div>

        {/* Message */}
        {message && (
          <div className="portal-msg" style={{
            borderColor: message.type === 'error' ? 'var(--red)' : 'var(--green)',
            background: message.type === 'error' ? 'var(--red-bg)' : 'var(--green-bg)',
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          {['settings', 'leagues', 'buttons'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`tab ${activeTab === tab ? 'active' : ''}`}>
              {tab === 'settings' ? 'Settings' : tab === 'leagues' ? 'Leagues' : 'Inline Buttons'}
            </button>
          ))}
        </div>

        <form onSubmit={saveSettings}>
          {activeTab === 'settings' && (
            <div className="form-grid">
              <div className="form-field full">
                <label>Display Name</label>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Language</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Timezone</label>
                <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Coupon Code</label>
                <input value={form.coupon_code} onChange={e => setForm(f => ({ ...f, coupon_code: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Bonus Offer</label>
                <input value={form.bonus_offer} onChange={e => setForm(f => ({ ...f, bonus_offer: e.target.value }))} />
              </div>
            </div>
          )}

          {activeTab === 'leagues' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Select the leagues you want content for. Leave empty to get all popular leagues.
              </p>
              <div className="league-chips">
                {POPULAR_LEAGUES.map(league => (
                  <button key={league.id} type="button" onClick={() => toggleLeague(league.id)}
                    className={`league-chip ${form.leagues.includes(league.id) ? 'selected' : ''}`}>
                    {league.name}
                  </button>
                ))}
              </div>
              {form.leagues.length > 0 && (
                <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 12 }}>
                  {form.leagues.length} league(s) selected
                </p>
              )}
            </div>
          )}

          {activeTab === 'buttons' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                These buttons appear at the bottom of every message sent to your channel.
              </p>
              {form.buttons.map((btn, idx) => (
                <div key={idx} className="btn-row">
                  <input placeholder="Button text" value={btn.text} onChange={e => updateButton(idx, 'text', e.target.value)} />
                  <input placeholder="URL (https://...)" value={btn.url} onChange={e => updateButton(idx, 'url', e.target.value)} />
                  <button type="button" onClick={() => removeButton(idx)} className="remove-btn">&times;</button>
                </div>
              ))}
              <button type="button" onClick={addButton} className="add-btn">+ Add Button</button>
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <button type="submit" disabled={saving} className="save-btn">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Bot Commands Reference */}
        <div className="portal-info">
          <h4>Telegram Bot Commands</h4>
          <p>You can also manage your channel settings via Telegram bot commands:</p>
          <ul>
            <li><code>/mychannel</code> — View your channel info</li>
            <li><code>/setcoupon CODE</code> — Change coupon code</li>
            <li><code>/setbonus OFFER</code> — Change bonus text</li>
            <li><code>/setlanguage en</code> — Change language (en/am/sw/fr/ar/pt/es)</li>
            <li><code>/mylink</code> — Get your portal link</li>
          </ul>
        </div>
      </div>

      <style jsx>{portalStyles}</style>
    </>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <style jsx>{`
        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          border-top: 3px solid ${color};
        }
      `}</style>
    </div>
  );
}

const portalStyles = `
  :global(:root) {
    --bg: #0c1017;
    --bg-card: #151b27;
    --bg-input: #1a2233;
    --border: #252e3f;
    --border-light: #2a3548;
    --text: #e2e8f0;
    --text-muted: #8896a8;
    --text-dim: #5a6a7d;
    --accent: #3b82f6;
    --green: #22c55e;
    --green-bg: rgba(34,197,94,.12);
    --red: #ef4444;
    --red-bg: rgba(239,68,68,.12);
    --yellow: #eab308;
    --purple: #a855f7;
    --radius: 10px;
    --radius-sm: 6px;
  }
  :global(html, body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
    margin: 0; padding: 0;
  }
  :global(input, textarea, select) {
    background: var(--bg-input);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 13px;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }
  :global(input:focus, textarea:focus, select:focus) { outline: none; border-color: var(--accent); }
  :global(code) { font-family: 'SFMono-Regular', Menlo, Monaco, monospace; }

  .portal-center {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100vh; text-align: center;
  }
  .portal-page {
    max-width: 900px; margin: 0 auto; padding: 24px 20px;
  }
  .portal-header { margin-bottom: 28px; }
  .avatar {
    width: 44px; height: 44px; border-radius: 12px; background: var(--accent);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 20px; font-weight: 700;
  }
  .stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px; margin-bottom: 28px;
  }
  .portal-msg {
    padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px;
    border: 1px solid var(--border);
  }
  .tabs {
    display: flex; gap: 4px; margin-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    padding: 10px 20px; border: none; cursor: pointer; font-size: 14px; font-weight: 500;
    color: var(--text-muted); background: none;
    border-bottom: 2px solid transparent;
  }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover { color: var(--text); }

  .form-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  }
  .form-field label {
    display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;
  }
  .form-field.full { grid-column: 1 / -1; }

  .league-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .league-chip {
    padding: 8px 16px; border-radius: 24px; cursor: pointer; font-size: 13px;
    border: 1px solid var(--border); background: var(--bg);
    color: var(--text-muted); font-weight: 400;
  }
  .league-chip.selected {
    border: 2px solid var(--accent); background: rgba(59,130,246,.15);
    color: var(--accent); font-weight: 600;
  }

  .btn-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .btn-row input { flex: 1; }
  .remove-btn {
    padding: 8px 14px; background: var(--red-bg); border: 1px solid var(--red);
    border-radius: var(--radius-sm); cursor: pointer; color: var(--red); font-size: 16px;
  }
  .add-btn {
    padding: 8px 16px; border: 1px dashed var(--border); border-radius: var(--radius-sm);
    background: var(--bg); cursor: pointer; font-size: 13px; color: var(--text-muted);
  }

  .save-btn {
    width: 100%; padding: 14px; background: var(--accent); color: #fff;
    border: none; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 15px; font-weight: 600;
  }
  .save-btn:disabled { opacity: 0.6; }

  .portal-info {
    margin-top: 36px; padding: 20px; background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); font-size: 13px; color: var(--text-muted);
  }
  .portal-info h4 { margin: 0 0 8px; color: var(--text); }
  .portal-info p { margin: 0 0 8px; }
  .portal-info ul { margin: 0; padding-left: 20px; }
  .portal-info li { margin-bottom: 4px; }
  .portal-info code {
    background: var(--bg); padding: 2px 6px; border-radius: 4px; font-size: 12px;
  }

  @media (max-width: 600px) {
    .form-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .btn-row { flex-direction: column; }
  }
`;
