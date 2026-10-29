// One scheduler for all timer displays. The deadline, not tick count, keeps time.
export function createRoundClock({ now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let endsAt = null;
  let remaining = 3000000;
  let seconds = 3000;
  let active = true;
  let timeout = null;
  const listeners = new Set();
  const stop = () => { if (timeout !== null) cancel(timeout); timeout = null; };
  const refresh = () => {
    stop();
    if (!active) return;
    const milliseconds = Math.max(0, endsAt === null ? remaining : endsAt - now());
    const next = Math.ceil(milliseconds / 1000);
    if (next !== seconds) {
      seconds = next;
      listeners.forEach(listener => listener());
    }
    if (endsAt !== null && milliseconds > 0 && listeners.size) {
      timeout = schedule(refresh, milliseconds % 1000 || 1000);
    }
  };
  return {
    getSnapshot: () => seconds,
    subscribe(listener) {
      listeners.add(listener);
      refresh();
      return () => { listeners.delete(listener); if (!listeners.size) stop(); };
    },
    configure(deadline, pausedRemaining) { endsAt = deadline; remaining = pausedRemaining; refresh(); },
    setActive(value) { active = value; refresh(); },
  };
}

export const roundClock = createRoundClock();
