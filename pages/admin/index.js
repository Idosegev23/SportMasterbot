// Admin Dashboard (moved from /)
import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';

export default function AdminDashboard() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [botStatus, setBotStatus] = useState(null);
  const [showBotCommands, setShowBotCommands] = useState(false);
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
  const updateSettings = async (newSettings) => {
    setLoading(true);
    try {
      const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSettings) });
      const d = await r.json(); setSettings(d.settings); setMessage('Settings updated successfully!'); await fetchStatus();
    } catch (e) { setMessage('Failed to update settings: ' + e.message); }
    setLoading(false);
  };
  const fetchBotStatus = async () => {
    try {
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) });
      const d = await r.json();
      setBotStatus({ data: { isRunning: d.status === 'running', adminUsers: [], commands: d.availableActions || [], status: d.status, timestamp: d.timestamp } });
    } catch {}
  };
  const autoStartBot = async () => {
    try {
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
      const d = await r.json(); if (d.success) await fetchBotStatus();
    } catch {}
  };
  const startBotCommands = async () => { setLoading(true); try { const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) }); const d = await r.json(); setMessage(d.success ? '✅ Bot commands started successfully!' : '❌ Failed to start bot commands: ' + d.message); await fetchBotStatus(); } catch (e) { setMessage('❌ Error starting bot commands: ' + e.message); } setLoading(false); };
  const stopBotCommands = async () => { setLoading(true); try { const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) }); const d = await r.json(); setMessage(d.success ? '🛑 Bot commands stopped' : '❌ Failed to stop bot commands: ' + d.message); await fetchBotStatus(); } catch (e) { setMessage('❌ Error stopping bot commands: ' + e.message); } setLoading(false); };
  const clearBotCommands = async () => { if (!confirm('Are you sure you want to clear all bot commands?')) return; setLoading(true); try { const r = await fetch('/api/bot/clear-commands', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); const d = await r.json(); setMessage(d.success ? '🗑️ Bot commands cleared successfully!' : '❌ Failed to clear bot commands: ' + d.message); await fetchBotStatus(); } catch (e) { setMessage('❌ Error clearing bot commands: ' + e.message); } setLoading(false); };
  const restartBot = async () => {
    setLoading(true);
    setMessage('Restarting bot…');
    try {
      await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) });
      await new Promise(r => setTimeout(r, 1000));
      const r = await fetch('/api/simple-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
      const d = await r.json();
      setMessage(d.success ? '🔄 Bot restarted' : ('❌ Restart failed: ' + (d.message||'')));
      await fetchBotStatus();
    } catch (e) {
      setMessage('❌ Restart error: ' + e.message);
    }
    setLoading(false);
  };
  const startSystem = async () => { setLoading(true); try { const r = await fetch('/api/start', { method: 'POST' }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed to start system: ' + e.message); } setLoading(false); };
  const sendPredictions = async () => { setLoading(true); try { const r = await fetch('/api/manual/predictions', { method: 'POST' }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed to send predictions: ' + e.message); } setLoading(false); };
  const sendResults = async () => { setLoading(true); try { const r = await fetch('/api/manual/results', { method: 'POST' }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed to send results: ' + e.message); } setLoading(false); };
  const sendPromo = async (promoType = 'football') => { setLoading(true); try { const r = await fetch('/api/manual/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promoType }) }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed to send promo: ' + e.message); } setLoading(false); };
  const sendBonus = async () => { const bonusText = prompt('Enter bonus message (in Amharic):'); if (!bonusText) return; setLoading(true); try { const r = await fetch('/api/manual/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bonusText }) }); const d = await r.json(); setMessage(d.message); await fetchStatus(); } catch (e) { setMessage('Failed to send bonus: ' + e.message); } setLoading(false); };
  const sendPersonalCoupons = async () => {
    const promoCode = prompt('Enter promo code to send (e.g., SM100):');
    if (!promoCode) return;
    const days = Number(prompt('Since how many days back? (default 7)')) || 7;
    const since = new Date(Date.now() - days*24*60*60*1000).toISOString();
    setLoading(true);
    try {
      const r = await fetch('/api/admin/send-personal-coupons', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET || ''}` }, body: JSON.stringify({ promoCode, since }) });
      const d = await r.json();
      setMessage(d.success ? `✅ Sent to ${d.sent}/${d.targets}` : `❌ Failed: ${d.message}`);
    } catch (e) { setMessage('Failed: ' + e.message); }
    setLoading(false);
  };

  return (
    <Layout>
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ backgroundColor: '#2c3e50', color: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
        <h1>🎯 SportMaster Dynamic Automated Posts</h1>
        <p>Admin dashboard</p>
        <p><a href="/analytics" style={{ color: '#9fe3ff' }}>Go to Analytics →</a></p>
        <p><strong>Language:</strong> English | <strong>Timezone:</strong> Africa/Addis_Ababa | <strong>Website:</strong> {settings?.websiteUrl || 't.me/Sportmsterbot'}</p>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ padding: '8px 16px', backgroundColor: showSettings ? '#e74c3c' : '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>{showSettings ? '🔒 Hide Settings' : '⚙️ Show Settings'}</button>
          <button onClick={() => setShowBotCommands(!showBotCommands)} style={{ padding: '8px 16px', backgroundColor: showBotCommands ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>{showBotCommands ? '🤖 Hide Bot Commands' : '🤖 Bot Commands'}</button>
        </div>
      </div>

      <div style={{ background: 'white', padding: 20, borderRadius: 10, marginTop: 20 }}>
        <h2>Quick Actions</h2>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={startSystem}>Start System</button>
          <button onClick={restartBot}>Restart Bot</button>
          <button onClick={sendPredictions}>Send Predictions</button>
          <button onClick={sendResults}>Send Results</button>
          <button onClick={()=>sendPromo('football')}>Send Football Promo</button>
          <button onClick={sendBonus}>Send Custom Bonus</button>
          <button onClick={()=> setShowCouponForm(true)}>Send Personal Coupons (DM)</button>
        </div>
      </div>

      <CouponForm visible={showCouponForm} onClose={()=> setShowCouponForm(false)} onSent={(msg)=> setMessage(msg)} />

    </div>
    </Layout>
  );
}

function CouponForm({ visible, onClose, onSent }) {
  const [promoCode, setPromoCode] = useState('SM100');
  const [days, setDays] = useState(7);
  const [messageText, setMessageText] = useState('Special personal offer just for you!');
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  if (!visible) return null;
  const since = new Date(Date.now() - Number(days||7) * 24 * 60 * 60 * 1000).toISOString();
  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/send-personal-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET || ''}` },
        body: JSON.stringify({ promoCode, messageText, since, dryRun })
      });
      const d = await r.json();
      onSent?.(d.success ? `✅ ${dryRun ? 'Preview' : 'Sent'}: ${d.sent||0}/${d.targets}` : `❌ Failed: ${d.message}`);
      if (d.success && !dryRun) onClose?.();
    } catch (e) {
      onSent?.('❌ Error: ' + e.message);
    }
    setSubmitting(false);
  };
  return (
    <div style={{ marginTop:20, background:'white', borderRadius:10, padding:16 }}>
      <h3>Send Personal Coupons</h3>
      <div style={{ display:'grid', gap:10, gridTemplateColumns:'repeat(2, minmax(0, 1fr))' }}>
        <label>Promo Code
          <input value={promoCode} onChange={e=>setPromoCode(e.target.value)} />
        </label>
        <label>Days Back
          <input type="number" min="1" max="90" value={days} onChange={e=>setDays(e.target.value)} />
        </label>
      </div>
      <label style={{ display:'block', marginTop:10 }}>Message Text
        <textarea rows={3} value={messageText} onChange={e=>setMessageText(e.target.value)} />
      </label>
      <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
        <input type="checkbox" checked={dryRun} onChange={e=>setDryRun(e.target.checked)} /> Preview only (no send)
      </label>
      <div style={{ display:'flex', gap:10, marginTop:12 }}>
        <button disabled={submitting} onClick={submit}>{dryRun ? 'Preview' : 'Send'}</button>
        <button disabled={submitting} onClick={onClose}>Close</button>
      </div>
      <div style={{ marginTop:8, opacity:.8 }}>Targets window since: {since}</div>
      <style jsx>{`
        input, textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
        h3 { margin-top: 0; }
      `}</style>
    </div>
  );
}

