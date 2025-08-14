// Admin API to update coupon code and offer

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { setCoupon, readSettings } = require('../../../lib/settings-store');
    if (req.method === 'GET') {
      const s = await readSettings();
      return res.status(200).json({ success: true, coupon: s.coupon });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { code, offer, scope } = req.body; // scope: 'persist' | 'once'
    if (!code || !offer) {
      return res.status(400).json({ success: false, message: 'Invalid coupon payload' });
    }
    await setCoupon({ code, offer }, scope === 'once' ? 'once' : 'persist');
    return res.status(200).json({ success: true, message: 'Coupon updated', scope: scope || 'persist' });
  } catch (error) {
    console.error('❌ Admin coupon error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

