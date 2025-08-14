const fs = require('fs').promises;
const path = require('path');

const SETTINGS_PATH = path.join('/tmp', 'bot-settings.json');

const DEFAULT_SETTINGS = {
  buttons: {
    default: [
      { text: '📣 Channel', url: 'https://t.me/africansportdata' },
      { text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' }
    ],
    overrideOnce: null // same shape as default; consumed on first use
  },
  coupon: {
    default: { code: 'SM100', offer: '100 Bonus' },
    overrideOnce: null // { code, offer }
  }
};

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettings(settings) {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true }).catch(() => {});
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

async function getEffectiveButtons(consumeOnce = false) {
  const s = await readSettings();
  const effective = s.buttons.overrideOnce || s.buttons.default;
  if (consumeOnce && s.buttons.overrideOnce) {
    s.buttons.overrideOnce = null;
    await writeSettings(s);
  }
  return effective;
}

async function getEffectiveCoupon(consumeOnce = false) {
  const s = await readSettings();
  const effective = s.coupon.overrideOnce || s.coupon.default;
  if (consumeOnce && s.coupon.overrideOnce) {
    s.coupon.overrideOnce = null;
    await writeSettings(s);
  }
  return effective;
}

async function setButtons(buttons, scope = 'persist') {
  const s = await readSettings();
  if (scope === 'once') {
    s.buttons.overrideOnce = buttons;
  } else {
    s.buttons.default = buttons;
    s.buttons.overrideOnce = null;
  }
  await writeSettings(s);
}

async function setCoupon({ code, offer }, scope = 'persist') {
  const s = await readSettings();
  if (scope === 'once') {
    s.coupon.overrideOnce = { code, offer };
  } else {
    s.coupon.default = { code, offer };
    s.coupon.overrideOnce = null;
  }
  await writeSettings(s);
}

module.exports = {
  readSettings,
  writeSettings,
  getEffectiveButtons,
  getEffectiveCoupon,
  setButtons,
  setCoupon
};

