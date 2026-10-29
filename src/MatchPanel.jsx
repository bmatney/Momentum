import { useState } from 'react';
import { matchScore } from './game';

export default function MatchPanel({ game, dispatch, playerName, onClose }) {
  const [wins, setWins] = useState(game.wins);
  const [draws, setDraws] = useState(game.draws);
  const [result, setResult] = useState('1');
  const [error, setError] = useState('');
  const score = matchScore(game);
  const record = () => {
    dispatch({ type: 'manual-result', result: result === 'draw' ? 'draw' : Number(result) });
    onClose();
  };
  const save = () => {
    const nextScore = matchScore({ ...game, wins });
    if (nextScore.some(n => n > 2) || nextScore.every(n => n === 2)) {
      setError('Only one player can reach two wins. Include the current result when correcting earlier wins.');
      return;
    }
    dispatch({ type: 'correct-record', wins, draws });
    onClose();
  };
  return <>
    <p>Match: P1 {score[0]} – {score[1]} P2 · {game.draws + (game.gameOver === 'draw' ? 1 : 0)} draws</p>
    {!game.gameOver && game.firstPlayer && !score.some(n => n >= 2) && <section>
      <h3>Record this game</h3>
      <p>Use for a concession or a game ending without health reaching zero.</p>
      <label>Game result<select value={result} onChange={e => setResult(e.target.value)}>
        <option value="1">{playerName(1)} wins</option><option value="2">{playerName(2)} wins</option><option value="draw">Draw</option>
      </select></label>
      <button onClick={record}>Confirm game result</button>
    </section>}
    <section><h3>Correct earlier games</h3>
      <p>These are results saved before the current game. Current results can be undone on the game-over screen.</p>
      {[1, 2].map(num => <label key={num}>{playerName(num)} previous wins
        <select value={wins[num - 1]} onChange={e => setWins(wins.map((n, i) => i === num - 1 ? Number(e.target.value) : n))}>
          {[0, 1, 2].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>)}
      <label>Previous draws<select value={draws} onChange={e => setDraws(Number(e.target.value))}>
        {Array.from({ length: 100 }, (_, n) => <option key={n} value={n}>{n}</option>)}
      </select></label>
      {error && <p role="alert">{error}</p>}
      <button onClick={save}>Save corrected record</button>
    </section>
  </>;
}
