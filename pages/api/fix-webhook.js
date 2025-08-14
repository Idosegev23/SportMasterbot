// Auto-fix webhook after deployment
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
    const webhookUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/webhook/telegram`
      : 'https://sportmasterbot-ccv2r9g0q-idosegev23s-projects.vercel.app/api/webhook/telegram';
    
    console.log('🔧 Auto-fixing webhook to:', webhookUrl);
    
    // Set webhook to correct URL
    const response = await fetch(`${baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook fixed successfully');
      res.status(200).json({
        success: true,
        message: 'Webhook fixed successfully',
        webhookUrl,
        data
      });
    } else {
      console.error('❌ Failed to fix webhook:', data);
      res.status(400).json({
        success: false,
        message: 'Failed to fix webhook',
        error: data
      });
    }

  } catch (error) {
    console.error('❌ Webhook fix error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}