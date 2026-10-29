import { useEffect, useEffectEvent } from 'react';
import { Haptics } from '@capacitor/haptics';
import { App as CapApp } from '@capacitor/app';
import { pendingTimerAlert } from './game';
import { roundClock } from './roundClock';

// Share the display clock instead of polling separately for alerts.
export default function useTimerAlerts(game, dispatch, enabled) {
  const check = useEffectEvent(() => {
    if (document.visibilityState !== 'visible') return;
    const threshold = pendingTimerAlert(game, Date.now());
    if (threshold === null) return;
    dispatch({ type: 'timer-alert', threshold });
    if (enabled) Haptics.vibrate({ duration: threshold === 0 ? 1000 : 500 }).catch(() => {});
  });
  useEffect(() => {
    let disposed = false;
    let nativeActive = true;
    let handle;
    const refreshVisibility = () => roundClock.setActive(nativeActive && document.visibilityState === 'visible');
    refreshVisibility();
    const unsubscribe = roundClock.subscribe(() => check());
    document.addEventListener('visibilitychange', refreshVisibility);
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (disposed) return;
      nativeActive = isActive;
      refreshVisibility();
    }).then(listener => {
      if (disposed) listener.remove().catch(() => {});
      else handle = listener;
    }).catch(() => {});
    return () => {
      disposed = true;
      unsubscribe();
      roundClock.setActive(false);
      document.removeEventListener('visibilitychange', refreshVisibility);
      handle?.remove().catch(() => {});
    };
  }, []);
  useEffect(() => {
    roundClock.configure(game.timerEndsAt, game.timerRemaining);
  }, [game.timerEndsAt, game.timerRemaining]);
}
