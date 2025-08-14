// EMERGENCY KILL SWITCH - Immediate bot shutdown
export default async function handler(req, res) {
  console.log('🚨 EMERGENCY KILL ACTIVATED! Stopping bot immediately...');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    // IMMEDIATELY delete webhook to stop all incoming messages, and drop pending updates (clear queue)
    console.log('🔄 EMERGENCY: Deleting webhook NOW (drop_pending_updates=true)...');
    const deleteResponse = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true })
    });
    const deleteData = await deleteResponse.json();

    // Fetch webhook info to report status and pending_update_count
    const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoData = await infoResponse.json();

    console.log('🆘 EMERGENCY KILL COMPLETED');

    res.status(200).json({
      success: true,
      message: 'EMERGENCY KILL EXECUTED - Bot is now OFFLINE',
      webhookDeleted: deleteData.ok,
      webhookInfo: infoData.ok ? infoData.result : infoData,
      timestamp: new Date().toISOString(),
      status: 'BOT_OFFLINE'
    });

  } catch (error) {
    console.error('❌ Emergency kill error:', error);
    res.status(500).json({ 
      error: 'Emergency kill failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}