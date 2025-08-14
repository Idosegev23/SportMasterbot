// Vercel Cron endpoint for daily summary at 00:00 EAT (21:00 UTC)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🕛 Cron: Executing daily summary (00:00 EAT)...');

    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sportmasterbot-ccv2r9g0q-idosegev23s-projects.vercel.app');

    const resp = await fetch(`${baseUrl}/api/manual/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const data = await resp.json();

    return res.status(200).json({ success: true, triggered: true, manualResponse: data });
  } catch (error) {
    console.error('❌ Cron summary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to execute daily summary', error: error.message });
  }
}

