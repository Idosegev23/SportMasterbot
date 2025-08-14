export const config = { api: { bodyParser: false } };

import formidable from 'formidable';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const form = formidable({ multiples: false, keepExtensions: false });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
    });

    const text = String(fields.text || '');
    let userIds = [];
    try { userIds = JSON.parse(fields.userIds || '[]'); } catch (_) {}
    let buttons = [];
    try { buttons = JSON.parse(fields.buttons || '[]'); } catch (_) {}

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No users provided' });
    }

    const TelegramManager = require('../../../lib/telegram');
    const telegram = new TelegramManager();

    const inline_keyboard = [ ...buttons.filter(b=>b.text && b.url).map(b=>([{ text: b.text, url: b.url }])) ];
    const optsBase = { parse_mode: 'HTML', reply_markup: { inline_keyboard } };

    // If image provided, upload once to get file_id, then reuse
    let photoFileId = null;
    if (files?.file?.filepath) {
      const fs = require('fs');
      const stream = fs.createReadStream(files.file.filepath);
      try {
        const msg = await telegram.bot.sendPhoto(process.env.CHANNEL_ID, stream, { caption: '.', disable_notification: true });
        photoFileId = msg.photo?.[msg.photo.length - 1]?.file_id || null;
      } catch (e) {
        console.error('Failed to upload reference photo:', e.message);
      } finally {
        try { fs.unlink(files.file.filepath, ()=>{}); } catch (_) {}
      }
    }

    const personalize = (template, user) => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username || '';
      return String(template || '')
        .replaceAll('{first_name}', user.first_name || '')
        .replaceAll('{username}', user.username ? '@' + user.username : '')
        .replaceAll('{name}', name);
    };

    // Fetch basic user info for personalization from Supabase if available
    let userMap = new Map();
    try {
      const { supabase } = require('../../../lib/supabase');
      if (supabase) {
        const { data } = await supabase.from('users').select('user_id, username, first_name, last_name').in('user_id', userIds);
        if (Array.isArray(data)) userMap = new Map(data.map(u => [String(u.user_id), u]));
      }
    } catch (_) {}

    let sent = 0;
    for (const uid of userIds) {
      const user = userMap.get(String(uid)) || { first_name: '', last_name: '', username: '' };
      const textPersonal = personalize(text, user);
      const opts = { ...optsBase };

      try {
        if (photoFileId) {
          await telegram.bot.sendPhoto(uid, photoFileId, { caption: textPersonal, ...opts });
        } else if (textPersonal) {
          await telegram.bot.sendMessage(uid, textPersonal, opts);
        } else {
          continue;
        }
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${uid}:`, e.message);
      }

      // small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    return res.status(200).json({ success: true, sent, total: userIds.length });
  } catch (error) {
    console.error('broadcast-to-users error', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

