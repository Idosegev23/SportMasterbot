// Telegram Stats via MTProto (gramJS)
// Minimal wrapper to fetch message views for channel posts

// Use dynamic imports to avoid bundling issues during build
let ApiRef = null;
let TelegramClientRef = null;
let StringSessionRef = null;

class TelegramStats {
  constructor() {
    this.apiId = Number(process.env.TELEGRAM_API_ID || 0);
    this.apiHash = process.env.TELEGRAM_API_HASH || '';
    this.session = null; // will be initialized after dynamic import
    this.client = null;
  }

  async ensureClient() {
    if (this.client) return this.client;
    if (!this.apiId || !this.apiHash) throw new Error('Missing TELEGRAM_API_ID/TELEGRAM_API_HASH');
    if (!ApiRef || !TelegramClientRef || !StringSessionRef) {
      const mod = await import('telegram');
      const sessions = await import('telegram/sessions');
      ApiRef = mod.Api;
      TelegramClientRef = mod.TelegramClient;
      StringSessionRef = sessions.StringSession;
    }
    this.session = new StringSessionRef(process.env.TELEGRAM_SESSION || '');
    this.client = new TelegramClientRef(this.session, this.apiId, this.apiHash, {
      connectionRetries: 3,
    });
    if (!this.client.connected) {
      await this.client.connect();
    }
    return this.client;
  }

  // Resolve @channelUsername to InputPeer
  async resolvePeer(peer) {
    const client = await this.ensureClient();
    return await client.getEntity(peer);
  }

  // Get views for messageIds in a channel (does not increment)
  async getMessageViews(channelUsername, messageIds = []) {
    const client = await this.ensureClient();
    const peer = await this.resolvePeer(channelUsername);
    const result = await client.invoke(
      new ApiRef.messages.GetMessagesViews({
        peer,
        id: messageIds,
        increment: false,
      })
    );
    // result.views is array of MessageViews { views, forwards, replies? }
    const views = (result.views || []).map((v, idx) => ({
      msg_id: messageIds[idx],
      views: Number(v.views || 0),
      forwards: Number(v.forwards || 0),
    }));
    return views;
  }

  // Get channel message history for a specific date range
  async getChannelHistory(channelUsername, fromDate, toDate, limit = 100) {
    try {
      const client = await this.ensureClient();
      const peer = await this.resolvePeer(channelUsername);
      
      console.log('🔍 מחפש הודעות בהיסטוריית הערוץ...');
      
      // Get messages using getHistory
      const result = await client.invoke(
        new ApiRef.messages.GetHistory({
          peer,
          limit,
          offsetDate: Math.floor(toDate.getTime() / 1000),
          offsetId: 0,
          maxId: 0,
          minId: 0,
          addOffset: 0,
          hash: BigInt(0)
        })
      );
      
      if (!result.messages) {
        console.log('⚠️ לא נמצאו הודעות בהיסטוריה');
        return [];
      }
      
      // Filter messages by date range
      const filteredMessages = result.messages.filter(msg => {
        const msgDate = new Date(msg.date * 1000);
        return msgDate >= fromDate && msgDate <= toDate;
      });
      
      console.log(`📨 נמצאו ${filteredMessages.length} הודעות בטווח התאריכים`);
      
      // Format messages
      return filteredMessages.map(msg => ({
        id: msg.id,
        date: msg.date,
        message: msg.message || '',
        media: msg.media ? 'has_media' : null,
        views: msg.views || 0,
        forwards: msg.forwards || 0,
        fromId: msg.fromId,
        peerId: msg.peerId
      }));
      
    } catch (error) {
      console.error('❌ שגיאה בקריאת היסטוריית הערוץ:', error.message);
      return [];
    }
  }
}

module.exports = TelegramStats;

