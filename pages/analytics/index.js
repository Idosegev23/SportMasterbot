import Layout from '../../components/Layout';
import Link from 'next/link';

export async function getServerSideProps() {
  try {
    const { supabase } = require('../../lib/supabase');
    if (!supabase) return { props: { initialData: null } };

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    const [
      { count: totalPosts },
      { count: todayPosts },
      { count: totalClicks },
      { count: todayClicks },
      { count: totalUsers },
      { data: channels },
      { data: recentPosts },
      { data: topViews },
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('button_analytics').select('*', { count: 'exact', head: true }),
      supabase.from('button_analytics').select('*', { count: 'exact', head: true }).gte('clicked_at', today),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('channels').select('channel_id, display_name, active, language, coupon_code').eq('active', true),
      supabase.from('posts').select('id, content_type, channel_id, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('telegram_message_stats').select('message_id, views, forwards').order('views', { ascending: false }).limit(10),
    ]);

    const [
      { count: predToday },
      { count: resToday },
      { count: promoToday },
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('content_type', 'predictions').gte('created_at', today),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('content_type', 'results').gte('created_at', today),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('content_type', 'promo').gte('created_at', today),
    ]);

    let channelStats = [];
    if (channels && channels.length > 0) {
      channelStats = await Promise.all(channels.map(async (ch) => {
        const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('channel_id', ch.channel_id);
        const { count: todayC } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('channel_id', ch.channel_id).gte('created_at', today);
        return { ...ch, totalPosts: count || 0, todayPosts: todayC || 0 };
      }));
    }

    return {
      props: {
        initialData: {
          totalPosts: totalPosts || 0, todayPosts: todayPosts || 0,
          totalClicks: totalClicks || 0, todayClicks: todayClicks || 0,
          totalUsers: totalUsers || 0,
          predToday: predToday || 0, resToday: resToday || 0, promoToday: promoToday || 0,
          channels: channelStats, recentPosts: recentPosts || [], topViews: topViews || [],
        }
      }
    };
  } catch (err) {
    console.error('Analytics SSR error:', err);
    return { props: { initialData: null } };
  }
}

export default function AnalyticsPage({ initialData }) {
  const d = initialData || {};

  if (!initialData) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <h2>Analytics Unavailable</h2>
          <p style={{ color: 'var(--text-muted)' }}>Could not connect to database. Check Supabase configuration.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Analytics</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Real-time overview of channels, posts, and engagement.</p>
      </div>

      {/* Main KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <KPI label="Total Posts" value={d.totalPosts} color="var(--accent)" />
        <KPI label="Today's Posts" value={d.todayPosts} color="var(--green)" />
        <KPI label="Total Clicks" value={d.totalClicks} color="var(--yellow)" />
        <KPI label="Today's Clicks" value={d.todayClicks} color="var(--red)" />
        <KPI label="Total Users" value={d.totalUsers} color="var(--purple)" />
      </div>

      {/* Today's Content */}
      <div className="panel">
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Today's Content</h3>
        <div className="grid3">
          <ContentCard type="Predictions" count={d.predToday} color="var(--accent)" />
          <ContentCard type="Results" count={d.resToday} color="var(--green)" />
          <ContentCard type="Promos" count={d.promoToday} color="var(--yellow)" />
        </div>
      </div>

      {/* Per-Channel Stats */}
      {d.channels?.length > 0 && (
        <div className="panel">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Channel Performance</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Language</th>
                  <th>Coupon</th>
                  <th>Total Posts</th>
                  <th>Today</th>
                </tr>
              </thead>
              <tbody>
                {d.channels.map(ch => (
                  <tr key={ch.channel_id}>
                    <td>
                      <strong>{ch.display_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ch.channel_id}</div>
                    </td>
                    <td>{ch.language}</td>
                    <td><code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{ch.coupon_code}</code></td>
                    <td style={{ fontWeight: 600 }}>{ch.totalPosts}</td>
                    <td style={{ fontWeight: 600, color: 'var(--green)' }}>{ch.todayPosts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Viewed */}
      {d.topViews?.length > 0 && (
        <div className="panel">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Top Viewed Messages</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {d.topViews.map((m, i) => (
              <div key={m.message_id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>#{i + 1} — Message {m.message_id}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <span><strong>{m.views}</strong> views</span>
                  <span><strong>{m.forwards}</strong> forwards</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Posts */}
      {d.recentPosts?.length > 0 && (
        <div className="panel">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Recent Posts</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            {d.recentPosts.map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: 13,
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: typeColor(p.content_type), color: '#fff',
                  }}>
                    {p.content_type || 'post'}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{p.channel_id}</span>
                </div>
                <span style={{ color: 'var(--text-dim)' }}>
                  {new Date(p.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

function KPI({ label, value, color }) {
  return (
    <div className="card">
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ContentCard({ type, count, color }) {
  return (
    <div className="card">
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{count}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{type}</div>
    </div>
  );
}

function typeColor(type) {
  const map = { predictions: '#3b82f6', results: '#22c55e', promo: '#eab308', news: '#a855f7', today_hype: '#ef4444', summary: '#6366f1' };
  return map[type] || '#5a6a7d';
}
