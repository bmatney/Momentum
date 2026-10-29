import { useSyncExternalStore } from 'react';
import { roundClock } from './roundClock';

export default function RoundTimer({ game, dispatch }) {
  const seconds = useSyncExternalStore(roundClock.subscribe, roundClock.getSnapshot);
  const remaining = seconds * 1000;
  const running = game.timerEndsAt !== null && remaining > 0;
  return <div className="round-timer">
    <span className="timer-readout" role="timer" aria-label="Round time remaining">
      {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
    </span>
    <span role="status" className="helper-text">{remaining === 0 ? 'Time expired' : running ? (remaining <= 300000 ? 'Five minutes or less' : 'Round running') : 'Timer paused'}</span>
    <button disabled={remaining === 0} onClick={() => dispatch({ type: running ? 'timer-pause' : 'timer-start', now: Date.now() })}>
      {running ? 'Pause timer' : 'Start timer'}
    </button>
  </div>;
}
