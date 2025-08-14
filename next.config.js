/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CHANNEL_ID: process.env.CHANNEL_ID,
    FOOTBALL_API_KEY: process.env.FOOTBALL_API_KEY,
  }
}

module.exports = nextConfig