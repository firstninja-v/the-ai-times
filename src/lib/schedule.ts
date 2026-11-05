/** Returns true when local HH:mm matches now within the given minute window. */
export function isDue(timeHHmm: string, now = new Date(), windowMinutes = 1) {
  const [h, m] = timeHHmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const target = h * 60 + m;
  const current = now.getHours() * 60 + now.getMinutes();
  return Math.abs(current - target) < windowMinutes;
}

export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
