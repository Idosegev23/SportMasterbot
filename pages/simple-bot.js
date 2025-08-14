// 🤖 Simple Bot Management Interface
// Clean interface for the new simple bot

import { useState, useEffect } from 'react';

export default function SimpleBotManager() {
  const [botStatus, setBotStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch bot status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/simple-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });
      const data = await response.json();
      setBotStatus(data);
    } catch (error) {
      setMessage('Failed to fetch status: ' + error.message);
    }
  };

  // Bot action handler
  const handleBotAction = async (action) => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/simple-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await response.json();
      setMessage(data.message);
      
      // Refresh status after action
      await fetchStatus();
      
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
    
    setLoading(false);
  };

  // Clear commands handler
  const handleClearCommands = async () => {
    if (!confirm('האם אתה בטוח שאתה רוצה למחוק את כל הפקודות? פעולה זו תמחק את כל הפקודות הקיימות בבוט.')) {
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/bot/clear-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      setMessage(data.message);
      
    } catch (error) {
      setMessage('Error clearing commands: ' + error.message);
    }
    
    setLoading(false);
  };

  // Load status on mount
  useEffect(() => {
    fetchStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isRunning = botStatus?.status === 'running';

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif' 
    }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '30px',
        borderRadius: '15px',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '2.5rem' }}>
          🤖 Simple Bot Manager
        </h1>
        <p style={{ margin: 0, fontSize: '1.2rem', opacity: 0.9 }}>
          Clean & Direct Bot Commands
        </p>
      </div>

      {/* Status Card */}
      <div style={{ 
        background: isRunning ? '#e7f5e7' : '#ffeaea',
        border: `2px solid ${isRunning ? '#28a745' : '#dc3545'}`,
        borderRadius: '12px',
        padding: '25px',
        marginBottom: '25px'
      }}>
        <h2 style={{ 
          margin: '0 0 15px 0',
          color: isRunning ? '#28a745' : '#dc3545',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {isRunning ? '✅' : '❌'} Bot Status: {isRunning ? 'RUNNING' : 'STOPPED'}
        </h2>
        
        {botStatus && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <strong>Ethiopian Time:</strong><br/>
              {botStatus.ethiopianTime}
            </div>
            <div>
              <strong>Memory Usage:</strong><br/>
              {Math.round(botStatus.memoryUsage?.used / 1024 / 1024)}MB
            </div>
            <div>
              <strong>Uptime:</strong><br/>
              {Math.floor(botStatus.uptime / 3600)}h {Math.floor((botStatus.uptime % 3600) / 60)}m
            </div>
            <div>
              <strong>Instance:</strong><br/>
              {botStatus.instance ? 'Active' : 'Inactive'}
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div style={{ 
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '25px',
        marginBottom: '25px'
      }}>
        <h3 style={{ margin: '0 0 20px 0' }}>🎮 Bot Controls</h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '15px' 
        }}>
          <button
            onClick={() => handleBotAction('start')}
            disabled={loading || isRunning}
            style={{
              background: isRunning ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: isRunning || loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🚀 Start Bot
          </button>
          
          <button
            onClick={() => handleBotAction('stop')}
            disabled={loading || !isRunning}
            style={{
              background: !isRunning ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: !isRunning || loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🛑 Stop Bot
          </button>
          
          <button
            onClick={() => handleBotAction('restart')}
            disabled={loading}
            style={{
              background: loading ? '#6c757d' : '#ffc107',
              color: loading ? 'white' : 'black',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🔄 Restart Bot
          </button>
          
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🔍 Refresh
          </button>
          
          <button
            onClick={handleClearCommands}
            disabled={loading}
            style={{
              background: loading ? '#6c757d' : '#fd7e14',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            🗑️ Clear Commands
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div style={{ 
          background: message.includes('Error') || message.includes('Failed') ? '#f8d7da' : '#d4edda',
          color: message.includes('Error') || message.includes('Failed') ? '#721c24' : '#155724',
          border: `1px solid ${message.includes('Error') || message.includes('Failed') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '25px'
        }}>
          <strong>
            {message.includes('Error') || message.includes('Failed') ? '❌' : '✅'} 
          </strong> {message}
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        background: '#e9ecef',
        borderRadius: '12px',
        padding: '25px'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>📱 How to Use the Bot</h3>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li><strong>Start the bot</strong> using the "Start Bot" button above</li>
          <li><strong>Open Telegram</strong> and find your bot</li>
          <li><strong>Send /start or /help</strong> to see the menu and commands</li>
          <li><strong>Use buttons or commands</strong> to send predictions, promos, etc.</li>
          <li><strong>Only admins</strong> can use the bot (defined in ADMIN_USER_IDS)</li>
        </ol>
        
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#fff3cd', 
          border: '1px solid #ffeaa7',
          borderRadius: '8px'
        }}>
          <strong>🔑 Admin Access:</strong> Your Telegram User ID must be set in ADMIN_USER_IDS variable to use the bot.
        </div>

        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          background: '#ffeaa7', 
          border: '1px solid #ffc107',
          borderRadius: '8px'
        }}>
          <strong>🗑️ Old Commands:</strong> If you see old commands in the bot, click "Clear Commands" then restart the bot.
        </div>

        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          background: '#d1ecf1', 
          border: '1px solid #bee5eb',
          borderRadius: '8px'
        }}>
          <strong>🆕 New Commands:</strong> /start, /help, /predictions, /results, /promo, /live, /today, /status
        </div>
      </div>

      <div style={{ 
        textAlign: 'center', 
        marginTop: '30px', 
        color: '#6c757d',
        fontSize: '0.9rem'
      }}>
        Simple Bot Manager v1.0 | {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}