import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer, resolveDamage, healthChanges, loadGame, saveGame } from '../src/game.js';
import { defaultPreferences, loadPreferences, savePreferences } from '../src/preferences.js';

const storage = () => {
  let value = null;
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
};
describe('combat and visible history', () => {
  it('handles ordinary blocks, odd Throw damage and negative damage', () => {
    assert.deepEqual(['none', 'half', 'full'].map(block => resolveDamage(5, block)), [5, 3, 0]);
    assert.deepEqual(['none', 'half', 'full'].map(block => resolveDamage(5, block, true)), [5, 3, 3]);
    assert.equal(resolveDamage(4, 'full', true), 2);
    for (const block of ['none', 'half', 'full']) assert.equal(resolveDamage(-2, block, true), 0);
  });
  it('lets either roll winner choose first or second', () => {
    for (const winner of [1, 2]) {
      const rolled = gameReducer(initialGame, { type: 'roll', rolls: { p1: winner === 1 ? 20 : 1, p2: winner === 2 ? 20 : 1, winner } });
      for (const first of [winner, 3 - winner]) {
        const game = gameReducer(rolled, { type: 'start', player: first });
        assert.equal(game.firstPlayer, first);
        assert.equal(game.diceRolls, null);
      }
    }
  });
  it('reconstructs history from old saves and keeps it accurate after undo and reset', () => {
    let game = gameReducer(initialGame, { type: 'life', player: 1, delta: -5 });
    game = gameReducer(game, { type: 'life', player: 2, delta: -3 });
    game = gameReducer(game, { type: 'life', player: 1, delta: 2 });
    const saved = storage(); saveGame(saved, game); game = loadGame(saved);
    assert.deepEqual(healthChanges(game).map(({ player, from, to, delta }) => ({ player, from, to, delta })), [
      { player: 1, from: 20, to: 22, delta: 2 }, { player: 2, from: 25, to: 22, delta: -3 }, { player: 1, from: 25, to: 20, delta: -5 },
    ]);
    game = gameReducer(game, { type: 'undo' });
    assert.equal(healthChanges(game).length, 2);
    assert.deepEqual(healthChanges(gameReducer(game, { type: 'reset' })), []);
  });
});
describe('local preferences', () => {
  it('preserves names and disabled settings across relaunch', () => {
    const saved = storage();
    const preferences = { names: ['Brian', 'Rival'], haptics: false, timerAlerts: true, keepAwake: false };
    assert.equal(savePreferences(saved, preferences), true);
    assert.deepEqual(loadPreferences(saved), preferences);
  });
  it('validates saved values and survives unavailable storage', () => {
    const saved = storage(); saved.setItem('', JSON.stringify({ names: [42, 'x'.repeat(40)], haptics: 'false' }));
    assert.deepEqual(loadPreferences(saved), { names: ['', 'x'.repeat(24)], haptics: true, timerAlerts: false, keepAwake: false });
    const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } };
    assert.deepEqual(loadPreferences(blocked), defaultPreferences);
    assert.equal(savePreferences(blocked, defaultPreferences), false);
  });
});
