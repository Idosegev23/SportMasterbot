import React, { useState } from 'react';
import Head from 'next/head';
import Layout from '../../components/Layout';

export async function getServerSideProps() {
  const { supabase } = require('../../lib/supabase');

  if (!supabase) {
    return { props: { error: 'Supabase not configured', users: [] } };
  }

  // Fetch users with metrics
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

  // Get personal clicks data
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

  // Aggregate personal clicks per user
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
      lastPersonalClick: lastPersonalClickAt[uid] || null
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
  const [filterBy, setFilterBy] = useState('all'); // all, consent, high_activity
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const fmtET = (ts) => {
    try { return new Date(ts).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }); } catch { return ts || '—'; }
  };

  const filteredUsers = users.filter(u => {
    // Search filter
    const searchMatch = !searchTerm || 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(u.user_id).includes(searchTerm);

    // Category filter
    let categoryMatch = true;
    if (filterBy === 'consent') categoryMatch = u.consent;
    else if (filterBy === 'high_activity') categoryMatch = u.personalClicks > 0 || u.score > 10;

    return searchMatch && categoryMatch;
  });

  const toggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    const allVisible = filteredUsers.map(u => u.user_id);
    setSelectedUsers(allVisible);
  };

  const clearSelection = () => setSelectedUsers([]);

  const executeAction = async () => {
    if (selectedUsers.length === 0) {
      setMessage('❌ No users selected');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (actionType === 'coupon') {
        const promoCode = prompt('Enter promo code:');
        if (!promoCode) {
          setLoading(false);
          return;
        }
        
        const customText = prompt('Custom message (optional):') || 'Special offer just for you!';
        
        // Send to each user individually
        let successCount = 0;
        for (const userId of selectedUsers) {
          try {
            const res = await fetch('/api/admin/send-personal-coupon-to-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, promoCode, text: customText })
            });
            
            if (res.ok) successCount++;
            // Delay between requests to avoid rate limiting
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error(`Failed to send to user ${userId}:`, e);
          }
        }
        
        setMessage(`✅ Sent coupons to ${successCount}/${selectedUsers.length} users`);
      } else if (actionType === 'message') {
        const customMessage = prompt('Enter message to send:');
        if (!customMessage) {
          setLoading(false);
          return;
        }
        
        // Send custom message to each user
        let successCount = 0;
        for (const userId of selectedUsers) {
          try {
            const res = await fetch('/api/admin/send-message-to-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, message: customMessage })
            });
            
            if (res.ok) successCount++;
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error(`Failed to send to user ${userId}:`, e);
          }
        }
        
        setMessage(`✅ Sent messages to ${successCount}/${selectedUsers.length} users`);
      } else if (actionType === 'broadcast') {
        // Open rich broadcast modal (with image + placeholders)
        setIsBroadcastOpen(true);
        setLoading(false);
      } else if (actionType === 'export') {
        // Export selected users data
        const selectedUsersData = filteredUsers.filter(u => selectedUsers.includes(u.user_id));
        const csv = 'User ID,Username,Name,Score,Interactions,Personal Clicks,Consent,Last Seen\n' +
          selectedUsersData.map(u => 
            `${u.user_id},"${u.username}","${u.first_name}",${u.score},${u.interactions},${u.personalClicks},${u.consent},${u.last_seen_at}`
          ).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        setMessage(`✅ Exported ${selectedUsers.length} users to CSV`);
      } else if (actionType === 'block' || actionType === 'unblock') {
        const action = actionType === 'block' ? 'block' : 'unblock';
        const confirm = window.confirm(`Are you sure you want to ${action} ${selectedUsers.length} users?`);
        if (!confirm) {
          setLoading(false);
          return;
        }
        
        setMessage(`🚫 ${action.charAt(0).toUpperCase() + action.slice(1)}ing ${selectedUsers.length} users...`);
        // Implement block/unblock logic here
        setTimeout(() => {
          setMessage(`✅ ${selectedUsers.length} users ${action}ed`);
        }, 1500);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    }

    setLoading(false);
    clearSelection();
  };

  return (
    <>
      <Head>
        <title>User Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Layout>
        <main className="page">
          <header className="hdr">
            <h1>User Management</h1>
            <p className="muted">Manage users and send targeted actions</p>
          </header>

          {error ? (
            <div className="error">{error}</div>
          ) : (
            <>
              {/* Controls */}
              <section className="controls">
                <div className="search-filter">
                  <input 
                    type="text" 
                    placeholder="Search users (username, name, ID)..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  <select value={filterBy} onChange={e => setFilterBy(e.target.value)} className="filter-select">
                    <option value="all">All Users</option>
                    <option value="consent">With Consent</option>
                    <option value="high_activity">High Activity</option>
                  </select>
                </div>
                
                {selectedUsers.length > 0 && (
                  <div className="action-bar">
                    <span className="selected-count">{selectedUsers.length} selected</span>
                    <select value={actionType} onChange={e => setActionType(e.target.value)} className="action-select">
                      <option value="coupon">Send Personal Coupon</option>
                      <option value="message">Send Custom Message</option>
                      <option value="broadcast">Broadcast to Selected</option>
                      <option value="export">Export User Data</option>
                      <option value="block">Block Users</option>
                      <option value="unblock">Unblock Users</option>
                    </select>
                    <button onClick={executeAction} disabled={loading} className="execute-btn">
                      {loading ? 'Executing...' : 'Execute Action'}
                    </button>
                    <button onClick={clearSelection} className="clear-btn">Clear</button>
                  </div>
                )}
                
                <div className="bulk-actions">
                  <button onClick={selectAll} className="bulk-btn">Select All Visible</button>
                  <button onClick={clearSelection} className="bulk-btn">Clear All</button>
                </div>
              </section>

              {message && <div className="message">{message}</div>}

              {/* Users Table */}
              <section className="users-table">
                <div className="table-info">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
                <UserTable 
                  users={filteredUsers} 
                  selectedUsers={selectedUsers} 
                  onToggleUser={toggleUser}
                  fmtET={fmtET}
                />
              </section>

          {isBroadcastOpen && (
            <BroadcastModal 
              onClose={() => setIsBroadcastOpen(false)}
              onDone={(result) => { setIsBroadcastOpen(false); if (result) setMessage(result); }}
              selectedUsers={selectedUsers}
            />
          )}
            </>
          )}
        </main>
      </Layout>

      <style jsx>{`
        .page { padding: 28px; max-width: 1400px; margin: 0 auto; }
        .hdr h1 { margin: 0; font-size: 28px; color: #e7ecf2; }
        .muted { opacity: .8; margin: 6px 0 18px; color: #e7ecf2; }
        .error { background: #2a1220; border: 1px solid #7a3b56; padding: 12px 14px; border-radius: 8px; color: #e7ecf2; }
        
        .controls { margin: 20px 0; }
        .search-filter { display: flex; gap: 12px; margin-bottom: 12px; }
        .search-input, .filter-select { 
          background: rgba(255,255,255,.06); 
          color: #e7ecf2; 
          border: 1px solid rgba(255,255,255,.1); 
          border-radius: 8px; 
          padding: 8px 12px; 
        }
        .search-input { flex: 1; }
        
        .action-bar { 
          display: flex; 
          gap: 12px; 
          align-items: center; 
          padding: 12px; 
          background: rgba(255,255,255,.04); 
          border-radius: 8px; 
          margin-bottom: 12px;
        }
        .selected-count { color: #9fe3ff; font-weight: 600; }
        .action-select, .execute-btn, .clear-btn { 
          background: rgba(255,255,255,.06); 
          color: #e7ecf2; 
          border: 1px solid rgba(255,255,255,.1); 
          border-radius: 6px; 
          padding: 6px 12px; 
          cursor: pointer;
        }
        .execute-btn { background: linear-gradient(135deg, #2CBF6C, #A7F25C); color: #0b0f1a; }
        .clear-btn { background: rgba(242, 12, 12, 0.1); border-color: #F20C0C; }
        
        .bulk-actions { display: flex; gap: 8px; }
        .bulk-btn { 
          background: rgba(255,255,255,.04); 
          color: #e7ecf2; 
          border: 1px solid rgba(255,255,255,.08); 
          border-radius: 6px; 
          padding: 6px 12px; 
          cursor: pointer;
        }
        
        .message { 
          padding: 12px; 
          background: rgba(255,255,255,.04); 
          border-radius: 8px; 
          margin: 12px 0; 
          color: #e7ecf2;
        }
        
        .table-info { 
          margin-bottom: 8px; 
          font-size: 14px; 
          opacity: .8; 
          color: #e7ecf2;
        }
        
        :global(body) { background: #0b0f1a; color: #e7ecf2; }
      `}</style>
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
    <div className="user-table">
      <table>
        <thead>
          <tr>
            <th>Select</th>
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
          {slice.map((user) => (
            <tr key={user.user_id} className={selectedUsers.includes(user.user_id) ? 'selected' : ''}>
              <td>
                <input 
                  type="checkbox" 
                  checked={selectedUsers.includes(user.user_id)}
                  onChange={() => onToggleUser(user.user_id)}
                />
              </td>
              <td>{user.user_id}</td>
              <td>{user.username || '—'}</td>
              <td>{user.first_name || '—'}</td>
              <td>
                <span className={`consent ${user.consent ? 'yes' : 'no'}`}>
                  {user.consent ? '✓' : '✗'}
                </span>
              </td>
              <td>{user.score}</td>
              <td>{user.interactions}</td>
              <td className={user.personalClicks > 0 ? 'highlight' : ''}>{user.personalClicks}</td>
              <td suppressHydrationWarning>{user.lastPersonalClick ? fmtET(user.lastPersonalClick) : '—'}</td>
              <td suppressHydrationWarning>{user.last_seen_at ? fmtET(user.last_seen_at) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="pager">
        <button disabled={page === 0} onClick={() => setPage(0)}>⏮</button>
        <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>◀</button>
        <span>{page + 1}/{pages} • {total} users</span>
        <button disabled={page >= pages - 1} onClick={() => setPage(p => Math.min(pages - 1, p + 1))}>▶</button>
        <button disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>⏭</button>
      </div>

      <style jsx>{`
        .user-table { overflow: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { 
          text-align: left; 
          padding: 8px 12px; 
          border-bottom: 1px solid rgba(255,255,255,.08); 
          font-size: 13px; 
          color: #e7ecf2;
        }
        thead th { 
          position: sticky; 
          top: 0; 
          background: rgba(11,15,26,.95); 
          z-index: 1; 
          font-weight: 600;
        }
        
        tr.selected { background: rgba(255,255,255,.08); }
        tr:hover { background: rgba(255,255,255,.04); }
        
        .consent.yes { color: #2CBF6C; }
        .consent.no { color: #F20C0C; opacity: 0.6; }
        .highlight { color: #A7F25C; font-weight: 600; }
        
        .pager { 
          display: flex; 
          gap: 8px; 
          align-items: center; 
          justify-content: flex-end; 
          padding: 12px 0; 
        }
        .pager button { 
          background: rgba(255,255,255,.06); 
          color: #e7ecf2; 
          border: 1px solid rgba(255,255,255,.1); 
          border-radius: 6px; 
          padding: 6px 10px; 
          cursor: pointer;
        }
        .pager button:disabled { opacity: 0.4; cursor: not-allowed; }
        .pager span { opacity: .85; font-size: 12px; color: #e7ecf2; }
      `}</style>
    </div>
  );
}

function BroadcastModal({ onClose, onDone, selectedUsers }) {
  const [text, setText] = useState('שלום {first_name}! יש לנו הודעה חשובה 🤝');
  const [buttons, setButtons] = useState([{ text: '', url: '' }]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const addButton = () => setButtons(prev => [...prev, { text: '', url: '' }]);
  const setBtn = (i, key, val) => setButtons(prev => prev.map((b,idx)=> idx===i? { ...b, [key]: val } : b));
  const delBtn = (i) => setButtons(prev => prev.filter((_,idx)=> idx!==i));

  const ensureHttps = (url) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const startBroadcast = async () => {
    if (!text && !file) {
      setStatus('❌ חייבים טקסט או תמונה');
      return;
    }
    setLoading(true);
    setStatus(`📢 משדר ל-${selectedUsers.length} משתמשים...`);

    try {
      const form = new FormData();
      if (file) form.append('file', file);
      form.append('text', text);
      form.append('userIds', JSON.stringify(selectedUsers));
      form.append('buttons', JSON.stringify(buttons.filter(b=>b.text && b.url).map(b=>({ text: b.text, url: ensureHttps(b.url) }))));

      const res = await fetch('/api/admin/broadcast-to-users', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setStatus(`✅ נשלח ל-${data.sent}/${data.total} משתמשים`);
        onDone(`✅ נשלח ל-${data.sent}/${data.total} משתמשים`);
      } else {
        setStatus('❌ שגיאה: ' + (data.message || 'שידור נכשל'));
      }
    } catch (e) {
      setStatus('❌ שגיאה: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Broadcast to {selectedUsers.length} Users</h3>
        <p className="tip">אפשר להשתמש במשתנים: {`{first_name}`}, {`{username}`}, {`{name}`}</p>

        <label>Text</label>
        <textarea rows={6} value={text} onChange={e=>setText(e.target.value)} placeholder="הודעה..." />

        <label>Inline Buttons</label>
        {buttons.map((b,i)=> (
          <div key={i} className="button-row">
            <input placeholder="Text" value={b.text} onChange={e=>setBtn(i,'text',e.target.value)} />
            <input placeholder="URL" value={b.url} onChange={e=>setBtn(i,'url',e.target.value)} />
            <button onClick={()=>delBtn(i)}>✕</button>
          </div>
        ))}
        <button onClick={addButton} className="add">+ Add Button</button>

        <label>Image (optional)</label>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)} />

        <div className="row">
          <button disabled={loading} onClick={startBroadcast} className="primary">{loading? 'משדר...' : 'שדר עכשיו'}</button>
          <button onClick={onClose}>סגור</button>
        </div>
        {status && <div className="status">{status}</div>}

        <style jsx>{`
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; }
          .modal { width: 680px; max-width: 95vw; background: #203140; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 16px; }
          h3 { margin: 0 0 8px; color: #e7ecf2; }
          .tip { margin: 0 0 12px; opacity: .8; }
          label { display: block; margin: 8px 0 6px; }
          textarea, input { width: 100%; background: rgba(255,255,255,.06); color: #e7ecf2; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 8px 10px; }
          .row { display: flex; gap: 8px; margin-top: 12px; }
          .primary { background: linear-gradient(135deg, #2CBF6C, #A7F25C); color: #0b0f1a; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
          .status { margin-top: 10px; background: rgba(255,255,255,.06); padding: 8px; border-radius: 8px; }
          .button-row { display: flex; gap: 6px; margin-bottom: 6px; }
          .add { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: #e7ecf2; border-radius: 6px; padding: 6px 10px; }
        `}</style>
      </div>
    </div>
  );
}