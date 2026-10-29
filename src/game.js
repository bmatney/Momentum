export const ROUND_MS = 50 * 60 * 1000;
export const freshRound = { wins: [0, 0], draws: 0, manualResult: null, timerAlerts: [], timerRemaining: ROUND_MS, timerEndsAt: null };
export const remainingTime = (game, now) => Math.max(0, game.timerEndsAt === null ? game.timerRemaining : game.timerEndsAt - now);
export const matchScore = game => game.wins.map((wins, index) => wins + (game.gameOver === index + 1 ? 1 : 0));
export const SAVE_KEY = 'momentum.game.v1';
export const initialGame = {
  ...freshRound,
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
    const round = Array.isArray(g.wins) && g.wins.length === 2 &&
      g.wins.every(n => validLife(n, 0, 2)) &&
      validLife(g.timerRemaining, 0, ROUND_MS) &&
      (g.timerEndsAt === null || validLife(g.timerEndsAt, 0, Number.MAX_SAFE_INTEGER))
      ? { wins: g.wins, timerRemaining: g.timerRemaining, timerEndsAt: g.timerEndsAt } : freshRound;
    const manualResult = [1, 2, 'draw'].includes(g.manualResult) ? g.manualResult : null;
    return { ...initialGame, ...round,
      draws: validLife(g.draws, 0, 99) ? g.draws : 0, manualResult,
      timerAlerts: Array.isArray(g.timerAlerts) ? g.timerAlerts.filter(n => n === 0 || n === 300000) : [],
      baseLifeP1: g.baseLifeP1, baseLifeP2: g.baseLifeP2,
      player1Life: g.player1Life, player2Life: g.player2Life, firstPlayer: g.firstPlayer,
      diceRolls: dice, history: g.history, gameOver: manualResult ?? winner(g.player1Life, g.player2Life) };
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
    case 'manual-result':
      if (state.gameOver || !state.firstPlayer || matchScore(state).some(n => n >= 2) || ![1, 2, 'draw'].includes(action.result)) return state;
      return { ...state, manualResult: action.result, gameOver: action.result };
    case 'correct-record': {
      if (!Array.isArray(action.wins) || action.wins.length !== 2 ||
          !action.wins.every(n => validLife(n, 0, 2)) || !validLife(action.draws, 0, 99)) return state;
      const next = { ...state, wins: action.wins, draws: action.draws };
      const score = matchScore(next);
      if (score.some(n => n > 2) || score.every(n => n === 2)) return state;
      return next;
    }
    case 'timer-alert':
      return state.timerAlerts.includes(action.threshold) ? state :
        { ...state, timerAlerts: [...state.timerAlerts, action.threshold] };
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
      if (state.manualResult !== null) return { ...state, manualResult: null,
        gameOver: winner(state.player1Life, state.player2Life) };
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...state, player1Life: previous.p1, player2Life: previous.p2,
        gameOver: winner(previous.p1, previous.p2), history: state.history.slice(0, -1) };
    }
    case 'timer-start': {
      if (state.timerEndsAt !== null || state.timerRemaining <= 0) return state;
      return { ...state, timerEndsAt: action.now + state.timerRemaining };
    }
    case 'timer-pause':
      return { ...state, timerRemaining: remainingTime(state, action.now), timerEndsAt: null };
    case 'next-game': {
      if (!state.gameOver || matchScore(state).some(n => n >= 2)) return state;
      return { ...gameReducer(state, { type: 'reset' }), wins: matchScore(state), draws: state.draws + (state.gameOver === 'draw' ? 1 : 0), timerAlerts: state.timerAlerts,
        timerRemaining: state.timerRemaining, timerEndsAt: state.timerEndsAt };
    }
    case 'restart-game':
      return { ...gameReducer(state, { type: 'reset' }), wins: state.wins, draws: state.draws, timerAlerts: state.timerAlerts,
        timerRemaining: state.timerRemaining, timerEndsAt: state.timerEndsAt };
    case 'reset':
      return { ...initialGame, baseLifeP1: state.baseLifeP1, baseLifeP2: state.baseLifeP2,
        player1Life: state.baseLifeP1, player2Life: state.baseLifeP2 };
    case 'start': {
      const started = { ...state, firstPlayer: action.player, diceRolls: null };
      return Number.isSafeInteger(action.now) ? gameReducer(started, { type: 'timer-start', now: action.now }) : started;
    }
    case 'roll': return { ...state, diceRolls: action.rolls };
    default: return state;
  }
}

// Compute previews and applied damage from the same rule.
export function resolveDamage(damage, block, isThrow = false) {
  const value = Math.max(0, damage);
  if (block === 'none') return value;
  if (block === 'half' || isThrow) return Math.ceil(value / 2);
  return 0;
}

export function healthChanges(game) {
  return game.history.flatMap((before, index) => {
    const after = game.history[index + 1] ?? { p1: game.player1Life, p2: game.player2Life };
    return [1, 2].filter(player => before[`p${player}`] !== after[`p${player}`])
      .map(player => ({ id: `${index}-${player}`, player, from: before[`p${player}`],
        to: after[`p${player}`], delta: after[`p${player}`] - before[`p${player}`] }));
  }).reverse();
}

export function pendingTimerAlert(game, now) {
  if (game.timerEndsAt === null) return null;
  const remaining = remainingTime(game, now);
  if (remaining === 0 && !game.timerAlerts.includes(0)) return 0;
  if (remaining > 0 && remaining <= 300000 && !game.timerAlerts.includes(300000)) return 300000;
  return null;
}
