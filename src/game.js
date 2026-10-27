export const SAVE_KEY = 'momentum.game.v1';
export const initialGame = {
  baseLifeP1: 25, baseLifeP2: 25, player1Life: 25, player2Life: 25,
  firstPlayer: null, diceRolls: null, gameOver: null, history: [],
};
const winner = (p1, p2) => p1 === 0 ? 2 : p2 === 0 ? 1 : null;
const validLife = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;

export function loadGame(storage) {
  try {
    const saved = JSON.parse(storage.getItem(SAVE_KEY));
    if (!saved || saved.version !== 1) return initialGame;
    const g = saved.game;
    if (!g || !validLife(g.baseLifeP1, 1, Number.MAX_SAFE_INTEGER) ||
        !validLife(g.baseLifeP2, 1, Number.MAX_SAFE_INTEGER) ||
        !validLife(g.player1Life, 0, g.baseLifeP1) || !validLife(g.player2Life, 0, g.baseLifeP2) ||
        ![null, 1, 2].includes(g.firstPlayer) || !Array.isArray(g.history) ||
        !g.history.every(h => h && validLife(h.p1, 0, g.baseLifeP1) && validLife(h.p2, 0, g.baseLifeP2))) return initialGame;
    const dice = g.diceRolls;
    if (dice !== null && (!dice || !validLife(dice.p1, 1, 20) || !validLife(dice.p2, 1, 20) ||
        dice.p1 === dice.p2 || dice.winner !== (dice.p1 > dice.p2 ? 1 : 2))) return initialGame;
    return { ...initialGame, baseLifeP1: g.baseLifeP1, baseLifeP2: g.baseLifeP2,
      player1Life: g.player1Life, player2Life: g.player2Life, firstPlayer: g.firstPlayer,
      diceRolls: dice, history: g.history, gameOver: winner(g.player1Life, g.player2Life) };
  } catch {
    return initialGame;
  }
}

export function saveGame(storage, game) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, game }));
    return true;
  } catch {
    return false;
  }
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'life': {
      const key = action.player === 1 ? 'player1Life' : 'player2Life';
      const max = action.player === 1 ? state.baseLifeP1 : state.baseLifeP2;
      const value = Math.min(max, Math.max(0, state[key] + action.delta));
      if (value === state[key]) return state;
      const next = { ...state, [key]: value,
        history: [...state.history, { p1: state.player1Life, p2: state.player2Life }] };
      return { ...next, gameOver: winner(next.player1Life, next.player2Life) };
    }
    case 'base': {
      const base = action.player === 1 ? 'baseLifeP1' : 'baseLifeP2';
      const life = action.player === 1 ? 'player1Life' : 'player2Life';
      const value = Math.max(1, state[base] + action.delta);
      if (value === state[base] && value === state[life]) return state;
      return { ...state, [base]: value, [life]: value };
    }
    case 'undo': {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...state, player1Life: previous.p1, player2Life: previous.p2,
        gameOver: winner(previous.p1, previous.p2), history: state.history.slice(0, -1) };
    }
    case 'reset':
      return { ...initialGame, baseLifeP1: state.baseLifeP1, baseLifeP2: state.baseLifeP2,
        player1Life: state.baseLifeP1, player2Life: state.baseLifeP2 };
    case 'start': return { ...state, firstPlayer: action.player, diceRolls: null };
    case 'roll': return { ...state, diceRolls: action.rolls };
    default: return state;
  }
}
