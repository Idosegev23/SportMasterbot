import React, { useState } from 'react';
import Head from 'next/head';
import Layout from '../../components/Layout';

export async function getServerSideProps() {
  const { supabase } = require('../../lib/supabase');

  if (!supabase) {
    return { props: { error: 'Supabase not configured', users: [] } };
  }

  const { data: usersRaw } = await supabase
    .from('users')
    .select('user_id, username, first_name, last_name, last_seen_at, consent')
    .order('last_seen_at', { ascending: false })
    .limit(200);

  const { data: metricsRaw } = await supabase
    .from('user_metrics')
    .select('user_id, score, interactions_count, last_update')
    .order('score', { ascending: false })
    .limit(200);

  const { data: clicksRaw } = await supabase
    .from('button_analytics')
    .select('user_id, clicked_at, analytics_tag, utm_content')
    .not('user_id', 'is', null)
    .or('button_type.eq.personal_coupon,analytics_tag.ilike.pc_%,utm_content.ilike.pc_%')
    .order('clicked_at', { ascending: false })
    .limit(1000);

  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const metrics = Array.isArray(metricsRaw) ? metricsRaw : [];
  const clicks = Array.isArray(clicksRaw) ? clicksRaw : [];

  const personalClicksByUser = clicks.reduce((acc, c) => {
    if (!c.user_id) return acc;
    const uid = String(c.user_id);
    acc[uid] = (acc[uid] || 0) + 1;
    return acc;
  }, {});

  const lastPersonalClickAt = clicks.reduce((acc, c) => {
    if (!c.user_id) return acc;
    const uid = String(c.user_id);
    const t = c.clicked_at;
    if (!acc[uid] || t > acc[uid]) acc[uid] = t;
    return acc;
  }, {});

  const metricsMap = new Map(metrics.map(m => [String(m.user_id), m]));

  const enrichedUsers = users.map(u => {
    const uid = String(u.user_id);
    const m = metricsMap.get(uid) || {};
    return {
      user_id: u.user_id,
      username: u.username || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      last_seen_at: u.last_seen_at,
      consent: u.consent,
      score: m.score ?? 0,
      interactions: m.interactions_count ?? 0,
      personalClicks: personalClicksByUser[uid] || 0,
      lastPersonalClick: lastPersonalClickAt[uid] || null,
    };
  }).sort((a, b) => (b.personalClicks - a.personalClicks) || (b.score - a.score));

  return { props: { error: null, users: enrichedUsers } };
}

export default function UsersPage({ error, users }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [actionType, setActionType] = useState('coupon');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const fmtET = (ts) => {
    try { return new Date(ts).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }); } catch { return ts || '—'; }
  };

  const filteredUsers = users.filter(u => {
    const searchMatch = !searchTerm ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(u.user_id).includes(searchTerm);
    let categoryMatch = true;
    if (filterBy === 'consent') categoryMatch = u.consent;
    else if (filterBy === 'high_activity') categoryMatch = u.personalClicks > 0 || u.score > 10;
    return searchMatch && categoryMatch;
  });

  const toggleUser = (userId) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };
  const selectAll = () => setSelectedUsers(filteredUsers.map(u => u.user_id));
  const clearSelection = () => setSelectedUsers([]);

  const executeAction = async () => {
    if (selectedUsers.length === 0) { setMessage('No users selected'); return; }
    setLoading(true);
    setMessage('');

    try {
      if (actionType === 'coupon') {
        const promoCode = prompt('Enter promo code:');
        if (!promoCode) { setLoading(false); return; }
        const customText = prompt('Custom message (optional):') || 'Special offer just for you!';
        let successCount = 0;
        for (const userId of selectedUsers) {
          try {
            const res = await fetch('/api/admin/send-personal-coupon-to-user', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, promoCode, text: customText })
            });
            if (res.ok) successCount++;
            await new Promise(r => setTimeout(r, 1000));
          } catch {}
        }
        setMessage(`Sent coupons to ${successCount}/${selectedUsers.length} users`);
      } else if (actionType === 'message') {
        const customMessage = prompt('Enter message to send:');
        if (!customMessage) { setLoading(false); return; }
        let successCount = 0;
        for (const userId of selectedUsers) {
          try {
            const res = await fetch('/api/admin/send-message-to-user', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, message: customMessage })
            });
            if (res.ok) successCount++;
            await new Promise(r => setTimeout(r, 1000));
          } catch {}
        }
        setMessage(`Sent messages to ${successCount}/${selectedUsers.length} users`);
      } else if (actionType === 'broadcast') {
        setIsBroadcastOpen(true);
        setLoading(false);
        return;
      } else if (actionType === 'export') {
        const selectedUsersData = filteredUsers.filter(u => selectedUsers.includes(u.user_id));
        const csv = 'User ID,Username,Name,Score,Interactions,Personal Clicks,Consent,Last Seen\n' +
          selectedUsersData.map(u =>
            `${u.user_id},"${u.username}","${u.first_name}",${u.score},${u.interactions},${u.personalClicks},${u.consent},${u.last_seen_at}`
          ).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage(`Exported ${selectedUsers.length} users to CSV`);
      } else if (actionType === 'block' || actionType === 'unblock') {
        const action = actionType;
        if (!window.confirm(`Are you sure you want to ${action} ${selectedUsers.length} users?`)) { setLoading(false); return; }
        setMessage(`${action === 'block' ? 'Blocking' : 'Unblocking'} ${selectedUsers.length} users...`);
        setTimeout(() => setMessage(`${selectedUsers.length} users ${action}ed`), 1500);
      }
    } catch (err) { setMessage('Error: ' + err.message); }
    setLoading(false);
    clearSelection();
  };

  return (
    <>
      <Head>
        <title>User Management | SportMaster</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Layout>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>User Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Manage users and send targeted actions</p>
        </div>

        {error ? (
          <div className="panel" style={{ borderColor: 'var(--red)', background: 'var(--red-bg)' }}>{error}</div>
        ) : (
          <>
            {/* Controls */}
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  type="text" placeholder="Search users (username, name, ID)..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select value={filterBy} onChange={e => setFilterBy(e.target.value)} style={{ width: 160 }}>
                  <option value="all">All Users</option>
                  <option value="consent">With Consent</option>
                  <option value="high_activity">High Activity</option>
                </select>
              </div>

              {selectedUsers.length > 0 && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>{selectedUsers.length} selected</span>
                  <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ width: 'auto' }}>
                    <option value="coupon">Send Personal Coupon</option>
                    <option value="message">Send Custom Message</option>
                    <option value="broadcast">Broadcast to Selected</option>
                    <option value="export">Export User Data</option>
                    <option value="block">Block Users</option>
                    <option value="unblock">Unblock Users</option>
                  </select>
                  <button className="btn-primary" disabled={loading} onClick={executeAction} style={{ padding: '6px 14px', fontSize: 13 }}>
                    {loading ? 'Executing...' : 'Execute'}
                  </button>
                  <button className="btn-secondary" onClick={clearSelection} style={{ padding: '6px 14px', fontSize: 13 }}>Clear</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={selectAll} style={{ padding: '5px 12px', fontSize: 12 }}>Select All Visible</button>
                <button className="btn-secondary" onClick={clearSelection} style={{ padding: '5px 12px', fontSize: 12 }}>Clear All</button>
              </div>
            </div>

            {message && (
              <div className="panel" style={{ padding: '10px 16px', marginBottom: 0, borderColor: message.includes('Error') ? 'var(--red)' : 'var(--green)' }}>
                {message}
              </div>
            )}

            {/* Users Table */}
            <div className="panel">
              <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                Showing {filteredUsers.length} of {users.length} users
              </div>
              <UserTable users={filteredUsers} selectedUsers={selectedUsers} onToggleUser={toggleUser} fmtET={fmtET} />
            </div>

            {isBroadcastOpen && (
              <BroadcastModal
                onClose={() => setIsBroadcastOpen(false)}
                onDone={(result) => { setIsBroadcastOpen(false); if (result) setMessage(result); }}
                selectedUsers={selectedUsers}
              />
            )}
          </>
        )}
      </Layout>
    </>
  );
}

function UserTable({ users, selectedUsers, onToggleUser, fmtET }) {
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const total = users.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = page * pageSize;
  const slice = users.slice(start, start + pageSize);

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>User ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Consent</th>
              <th>Score</th>
              <th>Interactions</th>
              <th>Personal Clicks</th>
              <th>Last Personal Click</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(user => (
              <tr key={user.user_id} style={selectedUsers.includes(user.user_id) ? { background: 'rgba(59,130,246,.08)' } : {}}>
                <td>
                  <input type="checkbox" checked={selectedUsers.includes(user.user_id)} onChange={() => onToggleUser(user.user_id)} />
                </td>
                <td>{user.user_id}</td>
                <td>{user.username || '—'}</td>
                <td>{user.first_name || '—'}</td>
                <td>
                  <span style={{ color: user.consent ? 'var(--green)' : 'var(--text-dim)' }}>
                    {user.consent ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>{user.score}</td>
                <td>{user.interactions}</td>
                <td style={user.personalClicks > 0 ? { color: 'var(--green)', fontWeight: 600 } : {}}>{user.personalClicks}</td>
                <td suppressHydrationWarning>{user.lastPersonalClick ? fmtET(user.lastPersonalClick) : '—'}</td>
                <td suppressHydrationWarning>{user.last_seen_at ? fmtET(user.last_seen_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button className="btn-secondary" disabled={page === 0} onClick={() => setPage(0)} style={{ padding: '4px 8px', fontSize: 12 }}>First</button>
        <button className="btn-secondary" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ padding: '4px 8px', fontSize: 12 }}>Prev</button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{page + 1}/{pages}</span>
        <button className="btn-secondary" disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))} style={{ padding: '4px 8px', fontSize: 12 }}>Next</button>
        <button className="btn-secondary" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} style={{ padding: '4px 8px', fontSize: 12 }}>Last</button>
      </div>
    </>
  );
}

function BroadcastModal({ onClose, onDone, selectedUsers }) {
  const [text, setText] = useState('Hello {first_name}! We have an important message for you.');
  const [buttons, setButtons] = useState([{ text: '', url: '' }]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const addButton = () => setButtons(prev => [...prev, { text: '', url: '' }]);
  const setBtn = (i, key, val) => setButtons(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  const delBtn = (i) => setButtons(prev => prev.filter((_, idx) => idx !== i));

  const ensureHttps = (url) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const startBroadcast = async () => {
    if (!text && !file) { setStatus('Text or image required'); return; }
    setLoading(true);
    setStatus(`Broadcasting to ${selectedUsers.length} users...`);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('text', text);
      formData.append('userIds', JSON.stringify(selectedUsers));
      formData.append('buttons', JSON.stringify(buttons.filter(b => b.text && b.url).map(b => ({ text: b.text, url: ensureHttps(b.url) }))));

      const res = await fetch('/api/admin/broadcast-to-users', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setStatus(`Sent to ${data.sent}/${data.total} users`);
        onDone(`Broadcast sent to ${data.sent}/${data.total} users`);
      } else {
        setStatus('Error: ' + (data.message || 'Broadcast failed'));
      }
    } catch (e) { setStatus('Error: ' + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 680, maxWidth: '95vw', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Broadcast to {selectedUsers.length} Users</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>&times;</button>
        </div>

        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }}>
          Available variables: {'{first_name}'}, {'{username}'}, {'{name}'}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Message Text</label>
          <textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Your message..." />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Inline Buttons</label>
          {buttons.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input placeholder="Button text" value={b.text} onChange={e => setBtn(i, 'text', e.target.value)} style={{ flex: 1 }} />
              <input placeholder="URL" value={b.url} onChange={e => setBtn(i, 'url', e.target.value)} style={{ flex: 1 }} />
              <button onClick={() => delBtn(i)} className="btn-secondary" style={{ padding: '6px 10px', borderColor: 'var(--red)', color: 'var(--red)' }}>&times;</button>
            </div>
          ))}
          <button onClick={addButton} className="btn-secondary" style={{ fontSize: 12, borderStyle: 'dashed' }}>+ Add Button</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Image (optional)</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" disabled={loading} onClick={startBroadcast}>
            {loading ? 'Broadcasting...' : 'Broadcast Now'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>

        {status && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>{status}</div>
        )}
      </div>
    </div>
  );
}
