// Admin API to update inline buttons layout

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { setButtons, readSettings } = require('../../../lib/settings-store');
    if (req.method === 'GET') {
      const s = await readSettings();
      return res.status(200).json({ success: true, settings: s.buttons });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { buttons, scope } = req.body; // scope: 'persist' | 'once'
    if (!Array.isArray(buttons) || buttons.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid buttons payload' });
    }
    await setButtons(buttons, scope === 'once' ? 'once' : 'persist');
    return res.status(200).json({ success: true, message: 'Buttons updated', scope: scope || 'persist' });
  } catch (error) {
    console.error('❌ Admin buttons error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

