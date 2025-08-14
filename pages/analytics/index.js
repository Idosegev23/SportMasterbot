import React from 'react';
import Head from 'next/head';
import Layout from '../../components/Layout';

export async function getServerSideProps({ query }) {
  const { supabase } = require('../../lib/supabase');

  if (!supabase) {
    return { props: { error: 'Supabase not configured', data: null } };
  }

  // Time window via query (?range=7|30|90)
  const ranges = { '7': 7, '30': 30, '90': 90 };
  const days = ranges[String(query.range)] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const tab = ['overview', 'posts', 'clicks', 'personal', 'views'].includes(String(query.tab)) ? String(query.tab) : 'overview';

  // Fetch posts
  const { data: postsRaw } = await supabase
    .from('posts')
    .select('id, content, content_type, status, language, telegram_message_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  // Fetch button analytics
  const { data: clicksRaw } = await supabase
    .from('button_analytics')
    .select('id, user_id, button_type, analytics_tag, url_clicked, utm_source, utm_medium, utm_campaign, utm_content, clicked_at')
    .gte('clicked_at', since)
    .order('clicked_at', { ascending: false })
    .limit(5000);

  const posts = Array.isArray(postsRaw) ? postsRaw : [];
  const clicks = Array.isArray(clicksRaw) ? clicksRaw : [];

  // Users and metrics
  const { data: usersRaw } = await supabase
    .from('users')
    .select('user_id, username, first_name, last_name, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(500);
  const { data: metricsRaw } = await supabase
    .from('user_metrics')
    .select('user_id, score, interactions_count, last_update')
    .order('last_update', { ascending: false })
    .limit(1000);
  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const metrics = Array.isArray(metricsRaw) ? metricsRaw : [];

  // Aggregate posts by type
  const postsByType = posts.reduce((acc, p) => {
    const k = p.content_type || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // Aggregate clicks by utm_content and button_type
  const clicksByContent = clicks.reduce((acc, c) => {
    const k = c.utm_content || c.analytics_tag || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const clicksByButtonType = clicks.reduce((acc, c) => {
    const k = c.button_type || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // Personal coupon metrics
  const personalClicks = clicks.filter(c => c.button_type === 'personal_coupon' || String(c.analytics_tag || '').startsWith('pc_'));
  const uniquePersonalUsers = new Set(personalClicks.map(c => c.user_id).filter(Boolean)).size;

  const topPersonalUsers = (() => {
    const map = new Map();
    for (const c of personalClicks) {
      if (!c.user_id) continue;
      map.set(c.user_id, (map.get(c.user_id) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([user,count])=>({ user, count }));
  })();

  // Build enriched users list with metrics and personal-clicks
  const clicksByUser = personalClicks.reduce((acc,c)=>{
    if (!c.user_id) return acc; const u=String(c.user_id); acc[u]=(acc[u]||0)+1; return acc;
  }, {});
  const lastPersonalClickAt = personalClicks.reduce((acc,c)=>{
    if (!c.user_id) return acc; const u=String(c.user_id); const t=c.clicked_at; if (!acc[u] || t>acc[u]) acc[u]=t; return acc;
  }, {});
  const metricsMap = new Map(metrics.map(m=>[String(m.user_id), m]));
  const enrichedUsers = users.map(u=>{
    const k=String(u.user_id);
    const m=metricsMap.get(k) || {};
    return {
      user_id: u.user_id,
      username: u.username || '',
      first_name: u.first_name || '',
      last_seen_at: u.last_seen_at || null,
      score: m.score ?? 0,
      interactions: m.interactions_count ?? 0,
      personalClicks: clicksByUser[k] || 0,
      lastPersonalClick: lastPersonalClickAt[k] || null
    };
  }).sort((a,b)=> (b.personalClicks - a.personalClicks) || (b.score - a.score)).slice(0,100);

  // Time series per day
  function dateKey(ts) {
    const d = new Date(ts);
    return d.toISOString().slice(0, 10);
  }

  const postsDaily = posts.reduce((acc, p) => {
    const k = dateKey(p.created_at);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const clicksDaily = clicks.reduce((acc, c) => {
    const k = dateKey(c.clicked_at);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // Top lists
  const topButtons = Object.entries(clicksByContent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));

  const recentPosts = posts.slice(0, 25);
  const recentClicks = clicks.slice(0, 25);
  
  // Views (from telegram_message_stats)
  const { data: viewsRaw } = await supabase
    .from('telegram_message_stats')
    .select('message_id, views, forwards, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(200);
  const recentViews = Array.isArray(viewsRaw) ? viewsRaw : [];
  const latestByMsg = new Map();
  for (const row of recentViews) {
    if (!latestByMsg.has(row.message_id)) latestByMsg.set(row.message_id, row);
  }
  const viewsSummary = Array.from(latestByMsg.values())
    .sort((a,b)=> (b.views - a.views))
    .slice(0, 50)
    .map(v => ({ message_id: v.message_id, views: v.views, forwards: v.forwards }));

  // Freshness
  const lastPostAt = recentPosts[0]?.created_at || null;
  const lastClickAt = recentClicks[0]?.clicked_at || null;

  const data = {
    totals: {
      posts: posts.length,
      clicks: clicks.length,
      personalCouponClicks: personalClicks.length,
      personalCouponUniqueUsers: uniquePersonalUsers,
    },
    postsByType,
    clicksByButtonType,
    topButtons,
    topPersonalUsers,
    postsDaily,
    clicksDaily,
    recentPosts,
    recentClicks,
    lastPostAt,
    lastClickAt,
    enrichedUsers,
    recentViews,
    viewsSummary
  };

  const lastUpdated = new Date().toISOString();
  return { props: { error: null, data, days, lastUpdated, tab } };
}

export default function AnalyticsPage({ error, data, days, lastUpdated, tab }) {
  const fmtET = (ts) => {
    try { return new Date(ts).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }); } catch { return ts || '—'; }
  };
  return (
    <>
      <Head>
        <title>Channel Analytics Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Layout>
      <main className="page">
        <header className="hdr">
          <div className="row">
            <div>
              <h1>Channel Analytics</h1>
              <p className="muted">Overview of posts, clicks, personal coupons and views</p>
            </div>
            <div className="filters">
              <div className="btns">
                {([7,30,90]).map((d) => (
                  <a key={d} href={`?range=${d}&tab=${tab}`} className={`btn ${Number(days)===d?'active':''}`}>{d}d</a>
                ))}
              </div>
            </div>
          </div>
          <div className="muted small">Last updated: <span suppressHydrationWarning>{fmtET(lastUpdated)}</span></div>
          <nav className="tabs">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'posts', label: 'Posts' },
              { key: 'clicks', label: 'Clicks' },
              { key: 'personal', label: 'Personal Coupons' },
              { key: 'views', label: 'Views' },
            ].map(t => (
              <a key={t.key} href={`?range=${days}&tab=${t.key}`} className={`tab ${tab===t.key?'active':''}`}>{t.label}</a>
            ))}
          </nav>
        </header>

        {error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <section className="cards">
                  <StatCard label="Total Posts" value={data.totals.posts} />
                  <StatCard label="Total Clicks" value={data.totals.clicks} />
                  <StatCard label="Personal Coupon Clicks" value={data.totals.personalCouponClicks} />
                  <StatCard label="Unique Personal Users" value={data.totals.personalCouponUniqueUsers} />
                </section>
                <section className="cards">
                  <StatCard label="Last Post" value={<span suppressHydrationWarning>{data.lastPostAt ? fmtET(data.lastPostAt) : '—'}</span>} />
                  <StatCard label="Last Click" value={<span suppressHydrationWarning>{data.lastClickAt ? fmtET(data.lastClickAt) : '—'}</span>} />
                </section>
                <section className="grid2">
                  <Panel title="Daily Activity (last days)">
                    <MiniSeries postsDaily={data.postsDaily} clicksDaily={data.clicksDaily} />
                  </Panel>
                  <Panel title="Top Buttons (utm_content / tag)">
                    <Table rows={data.topButtons} columns={[{ key: 'id', label: 'Tag' }, { key: 'count', label: 'Clicks' }]} />
                  </Panel>
                </section>
              </>
            )}

            {tab === 'posts' && (
              <>
                <section className="grid2">
                  <Panel title="Posts by Type">
                    <BarList data={objectToPairs(data.postsByType)} />
                  </Panel>
                  <Panel title="Recent Posts">
                    <Table
                      rows={data.recentPosts.map(p => ({
                        when: <span suppressHydrationWarning>{fmtET(p.created_at)}</span>,
                        type: p.content_type,
                        status: p.status,
                        msg: p.telegram_message_id || '-',
                      }))}
                      columns={[{ key: 'when', label: 'When (ET)' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'msg', label: 'Msg ID' }]}
                    />
                  </Panel>
                </section>
              </>
            )}

            {tab === 'clicks' && (
              <>
                <section className="grid2">
                  <Panel title="Clicks by Button Type">
                    <BarList data={objectToPairs(data.clicksByButtonType)} />
                  </Panel>
                  <Panel title="Recent Clicks">
                    <Table
                      rows={data.recentClicks.map(c => ({
                        when: <span suppressHydrationWarning>{fmtET(c.clicked_at)}</span>,
                        type: c.button_type,
                        tag: c.utm_content || c.analytics_tag || '-',
                        user: c.user_id || '-',
                      }))}
                      columns={[{ key: 'when', label: 'When (ET)' }, { key: 'type', label: 'Type' }, { key: 'tag', label: 'Tag' }, { key: 'user', label: 'User' }]}
                    />
                  </Panel>
                </section>
              </>
            )}

            {tab === 'personal' && (
              <>
                <section className="cards">
                  <StatCard label="Personal Coupon Clicks" value={data.totals.personalCouponClicks} />
                  <StatCard label="Unique Personal Users" value={data.totals.personalCouponUniqueUsers} />
                </section>
                <section className="grid2">
                  <Panel title="Top Users (by personal clicks)">
                    <Table rows={data.topPersonalUsers} columns={[{ key: 'user', label: 'User ID' }, { key: 'count', label: 'Clicks' }]} />
                  </Panel>
                  <Panel title="Top Buttons (utm_content / tag)">
                    <Table rows={data.topButtons} columns={[{ key: 'id', label: 'Tag' }, { key: 'count', label: 'Clicks' }]} />
                  </Panel>
                </section>
                <section>
                  <Panel title="Users (enriched)">
                    <Table rows={data.enrichedUsers.map(u=>({
                      user_id: u.user_id,
                      username: u.username,
                      first_name: u.first_name,
                      interactions: u.interactions,
                      score: u.score,
                      personal: u.personalClicks,
                      last_click: <span suppressHydrationWarning>{u.lastPersonalClick ? fmtET(u.lastPersonalClick) : '—'}</span>,
                      last_seen: <span suppressHydrationWarning>{u.last_seen_at ? fmtET(u.last_seen_at) : '—'}</span>
                    }))} columns={[
                      { key: 'user_id', label: 'User ID' },
                      { key: 'username', label: 'Username' },
                      { key: 'first_name', label: 'Name' },
                      { key: 'interactions', label: 'Interactions' },
                      { key: 'score', label: 'Score' },
                      { key: 'personal', label: 'Personal Clicks' },
                      { key: 'last_click', label: 'Last Personal Click' },
                      { key: 'last_seen', label: 'Last Seen' }
                    ]} />
                  </Panel>
                </section>
              </>
            )}

            {tab === 'views' && (
              <>
                <section className="controls-row">
                  <RefreshViewsButton />
                </section>
                <section className="grid2">
                  <Panel title="Latest Fetched Views">
                    <ViewsTable
                      rows={data.recentViews}
                      fmtET={fmtET}
                    />
                  </Panel>
                  <Panel title="Top Messages by Views (latest)">
                    <Table
                      rows={data.viewsSummary}
                      columns={[{ key: 'message_id', label: 'Msg ID' }, { key: 'views', label: 'Views' }, { key: 'forwards', label: 'Forwards' }]}
                      exportName="top_messages"
                    />
                  </Panel>
                </section>
              </>
            )}
          </>
        )}
      </main>
      </Layout>

      <style jsx>{`
        :global(html, body, #__next) { height: 100%; background: #0b0f1a; color: #e7ecf2; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        .page { padding: 28px; max-width: 1200px; margin: 0 auto; }
        .hdr h1 { margin: 0; font-size: 28px; }
        .muted { opacity: .8; margin: 6px 0 18px; }
        .error { background: #2a1220; border: 1px solid #7a3b56; padding: 12px 14px; border-radius: 8px; }
        .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        @media (min-width: 900px) { .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .grid2 { display: grid; grid-template-columns: 1fr; gap: 14px; margin-bottom: 18px; }
        @media (min-width: 900px) { .grid2 { grid-template-columns: 1fr 1fr; } }
        .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .filters { margin: 0; }
        .btns { display: flex; gap: 6px; }
        .btn { background: rgba(255,255,255,.06); color: #e7ecf2; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 6px 10px; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn.active { background: linear-gradient(135deg, #6aa6ff, #3c86ff); color: #0b0f1a; border-color: transparent; }
        .tabs { display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,.08); margin-top: 6px; }
        .tab { padding: 8px 12px; border-radius: 10px 10px 0 0; background: rgba(255,255,255,.04); color: #e7ecf2; text-decoration: none; border: 1px solid rgba(255,255,255,.08); border-bottom: none; }
        .tab.active { background: #141a2b; color: #9fe3ff; }
        .small { font-size: 12px; }
      `}</style>
    </>
  );
}

function objectToPairs(obj) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}

function StatCard({ label, value }) {
  return (
    <div className="card">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      <style jsx>{`
        .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 16px; }
        .v { font-size: 28px; font-weight: 800; }
        .l { opacity: .8; }
      `}</style>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <div className="ph"><h3>{title}</h3></div>
      <div className="pc">{children}</div>
      <style jsx>{`
        .panel { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; }
        .ph { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .pc { padding: 12px 14px; }
        h3 { margin: 0; font-size: 16px; }
      `}</style>
    </section>
  );
}

function BarList({ data }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="barlist">
      {data.map((d, i) => (
        <div className="row" key={i}>
          <span className="label">{d.label}</span>
          <div className="bar">
            <div className="fill" style={{ width: `${(d.value / max) * 100}%` }} />
            <span className="val">{d.value}</span>
          </div>
        </div>
      ))}
      <style jsx>{`
        .row { display: grid; grid-template-columns: 1fr 2fr; align-items: center; gap: 10px; margin: 6px 0; }
        .label { opacity: .9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; position: relative; height: 22px; display: flex; align-items: center; padding: 0 8px; }
        .fill { position: absolute; inset: 0; background: linear-gradient(135deg, #6aa6ff, #3c86ff); border-radius: 999px; opacity: .35; }
        .val { position: relative; z-index: 1; font-weight: 700; font-size: 12px; }
      `}</style>
    </div>
  );
}

function Table({ rows, columns, pageSize = 10, exportName = 'table' }) {
  const [page, setPage] = React.useState(0);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = page * pageSize;
  const slice = rows.slice(start, start + pageSize);
  const getText = (val) => {
    if (val == null) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(getText).join(' ');
    if (val.props && val.props.children != null) return getText(val.props.children);
    try { return String(val); } catch { return ''; }
  };
  const exportCsv = () => {
    const header = columns.map(c => '"' + c.label.replace(/"/g,'""') + '"').join(',');
    const lines = rows.map(r => columns.map(c => {
      const t = getText(r[c.key]);
      return '"' + t.replace(/"/g,'""') + '"';
    }).join(',')).join('\n');
    const csv = header + '\n' + lines;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="tbl-wrap">
      <div className="tbl-actions">
        <button onClick={exportCsv}>Export CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map(c => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {slice.map((r, i) => (
            <tr key={i}>
              {columns.map(c => <td key={c.key}>{r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button disabled={page===0} onClick={()=>setPage(0)}>⏮</button>
        <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>◀</button>
        <span>{page+1}/{pages} • {total} rows</span>
        <button disabled={page>=pages-1} onClick={()=>setPage(p=>Math.min(pages-1,p+1))}>▶</button>
        <button disabled={page>=pages-1} onClick={()=>setPage(pages-1)}>⏭</button>
      </div>
      <style jsx>{`
        .tbl-wrap { overflow: auto; }
        .tbl-actions { display:flex; justify-content:flex-end; padding: 6px 0; }
        .tbl-actions button { background: rgba(255,255,255,.06); color: #e7ecf2; border: 1px solid rgba(255,255,255,.1); border-radius: 6px; padding: 4px 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 13px; }
        thead th { position: sticky; top: 0; background: rgba(11,15,26,.95); z-index: 1; }
        .pager { display:flex; gap:8px; align-items:center; justify-content:flex-end; padding:8px 0; }
        .pager button { background: rgba(255,255,255,.06); color: #e7ecf2; border: 1px solid rgba(255,255,255,.1); border-radius: 6px; padding: 4px 8px; }
        .pager span { opacity: .85; font-size: 12px; }
      `}</style>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
      <style jsx>{`
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index: 1000; }
        .modal { background: #0f1526; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; width: min(780px, 92vw); max-height: 82vh; overflow: auto; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .modal-body { padding: 14px; white-space: pre-wrap; line-height: 1.5; }
        .close { background: transparent; border: none; color: #e7ecf2; font-size: 18px; cursor: pointer; }
      `}</style>
    </div>
  );
}

function ViewsTable({ rows, fmtET }) {
  const [page, setPage] = React.useState(0);
  const pageSize = 10;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = page * pageSize;
  const slice = rows.slice(start, start + pageSize);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [post, setPost] = React.useState(null);

  const onRowClick = async (messageId) => {
    setOpen(true);
    setLoading(true);
    setError('');
    setPost(null);
    try {
      const res = await fetch(`/api/posts/by-message/${encodeURIComponent(messageId)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load post');
      setPost(data.post);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="tbl-wrap">
        <div className="tbl-actions">
          <span className="muted small">Click a row to preview post</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fetched (ET)</th>
              <th>Msg ID</th>
              <th>Views</th>
              <th>Forwards</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((v, i) => (
              <tr key={i} className="clickable" onClick={()=>onRowClick(v.message_id)}>
                <td><span suppressHydrationWarning>{fmtET(v.fetched_at)}</span></td>
                <td>{v.message_id}</td>
                <td>{v.views}</td>
                <td>{v.forwards || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button disabled={page===0} onClick={()=>setPage(0)}>⏮</button>
          <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>◀</button>
          <span>{page+1}/{pages} • {total} rows</span>
          <button disabled={page>=pages-1} onClick={()=>setPage(p=>Math.min(pages-1,p+1))}>▶</button>
          <button disabled={page>=pages-1} onClick={()=>setPage(pages-1)}>⏭</button>
        </div>
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title={post ? `Post #${post.id} (${post.content_type})` : 'Loading post...'}>
        {loading && <div>⏳ טוען...</div>}
        {error && <div className="error">❌ {error}</div>}
        {post && (
          <div>
            <div className="meta">
              <div><b>Created:</b> <span suppressHydrationWarning>{fmtET(post.created_at)}</span></div>
              <div><b>Msg ID:</b> {post.telegram_message_id || '-'}</div>
              <div><b>Status:</b> {post.status}</div>
              <div><b>Lang:</b> {post.language}</div>
            </div>
            <pre className="content">{post.content}</pre>
            <style jsx>{`
              .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
              .content { background: #0b0f1a; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 12px; white-space: pre-wrap; }
            `}</style>
          </div>
        )}
    </Modal>

      <style jsx>{`
        .tbl-wrap { overflow: auto; }
        .tbl-actions { display:flex; justify-content:space-between; padding: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 13px; }
        thead th { position: sticky; top: 0; background: rgba(11,15,26,.95); z-index: 1; }
        tr.clickable { cursor: pointer; }
        tr.clickable:hover { background: rgba(255,255,255,.04); }
        .pager { display:flex; gap:8px; align-items:center; justify-content:flex-end; padding:8px 0; }
        .pager button { background: rgba(255,255,255,.06); color: #e7ecf2; border: 1px solid rgba(255,255,255,.1); border-radius: 6px; padding: 4px 8px; }
        .pager span { opacity: .85; font-size: 12px; }
      `}</style>
    </>
  );
}

function RefreshViewsButton() {
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const refreshViews = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/refresh-views', { method: 'POST' });
      const data = await res.json();
      setMessage(data.message);
      if (data.success) {
        // Refresh page after successful update
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      setMessage('❌ שגיאה: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="refresh-views">
      <button onClick={refreshViews} disabled={loading} className="refresh-btn">
        {loading ? '🔄 מעדכן...' : '🔄 רענן צפיות'}
      </button>
      {message && <span className="refresh-msg">{message}</span>}
      <style jsx>{`
        .refresh-views { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
        .refresh-btn { 
          background: linear-gradient(135deg, #2CBF6C, #A7F25C); 
          color: #0b0f1a; 
          border: none; 
          border-radius: 8px; 
          padding: 8px 16px; 
          cursor: pointer; 
          font-weight: 600;
        }
        .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .refresh-msg { font-size: 14px; color: #e7ecf2; }
        .controls-row { margin-bottom: 16px; }
      `}</style>
    </div>
  );
}

function MiniSeries({ postsDaily, clicksDaily }) {
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    return { 
      key: key.slice(5), // Show MM-DD only
      posts: postsDaily[key] || 0, 
      clicks: clicksDaily[key] || 0 
    };
  });
  const max = Math.max(1, ...days.map(d => Math.max(d.posts, d.clicks)));
  
  return (
    <div className="series">
      <div className="chart-container">
        <svg viewBox="0 0 400 200" className="chart">
          <defs>
            <linearGradient id="postsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6aa6ff" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#6aa6ff" stopOpacity="0.2"/>
            </linearGradient>
            <linearGradient id="clicksGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff8a6a" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#ff8a6a" stopOpacity="0.2"/>
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <line key={y} x1="40" y1={y * 2} x2="380" y2={y * 2} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
          ))}
          
          {/* Data lines */}
          <polyline
            fill="url(#postsGradient)"
            stroke="#6aa6ff"
            strokeWidth="2"
            points={days.map((d, i) => `${40 + i * 24},${180 - (d.posts / max) * 140}`).join(' ')}
          />
          <polyline
            fill="none"
            stroke="#ff8a6a"
            strokeWidth="2"
            points={days.map((d, i) => `${40 + i * 24},${180 - (d.clicks / max) * 140}`).join(' ')}
          />
          
          {/* Data points */}
          {days.map((d, i) => (
            <g key={i}>
              <circle cx={40 + i * 24} cy={180 - (d.posts / max) * 140} r="3" fill="#6aa6ff"/>
              <circle cx={40 + i * 24} cy={180 - (d.clicks / max) * 140} r="3" fill="#ff8a6a"/>
            </g>
          ))}
          
          {/* Labels */}
          {days.map((d, i) => (
            <text key={i} x={40 + i * 24} y="195" textAnchor="middle" fill="#e7ecf2" fontSize="10" opacity="0.7">
              {d.key}
            </text>
          ))}
        </svg>
      </div>
      <div className="legend">
        <div className="legend-item">
          <div className="legend-color" style={{background: '#6aa6ff'}}></div>
          <span>Posts</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{background: '#ff8a6a'}}></div>
          <span>Clicks</span>
        </div>
      </div>
      <style jsx>{`
        .series { }
        .chart-container { width: 100%; height: 200px; margin-bottom: 12px; }
        .chart { width: 100%; height: 100%; }
        .legend { display: flex; gap: 16px; justify-content: center; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
        .legend-color { width: 12px; height: 12px; border-radius: 2px; }
      `}</style>
    </div>
  );
}

