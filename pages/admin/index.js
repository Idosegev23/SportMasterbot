import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';

export default function AdminDashboard() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [botStatus, setBotStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchSettings();
    fetchBotStatus();
    autoStartBot();
  }, []);

  const fetchStatus = async () => {
    try { const r = await fetch('/api/status'); setSystemStatus(await r.json()); } catch {}
  };
  const fetchSettings = async () => {
    try { const r = await fetch('/api/settings'); const d = await r.json(); setSettings(d.settings); } catch {}
  };
  const fetchBotStatus = async () => {
    try {
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) });
      const d = await r.json();
      setBotStatus({ isRunning: d.status === 'running', commands: d.availableActions || [], status: d.status });
    } catch {}
  };
  const autoStartBot = async () => {
    try {
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
      const d = await r.json();
      if (d.success) await fetchBotStatus();
    } catch {}
  };

  const botAction = async (action) => {
    setLoading(true);
    try {
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await r.json();
      setMessage(d.success ? `Bot ${action} successful` : `Failed: ${d.message}`);
      await fetchBotStatus();
    } catch (e) { setMessage('Error: ' + e.message); }
    setLoading(false);
  };

  const restartBot = async () => {
    setLoading(true);
    setMessage('Restarting bot...');
    try {
      await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) });
      await new Promise(r => setTimeout(r, 1000));
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
      const d = await r.json();
      setMessage(d.success ? 'Bot restarted successfully' : 'Restart failed: ' + (d.message || ''));
      await fetchBotStatus();
    } catch (e) { setMessage('Restart error: ' + e.message); }
    setLoading(false);
  };

  const startSystem = async () => {
    setLoading(true);
    try { const r = await fetch('/api/start', { method: 'POST' }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed: ' + e.message); }
    setLoading(false);
  };

  const sendManual = async (endpoint) => {
    setLoading(true);
    try { const r = await fetch(endpoint, { method: 'POST' }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed: ' + e.message); }
    setLoading(false);
  };

  const sendPromo = async (promoType) => {
    setLoading(true);
    try {
      const r = await fetch('/api/manual/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoType }) });
      const d = await r.json(); setMessage(d.message); await fetchStatus();
    } catch (e) { setMessage('Failed: ' + e.message); }
    setLoading(false);
  };

  const sendBonus = async () => {
    const bonusText = prompt('Enter bonus message:');
    if (!bonusText) return;
    setLoading(true);
    try {
      const r = await fetch('/api/manual/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bonusText }) });
      const d = await r.json(); setMessage(d.message); await fetchStatus();
    } catch (e) { setMessage('Failed: ' + e.message); }
    setLoading(false);
  };

  const forceWebhookUpdate = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/force-webhook-update', { method: 'POST' });
      const d = await r.json();
      setMessage(d.success ? 'Webhook updated successfully' : 'Failed: ' + d.message);
    } catch (e) { setMessage('Error: ' + e.message); }
    setLoading(false);
  };

  const updateSettings = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      const d = await r.json(); setSettings(d.settings); setMessage('Settings updated successfully'); await fetchStatus();
    } catch (e) { setMessage('Failed: ' + e.message); }
    setLoading(false);
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Admin Control Panel</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>
            Bot controls, settings, and manual content triggers
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? 'Hide Settings' : 'Settings'}
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="panel" style={{
          padding: '12px 16px', marginBottom: 16,
          borderColor: message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'var(--red)' : 'var(--green)',
          background: message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'var(--red-bg)' : 'var(--green-bg)',
        }}>
          {message}
          <button onClick={() => setMessage('')} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>&times;</button>
        </div>
      )}

      {/* System Status */}
      <div className="panel">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>System Status</h2>
        <div className="kpi-grid">
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: botStatus?.isRunning ? 'var(--green)' : 'var(--red)' }}>
              {botStatus?.isRunning ? 'Running' : 'Stopped'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Bot Status</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, color: systemStatus?.system?.status === 'running' ? 'var(--green)' : 'var(--text-muted)' }}>
              {systemStatus?.system?.status || '—'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>System</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{systemStatus?.system?.dailyStats?.predictionsPosted || 0}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Predictions Today</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{systemStatus?.system?.dailyStats?.resultsPosted || 0}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Results Today</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{systemStatus?.system?.dailyStats?.promosPosted || 0}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Promos Today</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{systemStatus?.system?.dailyStats?.errors || 0}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Errors</div>
          </div>
        </div>
      </div>

      {/* Bot Controls */}
      <div className="panel">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Bot Controls</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" disabled={loading || botStatus?.isRunning} onClick={() => botAction('start')}>Start Bot</button>
          <button className="btn-secondary" disabled={loading || !botStatus?.isRunning} onClick={() => botAction('stop')}>Stop Bot</button>
          <button className="btn-secondary" disabled={loading} onClick={restartBot}>Restart Bot</button>
          <button className="btn-secondary" disabled={loading} onClick={startSystem}>Start System</button>
          <button className="btn-secondary" disabled={loading} onClick={forceWebhookUpdate} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>Force Webhook Update</button>
          <button className="btn-secondary" disabled={loading} onClick={fetchBotStatus}>Refresh Status</button>
        </div>
      </div>

      {/* Quick Sends */}
      <div className="panel">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Quick Sends</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" disabled={loading} onClick={() => sendManual('/api/manual/predictions')}>Send Predictions</button>
          <button className="btn-primary" disabled={loading} onClick={() => sendManual('/api/manual/results')}>Send Results</button>
          <button className="btn-secondary" disabled={loading} onClick={() => sendPromo('football')}>Football Promo</button>
          <button className="btn-secondary" disabled={loading} onClick={() => sendPromo('casino')}>Casino Promo</button>
          <button className="btn-secondary" disabled={loading} onClick={sendBonus}>Custom Bonus</button>
          <button className="btn-secondary" disabled={loading} onClick={() => setShowCouponForm(!showCouponForm)}>Personal Coupons</button>
        </div>
      </div>

      {/* Coupon Form */}
      {showCouponForm && <CouponForm onClose={() => setShowCouponForm(false)} onSent={setMessage} />}

      {/* Settings Panel */}
      {showSettings && settings && (
        <div className="panel">
          <h2 style={{ fontSize: 16, marginBottom: 16 }}>System Settings</h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Website URL</label>
            <input value={settings.websiteUrl || ''} onChange={e => setSettings({ ...settings, websiteUrl: e.target.value })} placeholder="t.me/Sportmsterbot" />
          </div>

          {settings.promoCodes && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Promo Codes</label>
              <div className="grid2">
                {Object.entries(settings.promoCodes).map(([key, value]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 2, textTransform: 'capitalize' }}>{key}</label>
                    <input value={value} onChange={e => setSettings({ ...settings, promoCodes: { ...settings.promoCodes, [key]: e.target.value } })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {settings.bonusOffers && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Bonus Offers</label>
              <div className="grid2">
                {Object.entries(settings.bonusOffers).map(([key, value]) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 2, textTransform: 'capitalize' }}>{key}</label>
                    <input value={value} onChange={e => setSettings({ ...settings, bonusOffers: { ...settings.bonusOffers, [key]: e.target.value } })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {settings.autoPosting && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Auto Posting</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={settings.autoPosting.dynamicTiming} onChange={e => setSettings({ ...settings, autoPosting: { ...settings.autoPosting, dynamicTiming: e.target.checked } })} />
                  Dynamic Timing
                </label>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>Hours Before Match</label>
                  <input type="number" min="1" max="6" value={settings.autoPosting.hoursBeforeMatch} onChange={e => setSettings({ ...settings, autoPosting: { ...settings.autoPosting, hoursBeforeMatch: parseInt(e.target.value) } })} style={{ width: 80 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>Min Gap (min)</label>
                  <input type="number" min="15" max="120" value={settings.autoPosting.minGapBetweenPosts} onChange={e => setSettings({ ...settings, autoPosting: { ...settings.autoPosting, minGapBetweenPosts: parseInt(e.target.value) } })} style={{ width: 80 }} />
                </div>
              </div>
            </div>
          )}

          <button className="btn-primary" disabled={loading} onClick={updateSettings}>
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Bot Commands Reference */}
      <div className="panel" style={{ opacity: 0.85 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Bot Commands Reference</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
          {[
            '/start — Main menu with buttons',
            '/help — Commands list',
            '/predictions — Send match predictions',
            '/results — Send match results',
            '/promo — Send promo message',
            '/live — Live matches now',
            '/today — Today\'s games',
            '/status — System status',
          ].map((cmd, i) => (
            <div key={i} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'monospace' }}>
              {cmd}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function CouponForm({ onClose, onSent }) {
  const [promoCode, setPromoCode] = useState('SM100');
  const [days, setDays] = useState(7);
  const [messageText, setMessageText] = useState('Special personal offer just for you!');
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const since = new Date(Date.now() - Number(days || 7) * 24 * 60 * 60 * 1000).toISOString();

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/send-personal-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET || ''}` },
        body: JSON.stringify({ promoCode, messageText, since, dryRun })
      });
      const d = await r.json();
      onSent?.(d.success ? `${dryRun ? 'Preview' : 'Sent'}: ${d.sent || 0}/${d.targets}` : `Failed: ${d.message}`);
      if (d.success && !dryRun) onClose?.();
    } catch (e) { onSent?.('Error: ' + e.message); }
    setSubmitting(false);
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Send Personal Coupons</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>&times;</button>
      </div>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Promo Code</label>
          <input value={promoCode} onChange={e => setPromoCode(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Days Back</label>
          <input type="number" min="1" max="90" value={days} onChange={e => setDays(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Message Text</label>
        <textarea rows={3} value={messageText} onChange={e => setMessageText(e.target.value)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
        Preview only (no send)
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" disabled={submitting} onClick={submit}>{dryRun ? 'Preview' : 'Send'}</button>
        <button className="btn-secondary" disabled={submitting} onClick={onClose}>Cancel</button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>Target window since: {since}</div>
    </div>
  );
}
