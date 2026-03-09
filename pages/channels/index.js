import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';

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
  { id: 39, name: 'Premier League (England)' },
  { id: 140, name: 'La Liga (Spain)' },
  { id: 135, name: 'Serie A (Italy)' },
  { id: 78, name: 'Bundesliga (Germany)' },
  { id: 61, name: 'Ligue 1 (France)' },
  { id: 6, name: 'AFCON' },
  { id: 12, name: 'CAF Champions League' },
  { id: 898, name: 'Ethiopian Premier League' },
  { id: 1, name: 'World Cup' },
  { id: 848, name: 'COSAFA Cup' },
  { id: 36, name: 'CHAN' },
  { id: 253, name: 'Major League Soccer' },
  { id: 307, name: 'Saudi Pro League' },
  { id: 203, name: 'Turkish Super Lig' },
  { id: 94, name: 'Primeira Liga (Portugal)' },
  { id: 88, name: 'Eredivisie (Netherlands)' },
];

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editChannel, setEditChannel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  const [form, setForm] = useState({
    channel_id: '', display_name: '', language: 'en', coupon_code: 'SM100',
    bonus_offer: '100% Bonus', leagues: [], timezone: 'Africa/Addis_Ababa', buttons: [], owner_user_id: '',
  });

  useEffect(() => { loadChannels(); }, []);

  async function loadChannels() {
    setLoading(true);
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      setChannels(data.channels || []);
    } catch { setMessage({ type: 'error', text: 'Failed to load channels' }); }
    setLoading(false);
  }

  function openCreateForm() {
    setEditChannel(null);
    setForm({ channel_id: '@', display_name: '', language: 'en', coupon_code: 'SM100', bonus_offer: '100% Bonus', leagues: [], timezone: 'Africa/Addis_Ababa', buttons: [], owner_user_id: '' });
    setShowForm(true);
  }

  function openEditForm(ch) {
    setEditChannel(ch);
    setForm({
      channel_id: ch.channel_id, display_name: ch.display_name, language: ch.language,
      coupon_code: ch.coupon_code, bonus_offer: ch.bonus_offer, leagues: ch.leagues || [],
      timezone: ch.timezone, buttons: ch.buttons || [], owner_user_id: ch.owner_user_id ? String(ch.owner_user_id) : '',
    });
    setShowForm(true);
  }

  async function saveChannel(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, owner_user_id: form.owner_user_id ? Number(form.owner_user_id) : null, leagues: form.leagues.map(Number) };
      let res;
      if (editChannel) {
        res = await fetch(`/api/channels/${encodeURIComponent(editChannel.channel_id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-bot-internal': 'true' }, body: JSON.stringify(body) });
      } else {
        res = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bot-internal': 'true' }, body: JSON.stringify(body) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: 'success', text: editChannel ? 'Channel updated!' : 'Channel created!' });
      setShowForm(false);
      loadChannels();
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    setSaving(false);
  }

  async function toggleActive(ch) {
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(ch.channel_id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-bot-internal': 'true' }, body: JSON.stringify({ active: !ch.active }) });
      if (!res.ok) throw new Error('Failed to update');
      setMessage({ type: 'success', text: `Channel ${ch.active ? 'deactivated' : 'activated'}` });
      loadChannels();
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
  }

  function toggleLeague(leagueId) {
    setForm(f => ({ ...f, leagues: f.leagues.includes(leagueId) ? f.leagues.filter(l => l !== leagueId) : [...f.leagues, leagueId] }));
  }

  function addButton() { setForm(f => ({ ...f, buttons: [...f.buttons, { text: '', url: '' }] })); }
  function updateButton(idx, field, value) {
    setForm(f => { const buttons = [...f.buttons]; buttons[idx] = { ...buttons[idx], [field]: value }; return { ...f, buttons }; });
  }
  function removeButton(idx) { setForm(f => ({ ...f, buttons: f.buttons.filter((_, i) => i !== idx) })); }

  async function copyPortalLink(ch) {
    const url = `${window.location.origin}/portal/${ch.owner_token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(ch.id);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <Layout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Channel Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>
            Add, edit, and manage Telegram channels. Each channel gets its own language, coupon, leagues, and settings.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreateForm}>+ Add Channel</button>
      </div>

      {/* Message */}
      {message && (
        <div className="panel" style={{
          padding: '12px 16px', marginBottom: 16,
          borderColor: message.type === 'error' ? 'var(--red)' : 'var(--green)',
          background: message.type === 'error' ? 'var(--red-bg)' : 'var(--green-bg)',
        }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>&times;</button>
        </div>
      )}

      {/* Channel List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading channels...</div>
      ) : channels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 40, margin: '0 0 8px' }}>&#x1F4E1;</p>
          <p>No channels yet. Click "Add Channel" to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {channels.map(ch => (
            <div key={ch.id} className="panel" style={{ marginBottom: 0, opacity: ch.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{ch.display_name}</h3>
                    <code style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: 'var(--text-muted)' }}>{ch.channel_id}</code>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: ch.active ? 'var(--green-bg)' : 'var(--red-bg)',
                      color: ch.active ? 'var(--green)' : 'var(--red)',
                    }}>
                      {ch.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>Language: <b style={{ color: 'var(--text)' }}>{LANGUAGES.find(l => l.code === ch.language)?.name || ch.language}</b></span>
                    <span>Coupon: <b style={{ color: 'var(--text)' }}>{ch.coupon_code}</b></span>
                    <span>Bonus: <b style={{ color: 'var(--text)' }}>{ch.bonus_offer}</b></span>
                    <span>Timezone: <b style={{ color: 'var(--text)' }}>{ch.timezone}</b></span>
                    <span>Leagues: <b style={{ color: 'var(--text)' }}>{ch.leagues?.length || 'All'}</b></span>
                    {ch.owner_user_id && <span>Owner: <b style={{ color: 'var(--text)' }}>{ch.owner_user_id}</b></span>}
                  </div>
                  {ch.buttons?.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                      Buttons: {ch.buttons.map(b => b.text).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 16, flexShrink: 0 }}>
                  {ch.owner_token && (
                    <button className="btn-secondary" onClick={() => copyPortalLink(ch)} style={{ fontSize: 12, padding: '5px 12px' }}>
                      {copiedToken === ch.id ? 'Copied!' : 'Portal Link'}
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => openEditForm(ch)} style={{ fontSize: 12, padding: '5px 12px' }}>Edit</button>
                  <button className="btn-secondary" onClick={() => toggleActive(ch)} style={{
                    fontSize: 12, padding: '5px 12px',
                    borderColor: ch.active ? 'var(--red)' : 'var(--green)', color: ch.active ? 'var(--red)' : 'var(--green)',
                  }}>
                    {ch.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28, width: '90%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{editChannel ? 'Edit Channel' : 'Add New Channel'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <form onSubmit={saveChannel}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Channel ID (e.g. @mychannel)</label>
                <input value={form.channel_id} onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))} disabled={!!editChannel} required placeholder="@mychannel" style={editChannel ? { opacity: 0.6 } : {}} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Display Name</label>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required placeholder="My Sports Channel" />
              </div>

              <div className="grid2" style={{ marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Language</label>
                  <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Timezone</label>
                  <input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="Africa/Addis_Ababa" />
                </div>
              </div>

              <div className="grid2" style={{ marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Coupon Code</label>
                  <input value={form.coupon_code} onChange={e => setForm(f => ({ ...f, coupon_code: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Bonus Offer</label>
                  <input value={form.bonus_offer} onChange={e => setForm(f => ({ ...f, bonus_offer: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Owner Telegram User ID (optional)</label>
                <input value={form.owner_user_id} onChange={e => setForm(f => ({ ...f, owner_user_id: e.target.value }))} placeholder="e.g. 123456789" />
                <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0' }}>
                  The Telegram user who can manage this channel via bot commands (/mychannel)
                </p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Leagues (empty = all popular leagues)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {POPULAR_LEAGUES.map(league => (
                    <button key={league.id} type="button" onClick={() => toggleLeague(league.id)} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: form.leagues.includes(league.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: form.leagues.includes(league.id) ? 'rgba(59,130,246,.15)' : 'var(--bg)',
                      color: form.leagues.includes(league.id) ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: form.leagues.includes(league.id) ? 600 : 400,
                    }}>
                      {league.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Inline Buttons</label>
                {form.buttons.map((btn, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input placeholder="Button text" value={btn.text} onChange={e => updateButton(idx, 'text', e.target.value)} style={{ flex: 1 }} />
                    <input placeholder="URL" value={btn.url} onChange={e => updateButton(idx, 'url', e.target.value)} style={{ flex: 1 }} />
                    <button type="button" onClick={() => removeButton(idx)} className="btn-secondary" style={{ padding: '6px 12px', borderColor: 'var(--red)', color: 'var(--red)' }}>&times;</button>
                  </div>
                ))}
                <button type="button" onClick={addButton} className="btn-secondary" style={{ marginTop: 8, fontSize: 12, borderStyle: 'dashed' }}>+ Add Button</button>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : (editChannel ? 'Update Channel' : 'Create Channel')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4,
};
