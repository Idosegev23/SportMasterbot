import Link from 'next/link';
import { useEffect, useState } from 'react';

export async function getServerSideProps() {
  try {
    const { supabase } = require('../lib/supabase');
    if (!supabase) return { props: { quickSSR: { posts: 0, clicks: 0, personal: 0, status: '—' } } };

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0)).toISOString();

    // Posts today
    let posts = 0;
    try {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('created_at', start);
      posts = count || 0;
    } catch (_) {}

    // Clicks today
    let clicks = 0;
    try {
      const { count } = await supabase
        .from('button_analytics')
        .select('id', { count: 'exact', head: true })
        .gte('clicked_at', start);
      clicks = count || 0;
    } catch (_) {}

    // Personal clicks today
    let personal = 0;
    try {
      const { count } = await supabase
        .from('button_analytics')
        .select('id', { count: 'exact', head: true })
        .gte('clicked_at', start)
        .or('button_type.eq.personal_coupon,analytics_tag.ilike.pc_%');
      personal = count || 0;
    } catch (_) {}

    // Total users
    let totalUsers = 0;
    try {
      const { count } = await supabase
        .from('users')
        .select('user_id', { count: 'exact', head: true });
      totalUsers = count || 0;
    } catch (_) {}

    // Average engagement score
    let avgEngagement = 0;
    try {
      const { data } = await supabase
        .from('user_metrics')
        .select('score');
      if (data && data.length > 0) {
        const sum = data.reduce((acc, user) => acc + (user.score || 0), 0);
        avgEngagement = Math.round(sum / data.length * 10) / 10;
      }
    } catch (_) {}

    // Bot status from automation_status (optional)
    let status = '—';
    try {
      const { data } = await supabase
        .from('automation_status')
        .select('is_running, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (Array.isArray(data) && data[0]) status = data[0].is_running ? 'Running' : 'Stopped';
    } catch (_) {}

    return { props: { quickSSR: { posts, clicks, personal, status, totalUsers, avgEngagement } } };
  } catch {
    return { props: { quickSSR: { posts: 0, clicks: 0, personal: 0, status: '—', totalUsers: 0, avgEngagement: 0 } } };
  }
}

export default function Home({ quickSSR }) {
  const [quick, setQuick] = useState(quickSSR || { posts: 0, clicks: 0, personal: 0, status: '—', totalUsers: 0, avgEngagement: 0 });
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        setQuick({
          posts: (d?.system?.dailyStats?.predictionsPosted || 0) + (d?.system?.dailyStats?.resultsPosted || 0) + (d?.system?.dailyStats?.promosPosted || 0),
          clicks: d?.analytics?.totalClicks || 0,
          personal: d?.analytics?.personalClicks || 0,
          status: d?.system?.status || '—'
        });
      } catch {}
    })();
  }, []);
  return (
    <div className="container">
      <div className="home-hero">
<img src="/logo.png" alt="SportMaster" className="home-logo" />
<h1 className="home-title">SportMaster Telegram Bot – Control Center</h1>
        <p className="home-sub">Manage analytics, bot controls, and manual sends — brand themed.</p>
        <div className="home-actions">
          <Link href="/analytics"><button className="btn-primary">📈 Analytics</button></Link>
          <Link href="/users"><button className="btn-primary">👥 Users</button></Link>
          <Link href="/admin"><button className="btn-secondary">🛠️ Bot Control</button></Link>
          <Link href="/manual"><button className="btn-secondary">✍️ Manual Sends</button></Link>
        </div>
        <div className="kpi-grid">
          <div className="card">
            <div style={{fontSize:22, fontWeight:800, color:'#2CBF6C'}}>{quick.posts}</div>
            <div style={{opacity:.85}}>Posts Today</div>
          </div>
          <div className="card">
            <div style={{fontSize:22, fontWeight:800, color:'#A7F25C'}}>{quick.clicks}</div>
            <div style={{opacity:.85}}>Clicks Today</div>
          </div>
          <div className="card">
            <div style={{fontSize:22, fontWeight:800, color:'#F20C0C'}}>{quick.personal}</div>
            <div style={{opacity:.85}}>Personal Clicks</div>
          </div>
          <div className="card">
            <div style={{fontSize:22, fontWeight:800, color:'#3E5159'}}>{quick.totalUsers}</div>
            <div style={{opacity:.85}}>Total Users</div>
          </div>
          <div className="card">
            <div style={{fontSize:22, fontWeight:800, color:'#203140'}}>{quick.avgEngagement}</div>
            <div style={{opacity:.85}}>Avg Score</div>
          </div>
          <div className="card">
            <div style={{fontSize:18, fontWeight:600, color: quick.status === 'Running' ? '#2CBF6C' : '#F20C0C'}}>{quick.status}</div>
            <div style={{opacity:.85}}>Bot Status</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {

  // Load system status and settings on component mount + auto-start bot
  useEffect(() => {
    fetchStatus();
    fetchSettings();
    fetchBotStatus();
    autoStartBot(); // Auto-start bot when page loads
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await response.json();
      setSettings(data.settings);
      setMessage('Settings updated successfully!');
      await fetchStatus();
    } catch (error) {
      setMessage('Failed to update settings: ' + error.message);
    }
    setLoading(false);
  };

  // Bot Commands Management Functions - Updated to use Simple Bot API
  const fetchBotStatus = async () => {
    try {
      const response = await fetch('/api/simple-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });
      const data = await response.json();
      setBotStatus({
        data: {
          isRunning: data.status === 'running',
          adminUsers: [],
          commands: data.availableActions || [],
          status: data.status,
          timestamp: data.timestamp
        }
      });
    } catch (error) {
      console.error('Error fetching bot status:', error);
    }
  };

  // Auto-start bot silently when page loads
  const autoStartBot = async () => {
    try {
      console.log('🚀 Auto-starting Telegram bot...');
      const response = await fetch('/api/simple-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Bot auto-started successfully');
        await fetchBotStatus();
      } else {
        console.log('⚠️ Bot might already be running or failed to start:', data.message);
      }
    } catch (error) {
      console.error('❌ Auto-start error:', error);
    }
  };

  const startBotCommands = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simple-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      const data = await response.json();
      
      if (data.success) {
        setMessage('✅ Bot commands started successfully!');
        await fetchBotStatus();
      } else {
        setMessage('❌ Failed to start bot commands: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error starting bot commands: ' + error.message);
    }
    setLoading(false);
  };

  const stopBotCommands = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simple-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      const data = await response.json();
      
      if (data.success) {
        setMessage('🛑 Bot commands stopped');
        await fetchBotStatus();
      } else {
        setMessage('❌ Failed to stop bot commands: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error stopping bot commands: ' + error.message);
    }
    setLoading(false);
  };

  const clearBotCommands = async () => {
    if (!confirm('Are you sure you want to clear all bot commands? This will remove all existing commands.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/bot/clear-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        setMessage('🗑️ Bot commands cleared successfully!');
        await fetchBotStatus();
      } else {
        setMessage('❌ Failed to clear bot commands: ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error clearing bot commands: ' + error.message);
    }
    setLoading(false);
  };

  const startSystem = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/start', { method: 'POST' });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus();
    } catch (error) {
      setMessage('Failed to start system: ' + error.message);
    }
    setLoading(false);
  };

  const sendPredictions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/manual/predictions', { method: 'POST' });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus();
    } catch (error) {
      setMessage('Failed to send predictions: ' + error.message);
    }
    setLoading(false);
  };

  const sendResults = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/manual/results', { method: 'POST' });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus();
    } catch (error) {
      setMessage('Failed to send results: ' + error.message);
    }
    setLoading(false);
  };

  const sendPromo = async (promoType = 'football') => {
    setLoading(true);
    try {
      const response = await fetch('/api/manual/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoType })
      });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus();
    } catch (error) {
      setMessage('Failed to send promo: ' + error.message);
    }
    setLoading(false);
  };

  const sendBonus = async () => {
    const bonusText = prompt('Enter bonus message (in Amharic):');
    if (!bonusText) return;

    setLoading(true);
    try {
      const response = await fetch('/api/manual/bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonusText })
      });
      const data = await response.json();
      setMessage(data.message);
      await fetchStatus();
    } catch (error) {
      setMessage('Failed to send bonus: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h1>🎯 SportMaster Dynamic Automated Posts</h1>
<p>Smart content system for @africansportdata Telegram channel</p>
        <p><strong>Language:</strong> English | <strong>Timezone:</strong> Africa/Addis_Ababa | <strong>Website:</strong> {settings?.websiteUrl || 't.me/Sportmsterbot'}</p>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '8px 16px',
              backgroundColor: showSettings ? '#e74c3c' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {showSettings ? '🔒 Hide Settings' : '⚙️ Show Settings'}
          </button>
          <button 
            onClick={() => setShowBotCommands(!showBotCommands)}
            style={{
              padding: '8px 16px',
              backgroundColor: showBotCommands ? '#e74c3c' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {showBotCommands ? '🤖 Hide Bot Commands' : '🤖 Bot Commands'}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          border: '2px solid #f39c12'
        }}>
          <h2>⚙️ System Settings</h2>
          
          {/* Website URL */}
          <div style={{ marginBottom: '20px' }}>
            <h3>🌐 Website URL</h3>
            <input
              type="text"
              value={settings.websiteUrl}
              onChange={(e) => setSettings({...settings, websiteUrl: e.target.value})}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
              placeholder="t.me/Sportmsterbot"
            />
          </div>

          {/* Promo Codes */}
          <div style={{ marginBottom: '20px' }}>
            <h3>🎁 Promo Codes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {Object.entries(settings.promoCodes).map(([key, value]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontWeight: 'bold', textTransform: 'capitalize' }}>{key}:</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setSettings({
                      ...settings,
                      promoCodes: { ...settings.promoCodes, [key]: e.target.value }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bonus Offers */}
          <div style={{ marginBottom: '20px' }}>
            <h3>💰 Bonus Offers</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {Object.entries(settings.bonusOffers).map(([key, value]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontWeight: 'bold', textTransform: 'capitalize' }}>{key}:</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setSettings({
                      ...settings,
                      bonusOffers: { ...settings.bonusOffers, [key]: e.target.value }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '3px'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Auto Posting Settings */}
          <div style={{ marginBottom: '20px' }}>
            <h3>🤖 Auto Posting</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={settings.autoPosting.dynamicTiming}
                  onChange={(e) => setSettings({
                    ...settings,
                    autoPosting: { ...settings.autoPosting, dynamicTiming: e.target.checked }
                  })}
                />
                Dynamic Match-Based Timing
              </label>
              
              <div>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Hours Before Match:</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={settings.autoPosting.hoursBeforeMatch}
                  onChange={(e) => setSettings({
                    ...settings,
                    autoPosting: { ...settings.autoPosting, hoursBeforeMatch: parseInt(e.target.value) }
                  })}
                  style={{
                    width: '80px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '3px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Min Gap Between Posts (min):</label>
                <input
                  type="number"
                  min="15"
                  max="120"
                  value={settings.autoPosting.minGapBetweenPosts}
                  onChange={(e) => setSettings({
                    ...settings,
                    autoPosting: { ...settings.autoPosting, minGapBetweenPosts: parseInt(e.target.value) }
                  })}
                  style={{
                    width: '80px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '3px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Save Settings Button */}
          <button
            onClick={() => updateSettings(settings)}
            disabled={loading}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '⏳ Saving...' : '💾 Save Settings'}
          </button>
        </div>
      )}

      {/* Bot Commands Panel */}
      {showBotCommands && (
        <div style={{
          backgroundColor: '#fff8e1',
          border: '2px solid #ffc107',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
          <h2>🤖 Telegram Bot Admin Commands</h2>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
            <strong>📱 Status:</strong> {botStatus?.data?.isRunning ? '✅ Active' : '❌ Stopped'} |
            <strong> 👥 Admins:</strong> {botStatus?.data?.adminUsers?.length || 0} configured |
            <strong> 📋 Commands:</strong> {botStatus?.data?.commands?.length || 0} available
          </div>

          {/* Bot Control Buttons */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={startBotCommands}
              disabled={loading || botStatus?.data?.isRunning}
              style={{
                padding: '12px 20px',
                backgroundColor: botStatus?.data?.isRunning ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading || botStatus?.data?.isRunning ? 'not-allowed' : 'pointer',
                opacity: loading || botStatus?.data?.isRunning ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Starting...' : '🚀 Start Bot Commands'}
            </button>
            
            <button
              onClick={stopBotCommands}
              disabled={loading || !botStatus?.data?.isRunning}
              style={{
                padding: '12px 20px',
                backgroundColor: !botStatus?.data?.isRunning ? '#6c757d' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading || !botStatus?.data?.isRunning ? 'not-allowed' : 'pointer',
                opacity: loading || !botStatus?.data?.isRunning ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Stopping...' : '🛑 Stop Bot Commands'}
            </button>

            <button
              onClick={clearBotCommands}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: '#fd7e14',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Clearing...' : '🗑️ Clear Commands'}
            </button>

            <button
              onClick={fetchBotStatus}
              style={{
                padding: '12px 20px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh Status
            </button>
          </div>

          {/* Available Commands */}
          <div style={{ marginBottom: '20px' }}>
            <h3>📋 Available Admin Commands:</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '10px' }}>
              {botStatus?.data?.commands?.map((command, index) => (
                <div key={index} style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '5px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'monospace',
                  fontSize: '14px'
                }}>
                  {command}
                </div>
              )) || [
                '/start - Main Menu with buttons',
                '/help - Commands List (English)',
                '/predictions - Send Match Predictions',
                '/results - Send Match Results',
                '/promo - Send Promo Message',
                '/live - Live Matches Now',
                '/today - Today Games',
                '/status - System Status'
              ].map((command, index) => (
                <div key={index} style={{ 
                  padding: '10px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '5px',
                  border: '1px solid #dee2e6',
                  fontFamily: 'monospace',
                  fontSize: '14px'
                }}>
                  {command}
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Help */}
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '8px', border: '1px solid #bee5eb' }}>
            <h4>🔧 Configuration:</h4>
            <ol style={{ margin: '10px 0' }}>
              <li><strong>Get your Telegram ID:</strong> Send a message to <code>@userinfobot</code> on Telegram</li>
              <li><strong>Add your ID to .env:</strong> <code>ADMIN_USER_IDS=your_telegram_id_here</code></li>
              <li><strong>Restart the system</strong> to apply changes</li>
              <li><strong>Start Bot Commands</strong> using the button above</li>
              <li><strong>Test commands</strong> by sending them to your bot on Telegram</li>
            </ol>
            <p style={{ margin: '10px 0', fontStyle: 'italic', color: '#0c5460' }}>
              💡 <strong>Tip:</strong> Only users listed in ADMIN_USER_IDS can use these commands. Make sure your bot token is correct in the .env file.
            </p>
          </div>
        </div>
      )}

      {/* System Status */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        <h2>🔧 System Status</h2>
        {systemStatus ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div style={{ padding: '15px', backgroundColor: systemStatus.system.status === 'running' ? '#e8f5e8' : '#ffe8e8', borderRadius: '5px' }}>
              <strong>Status:</strong> {systemStatus.system.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '5px' }}>
              <strong>Ethiopian Time:</strong><br/>{systemStatus.ethiopianTime}
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
              <strong>Today's Posts:</strong><br/>
              Predictions: {systemStatus.system.dailyStats?.predictionsPosted || 0}<br/>
              Results: {systemStatus.system.dailyStats?.resultsPosted || 0}<br/>
              Promos: {systemStatus.system.dailyStats?.promosPosted || 0}
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fff8e1', borderRadius: '5px' }}>
              <strong>Errors:</strong> {systemStatus.system.dailyStats?.errors || 0}<br/>
              <strong>Total Clicks:</strong> {systemStatus.analytics?.totalClicks || 0}
            </div>
          </div>
        ) : (
          <p>Loading system status...</p>
        )}
      </div>

      {/* Control Panel */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        <h2>🎮 Control Panel</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <button 
            onClick={startSystem}
            disabled={loading}
            style={{
              padding: '15px',
              fontSize: '16px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            🚀 Start System
          </button>
          
          <button 
            onClick={sendPredictions}
            disabled={loading}
            style={{
              padding: '15px',
              fontSize: '16px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            ⚽ Send Predictions
          </button>
          
          <button 
            onClick={sendResults}
            disabled={loading}
            style={{
              padding: '15px',
              fontSize: '16px',
              backgroundColor: '#9b59b6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            📊 Send Results
          </button>
          
          <button 
            onClick={() => sendPromo('football')}
            disabled={loading}
            style={{
              padding: '15px',
              fontSize: '16px',
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            🎁 Send Football Promo
          </button>
          
          <button 
            onClick={() => sendPromo('casino')}
            disabled={loading}
            style={{
              padding: '15px',
              fontSize: '16px',
              backgroundColor: '#f39c12',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            🎰 Send Casino Promo
          </button>
          
          <button 
            onClick={sendBonus}
            disabled={loading}
            style={{
              padding: '15px',
              fontSize: '16px',
              backgroundColor: '#1abc9c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            💰 Send Custom Bonus
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <p>⏳ Processing...</p>
          </div>
        )}

        {message && (
          <div style={{
            padding: '15px',
            backgroundColor: message.includes('Failed') ? '#ffe8e8' : '#e8f5e8',
            borderRadius: '5px',
            marginTop: '15px'
          }}>
            <strong>Message:</strong> {message}
          </div>
        )}
      </div>

      {/* Schedule Information */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        <h2>📅 New Dynamic Schedule System</h2>
        <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#d4edda', borderRadius: '5px', color: '#155724' }}>
          <strong>✅ UPGRADED: Real-time match-based scheduling now active!</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
            <h3>🌅 Daily Setup (6:00 AM)</h3>
            <p>📅 Loads today's Top 5 matches</p>
            <p>📊 Enhanced team statistics</p>
            <p>🎯 Calculates optimal prediction times</p>
            <p>🔤 Language: English</p>
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f3e5f5', borderRadius: '5px' }}>
            <h3>⏰ Smart Timing (Every 30 min)</h3>
            <p>📅 Checks if it's time to post predictions</p>
            <p>📍 2-3 hours before each match</p>
      <p>🎁 Code: {settings?.promoCodes?.default || 'SM100'}</p>
{settings?.websiteUrl ? <p>🌐 Website: {settings.websiteUrl}</p> : null}
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#fff3e0', borderRadius: '5px' }}>
            <h3>📊 Daily Results (9 PM)</h3>
            <p>📅 Evening summary</p>
            <p>📍 Yesterday's completed matches</p>
            <p>🔤 Language: English</p>
            <p>🚫 No mock data - only real results</p>
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#fff3e0', borderRadius: '5px' }}>
            <h3>🎁 Daily Promos</h3>
            <p>📅 10 AM, 2 PM, 6 PM</p>
            <p>📍 Dynamic bonus codes & offers</p>
            <p>🔤 Language: English</p>
            <p>💰 Codes: {Object.keys(settings?.promoCodes || {}).slice(0, 3).join(', ')}</p>
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '5px' }}>
            <h3>📈 Analytics & Monitoring</h3>
            <p>📅 Real-time + daily reports</p>
            <p>📍 Click tracking & performance</p>
            <p>🔗 <a href="/api/analytics" target="_blank">View Analytics</a></p>
            <p>⚽ Live match monitoring</p>
          </div>
        </div>
        
        {/* Dynamic Features Info */}
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f0f8ff', 
          borderRadius: '5px',
          border: '1px solid #3498db'
        }}>
          <h4>🤖 Smart Features Active:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>✅ Dynamic timing based on real match schedules</li>
            <li>✅ Top 5 match selection using smart algorithms</li>
            <li>✅ No mock data - only real football data</li>
            <li>✅ Customizable promo codes and website URL</li>
            <li>✅ English content optimized for betting enthusiasts</li>
          </ul>
        </div>
      </div>

      {/* API Documentation */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        <h2>📖 API Endpoints</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>GET /api/status</strong><br/>
            Get system status and statistics
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>POST /api/start</strong><br/>
            Start the automated system
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>POST /api/manual/predictions</strong><br/>
            Send predictions manually
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>POST /api/manual/results</strong><br/>
            Send results manually
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>POST /api/manual/promo</strong><br/>
            Send promotional message
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>POST /api/manual/bonus</strong><br/>
            Send custom bonus message
          </div>
          
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontFamily: 'monospace' }}>
            <strong>GET /api/analytics</strong><br/>
            View click tracking analytics
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '20px',
        color: '#666',
        borderTop: '1px solid #ddd',
        marginTop: '20px'
      }}>
      <p>🎯 SportMaster Daily Automated Posts System v1.0</p>
<p>🤖 Bot: @Sportmsterbot | 🔗 Channel: @africansportdata | 🌍 Timezone: Africa/Addis_Ababa</p>
      </div>
    </div>
  );
}