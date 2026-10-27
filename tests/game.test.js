import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, gameReducer, loadGame, saveGame, SAVE_KEY } from '../src/game.js';

const change = (game, player, delta) => gameReducer(game, { type: 'life', player, delta });
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

describe('match recovery and correction', () => {
  it('undoes a winning hit and restores both players exactly', () => {
    const damaged = change(initialGame, 2, -7);
    const ended = change(damaged, 1, -30);
    assert.equal(ended.gameOver, 2);
    assert.equal(ended.player1Life, 0);
    assert.deepEqual(gameReducer(ended, { type: 'undo' }), damaged);
  });
  it('ignores ineffective taps without consuming an undo step', () => {
    assert.equal(change(initialGame, 1, 1), initialGame);
    const ended = change(initialGame, 2, -25);
    assert.equal(change(ended, 2, -1), ended);
    assert.equal(change(ended, 1, 0), ended);
    assert.deepEqual(gameReducer(ended, { type: 'undo' }), initialGame);
  });
  it('handles successive actions using the latest life totals', () => {
    let game = change(change(initialGame, 1, -1), 1, -1);
    assert.equal(game.player1Life, 23);
    game = gameReducer(game, { type: 'undo' });
    assert.equal(game.player1Life, 24);
    assert.deepEqual(gameReducer(game, { type: 'undo' }), initialGame);
  });
  it('resets match state while keeping chosen starting life', () => {
    let game = gameReducer(initialGame, { type: 'base', player: 1, delta: 5 });
    game = gameReducer(game, { type: 'roll', rolls: { p1: 20, p2: 1, winner: 1 } });
    game = change(game, 2, -25);
    const reset = gameReducer(game, { type: 'reset' });
    assert.deepEqual(reset, { ...initialGame, baseLifeP1: 30, player1Life: 30 });
  });
  it('restores life, first player, and undo history after restart', () => {
    const storage = memoryStorage();
    const game = change(gameReducer(initialGame, { type: 'start', player: 2 }), 1, -6);
    assert.equal(saveGame(storage, game), true);
    const restored = loadGame(storage);
    assert.deepEqual(restored, game);
    assert.equal(gameReducer(restored, { type: 'undo' }).player1Life, 25);
  });
  it('restores game-over and pending dice results', () => {
    const storage = memoryStorage();
    for (const game of [change(initialGame, 1, -25),
      gameReducer(initialGame, { type: 'roll', rolls: { p1: 4, p2: 12, winner: 2 } })]) {
      saveGame(storage, game);
      assert.deepEqual(loadGame(storage), game);
    }
  });
  it('recovers safely from corrupt, invalid, or unsupported saves', () => {
    const storage = memoryStorage();
    for (const value of ['bad json', 'null', JSON.stringify({ version: 2, game: initialGame }),
      JSON.stringify({ version: 1, game: { ...initialGame, player1Life: -5 } }),
      JSON.stringify({ version: 1, game: { ...initialGame, history: [null] } }),
      JSON.stringify({ version: 1, game: { ...initialGame, diceRolls: { p1: 8, p2: 8, winner: 1 } } })]) {
      storage.setItem(SAVE_KEY, value);
      assert.deepEqual(loadGame(storage), initialGame);
    }
  });
  it('survives unavailable storage and reports failed writes', () => {
    const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
    assert.deepEqual(loadGame(storage), initialGame);
    assert.equal(saveGame(storage, initialGame), false);
  });
});
