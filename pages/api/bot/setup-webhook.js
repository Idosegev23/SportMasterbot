// Auto-setup Telegram webhook for production
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    const baseUrl = `https://api.telegram.org/bot${token}`;
    
    // Determine webhook URL
    const webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/webhook/telegram`
      : `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/webhook/telegram`;
    
    console.log('🌐 Setting up webhook:', webhookUrl);
    
    // Set webhook
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
      console.log('✅ Webhook set successfully');
      res.status(200).json({
        success: true,
        message: 'Webhook configured successfully',
        webhookUrl,
        data
      });
    } else {
      console.error('❌ Failed to set webhook:', data);
      res.status(400).json({
        success: false,
        message: 'Failed to configure webhook',
        error: data
      });
    }

  } catch (error) {
    console.error('❌ Webhook setup error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}