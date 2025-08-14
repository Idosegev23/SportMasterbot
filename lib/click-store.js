const fs = require('fs').promises;
const path = require('path');

const LOG_FILE = '/tmp/click-logs.json';

async function readJson(file) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return [];
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

async function recordClick(clickEvent) {
  const logs = await readJson(LOG_FILE);
  logs.push({ ...clickEvent, timestamp: new Date().toISOString() });
  await writeJson(LOG_FILE, logs);
}

async function getSummary() {
  const logs = await readJson(LOG_FILE);
  const totalClicks = logs.length;
  const byTrackId = {};
  const byDestination = {};
  const uniqueIps = new Set();

  for (const e of logs) {
    if (e.ip) uniqueIps.add(e.ip);
    byTrackId[e.track_id] = (byTrackId[e.track_id] || 0) + 1;
    byDestination[e.to] = (byDestination[e.to] || 0) + 1;
  }

  const topTrackIds = Object.entries(byTrackId)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, count }));

  const topDestinations = Object.entries(byDestination)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  const recent = logs.slice(-10).reverse();

  return { totalClicks, uniqueUsersApprox: uniqueIps.size, topTrackIds, topDestinations, recent };
}

module.exports = { recordClick, getSummary };

