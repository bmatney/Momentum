import { it } from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer as reduce, matchScore, remainingTime, ROUND_MS, loadGame, saveGame } from '../src/game.js';
const win = (game, player) => reduce(game, { type: 'life', player: 3 - player, delta: -100 });
it('counts each result once, carries scores between games, and ends at two wins', () => {
  let game = win(initialGame, 1);
  assert.deepEqual(matchScore(game), [1, 0]);
  game = reduce(game, { type: 'next-game' });
  assert.deepEqual(matchScore(game), [1, 0]);
  assert.equal(reduce(game, { type: 'next-game' }), game);
  game = reduce(win(game, 2), { type: 'next-game' });
  assert.deepEqual(matchScore(game), [1, 1]);
  game = win(game, 1);
  assert.deepEqual(matchScore(game), [2, 1]);
  assert.equal(reduce(game, { type: 'next-game' }), game);
  assert.deepEqual(matchScore(reduce(game, { type: 'undo' })), [1, 1]);
});
it('uses elapsed wall time across backgrounding, pause, resume and expiry', () => {
  let game = reduce(initialGame, { type: 'timer-start', now: 1000 });
  assert.equal(remainingTime(game, 61000), ROUND_MS - 60000);
  game = reduce(game, { type: 'timer-pause', now: 61000 });
  assert.equal(remainingTime(game, 999999), ROUND_MS - 60000);
  game = reduce(game, { type: 'timer-start', now: 1000000 });
  assert.equal(remainingTime(game, 1000000 + ROUND_MS), 0);
  game = reduce(game, { type: 'timer-pause', now: 1000000 + ROUND_MS });
  assert.equal(reduce(game, { type: 'timer-start', now: 9999999 }), game);
});
it('preserves timer between games and clears it only for a new match', () => {
  let game = reduce(initialGame, { type: 'timer-start', now: 1000 });
  game = reduce(win(game, 1), { type: 'next-game' });
  const restarted = reduce(game, { type: 'restart-game' });
  assert.deepEqual(restarted.wins, [1, 0]);
  assert.equal(restarted.timerEndsAt, 1000 + ROUND_MS);
  assert.deepEqual(reduce(game, { type: 'reset' }), initialGame);
});
it('restores record and running clock, and migrates older saves', () => {
  let value;
  const storage = { setItem: (_, v) => { value = v; }, getItem: () => value };
  const game = reduce(reduce(win(initialGame, 1), { type: 'next-game' }), { type: 'timer-start', now: 1000 });
  saveGame(storage, game);
  assert.deepEqual(loadGame(storage), game);
  const old = { ...initialGame, player1Life: 20 };
  delete old.wins; delete old.timerRemaining; delete old.timerEndsAt;
  saveGame(storage, old);
  assert.deepEqual(loadGame(storage), { ...initialGame, player1Life: 20 });
});

it('records concessions and draws without changing health, and undo restores the live game', () => {
  const started = reduce(initialGame, { type: 'start', player: 1 });
  for (const result of [1, 2, 'draw']) {
    const recorded = reduce(started, { type: 'manual-result', result });
    assert.equal(recorded.player1Life, 25);
    assert.equal(recorded.player2Life, 25);
    assert.equal(recorded.gameOver, result);
    assert.deepEqual(reduce(recorded, { type: 'undo' }), started);
    assert.equal(reduce(recorded, { type: 'manual-result', result }), recorded);
    const next = reduce(recorded, { type: 'next-game' });
    assert.equal(next.draws, result === 'draw' ? 1 : 0);
    assert.deepEqual(next.wins, result === 1 ? [1, 0] : result === 2 ? [0, 1] : [0, 0]);
    let value;
    const storage = { getItem: () => value, setItem: (_, v) => { value = v; } };
    saveGame(storage, recorded);
    assert.deepEqual(loadGame(storage), recorded);
  }
});
it('corrects previous scores without changing health or clock, rejecting impossible totals', () => {
  const game = { ...initialGame, firstPlayer: 1, player1Life: 14, timerEndsAt: 999999 };
  const corrected = reduce(game, { type: 'correct-record', wins: [2, 1], draws: 1 });
  assert.equal(corrected.player1Life, 14);
  assert.equal(corrected.timerEndsAt, 999999);
  assert.deepEqual(matchScore(corrected), [2, 1]);
  for (const wins of [[2, 2], [-1, 0], [3, 0]]) assert.equal(reduce(game, { type: 'correct-record', wins, draws: 0 }), game);
  const ended = win(game, 1);
  assert.equal(reduce(ended, { type: 'correct-record', wins: [2, 0], draws: 0 }), ended);
});
it('alerts once per threshold, survives reload and pause, and resets for a new match', async () => {
  const { pendingTimerAlert } = await import('../src/game.js');
  let game = reduce(initialGame, { type: 'timer-start', now: 1000 });
  assert.equal(pendingTimerAlert(game, 1000), null);
  assert.equal(pendingTimerAlert(game, ROUND_MS - 300000 + 1000), 300000);
  game = reduce(game, { type: 'timer-alert', threshold: 300000 });
  assert.equal(pendingTimerAlert(game, ROUND_MS - 300000 + 1000), null);
  assert.equal(pendingTimerAlert(game, ROUND_MS + 1000), 0);
  game = reduce(game, { type: 'timer-alert', threshold: 0 });
  let value;
  const storage = { getItem: () => value, setItem: (_, v) => { value = v; } };
  saveGame(storage, game);
  assert.equal(pendingTimerAlert(loadGame(storage), ROUND_MS + 1000), null);
  assert.equal(pendingTimerAlert(reduce(game, { type: 'timer-pause', now: ROUND_MS + 1000 }), ROUND_MS + 1000), null);
  assert.deepEqual(reduce(game, { type: 'reset' }).timerAlerts, []);
});
it('starts the timer with either first-player choice and preserves the round deadline between games', () => {
  for (const player of [1, 2]) {
    const game = reduce(initialGame, { type: 'start', player, now: 1000 });
    assert.equal(game.timerEndsAt, 1000 + ROUND_MS);
    const next = reduce(reduce(win(game, player), { type: 'next-game' }), { type: 'start', player: 3 - player, now: 61000 });
    assert.equal(next.timerEndsAt, game.timerEndsAt);
    const paused = reduce(game, { type: 'timer-pause', now: 61000 });
    const restarted = reduce(reduce(paused, { type: 'restart-game' }), { type: 'start', player, now: 91000 });
    assert.equal(restarted.timerEndsAt, 91000 + ROUND_MS - 60000);
  }
});
