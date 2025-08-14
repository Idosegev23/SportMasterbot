// 🌐 Telegram Webhook Manager - Clears webhooks to prevent 409 conflicts
// This ensures clean polling startup without webhook interference

const axios = require('axios');

class TelegramWebhookManager {
  constructor(botToken) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * 🔍 Get current webhook info
   */
  async getWebhookInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/getWebhookInfo`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getting webhook info:', error.message);
      return null;
    }
  }

  /**
   * 🗑️ Delete webhook to enable polling
   */
  async deleteWebhook() {
    try {
      console.log('🗑️ Clearing webhook to enable polling...');
      
      const response = await axios.post(`${this.baseUrl}/deleteWebhook`, {
        drop_pending_updates: true
      });
      
      if (response.data.ok) {
        console.log('✅ Webhook cleared successfully');
        return true;
      } else {
        console.error('❌ Failed to clear webhook:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Error clearing webhook:', error.message);
      return false;
    }
  }

  /**
   * 🔧 Clear webhook and prepare for polling
   */
  async prepareForPolling() {
    try {
      // Get current webhook status
      const webhookInfo = await this.getWebhookInfo();
      
      if (webhookInfo && webhookInfo.result && webhookInfo.result.url) {
        console.log(`🌐 Found existing webhook: ${webhookInfo.result.url}`);
        console.log('🔄 Clearing webhook to prevent 409 conflicts...');
        
        const cleared = await this.deleteWebhook();
        if (cleared) {
          // Wait a moment for Telegram to process the change
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ Ready for polling mode');
          return true;
        } else {
          console.error('❌ Failed to clear webhook');
          return false;
        }
      } else {
        console.log('✅ No webhook configured, ready for polling');
        return true;
      }
    } catch (error) {
      console.error('❌ Error preparing for polling:', error.message);
      return false;
    }
  }

  /**
   * 🧹 Force clear all pending updates and webhooks
   */
  async forceClear() {
    try {
      console.log('🧹 Force clearing all webhooks and pending updates...');
      
      // Clear webhook with drop_pending_updates
      const response = await axios.post(`${this.baseUrl}/deleteWebhook`, {
        drop_pending_updates: true
      });
      
      if (response.data.ok) {
        console.log('✅ Force clear completed');
        
        // Additional delay to ensure Telegram processes the change
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return true;
      } else {
        console.error('❌ Force clear failed:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ Error in force clear:', error.message);
      return false;
    }
  }

  /**
   * 📊 Get bot info for debugging
   */
  async getBotInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return response.data;
    } catch (error) {
      console.error('❌ Error getting bot info:', error.message);
      return null;
    }
  }
}

module.exports = TelegramWebhookManager;