// Setup Telegram Webhook
// Use this to switch from polling to webhook mode

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    const baseUrl = `https://api.telegram.org/bot${token}`;

    if (action === 'set') {
      // Set webhook - FORCE use of stable domain
      const webhookUrl = process.env.PUBLIC_BASE_URL 
        ? `${process.env.PUBLIC_BASE_URL}/api/webhook/telegram`
        : 'https://idosegev23.vercel.app/api/webhook/telegram';
      
      const response = await fetch(`${baseUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        res.status(200).json({
          success: true,
          message: 'Webhook set successfully',
          webhookUrl,
          data
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to set webhook',
          error: data
        });
      }

    } else if (action === 'delete') {
      // Delete webhook (return to polling)
      const response = await fetch(`${baseUrl}/deleteWebhook`, {
        method: 'POST'
      });

      const data = await response.json();
      
      res.status(200).json({
        success: data.ok,
        message: data.ok ? 'Webhook deleted successfully' : 'Failed to delete webhook',
        data
      });

    } else if (action === 'info') {
      // Get webhook info
      const response = await fetch(`${baseUrl}/getWebhookInfo`);
      const data = await response.json();
      
      res.status(200).json({
        success: true,
        data: data.result
      });

    } else {
      res.status(400).json({ error: 'Invalid action. Use: set, delete, or info' });
    }

  } catch (error) {
    console.error('❌ Webhook setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}