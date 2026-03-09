// Manual Promo API - Simple version

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const TelegramManager = require('../../../lib/telegram');
    const { getChannel } = require('../../../lib/channel-config');
    const telegram = new TelegramManager();

    // Resolve channel config if channelId provided
    const requestedChannelId = req.body?.channelId;
    const channelConfig = requestedChannelId ? await getChannel(requestedChannelId) : null;
    const targetChannel = channelConfig?.channel_id || telegram.channelId;

    const withButtons = Boolean(req.body?.withButtons);
    let result;
    if (withButtons === false) {
      const content = '🎁 Special Offer!\n\nUse code now in the bot.';
      result = await telegram.bot.sendMessage(targetChannel, content, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' }]] } });
      await telegram.logPostToSupabase('promo', content, result?.message_id, {}, channelConfig);
    } else {
      result = await telegram.executePromoCommand('football', channelConfig);
    }

    res.json({
      success: true,
      message: 'Promotional message sent successfully',
      result: { messageId: result?.message_id || null, promoType: 'football', withButtons },
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      channelInfo: { channelId: process.env.CHANNEL_ID, contentType: 'promo', language: 'English' }
    });

  } catch (error) {
    console.error('❌ Promo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send promotional message',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}