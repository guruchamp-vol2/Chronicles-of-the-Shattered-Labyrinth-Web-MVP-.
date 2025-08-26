/* realms.js — biome palettes + hazards inspired by the GDD */

export const realms = [
  { name: 'Ancient Ruins', bg: '#2d1e0f', hazards: ['falling debris', 'lava fissures'] },
  { name: 'Cyberpunk City', bg: '#0f0f2d', hazards: ['electric grids', 'drone patrols'] },
  { name: 'Alien Hive', bg: '#132d13', hazards: ['acid pools', 'spore clouds'] },
  { name: 'Elemental Wasteland', bg: '#331f2d', hazards: ['firestorms', 'sand cyclones'] },
  { name: 'Puzzle Sanctum', bg: '#1f2333', hazards: ['shifting walls', 'void tiles'] },
];

// Deterministic realm pick per day (client fallback).
// The server also provides /api/daily-seed if you want a seed value.
export function pickRealmByDate(dateStr) {
  const sum = [...dateStr].reduce((a, c) => a + c.charCodeAt(0), 0);
  return realms[sum % realms.length];
}