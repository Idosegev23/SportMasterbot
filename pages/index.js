import Layout from '../components/Layout';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export async function getServerSideProps() {
  try {
    const { supabase } = require('../lib/supabase');
    if (!supabase) return { props: { quickSSR: { posts: 0, clicks: 0, personal: 0, status: '—', totalUsers: 0, avgEngagement: 0, channels: 0 } } };

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0)).toISOString();

    let posts = 0, clicks = 0, personal = 0, totalUsers = 0, avgEngagement = 0, status = '—', channels = 0;

    try {
      const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', start);
      posts = count || 0;
    } catch (_) {}

    try {
      const { count } = await supabase.from('button_analytics').select('id', { count: 'exact', head: true }).gte('clicked_at', start);
      clicks = count || 0;
    } catch (_) {}

    try {
      const { count } = await supabase.from('button_analytics').select('id', { count: 'exact', head: true }).gte('clicked_at', start).or('button_type.eq.personal_coupon,analytics_tag.ilike.pc_%');
      personal = count || 0;
    } catch (_) {}

    try {
      const { count } = await supabase.from('users').select('user_id', { count: 'exact', head: true });
      totalUsers = count || 0;
    } catch (_) {}

    try {
      const { data } = await supabase.from('user_metrics').select('score');
      if (data && data.length > 0) {
        const sum = data.reduce((acc, u) => acc + (u.score || 0), 0);
        avgEngagement = Math.round(sum / data.length * 10) / 10;
      }
    } catch (_) {}

    try {
      const { data } = await supabase.from('automation_status').select('is_running, updated_at').order('updated_at', { ascending: false }).limit(1);
      if (Array.isArray(data) && data[0]) status = data[0].is_running ? 'Running' : 'Stopped';
    } catch (_) {}

    try {
      const { count } = await supabase.from('channels').select('id', { count: 'exact', head: true }).eq('active', true);
      channels = count || 0;
    } catch (_) {}

    return { props: { quickSSR: { posts, clicks, personal, status, totalUsers, avgEngagement, channels } } };
  } catch {
    return { props: { quickSSR: { posts: 0, clicks: 0, personal: 0, status: '—', totalUsers: 0, avgEngagement: 0, channels: 0 } } };
  }
}

export default function Home({ quickSSR }) {
  const [quick, setQuick] = useState(quickSSR || {});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        setQuick(prev => ({
          ...prev,
          posts: (d?.system?.dailyStats?.predictionsPosted || 0) + (d?.system?.dailyStats?.resultsPosted || 0) + (d?.system?.dailyStats?.promosPosted || 0),
          clicks: d?.analytics?.totalClicks || prev.clicks,
          personal: d?.analytics?.personalClicks || prev.personal,
          status: d?.system?.status || prev.status,
        }));
      } catch {}
    })();
  }, []);

  return (
    <Layout>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>SportMaster Control Center</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage channels, analytics, bot controls, and manual sends.</p>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: 32 }}>
        <KPI label="Posts Today" value={quick.posts} color="var(--green)" />
        <KPI label="Clicks Today" value={quick.clicks} color="var(--accent)" />
        <KPI label="Personal Clicks" value={quick.personal} color="var(--purple)" />
        <KPI label="Total Users" value={quick.totalUsers} color="var(--yellow)" />
        <KPI label="Active Channels" value={quick.channels} color="var(--accent)" />
        <KPI label="Avg Score" value={quick.avgEngagement} color="var(--text-muted)" />
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 600, color: quick.status === 'Running' ? 'var(--green)' : 'var(--red)' }}>
            {quick.status}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Bot Status</div>
        </div>
      </div>

      {/* Quick Navigation */}
      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 12 }}>Quick Actions</h3>
      <div className="grid3" style={{ marginBottom: 32 }}>
        <NavCard href="/analytics" title="Analytics" desc="View posts, clicks, and engagement metrics" />
        <NavCard href="/channels" title="Channels" desc="Add and manage Telegram channels" />
        <NavCard href="/users" title="Users" desc="Manage users and send targeted actions" />
        <NavCard href="/admin" title="Bot Control" desc="Start/stop bot, update settings, webhook" />
        <NavCard href="/manual" title="Manual Sends" desc="Compose and send messages with formatting" />
        <NavCard href="/portal" title="Owner Portal" desc="Share portal links with channel owners" isExternal />
      </div>
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

function NavCard({ href, title, desc, isExternal }) {
  const inner = (
    <div className="card" style={{ cursor: 'pointer', textAlign: 'left', padding: '20px 24px' }}>
      <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
  if (isExternal) return inner;
  return <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>;
}
