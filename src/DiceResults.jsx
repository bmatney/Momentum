import { useEffect, useState } from 'react';

function Die({ value, name, winner, rolling }) {
  return <div className={`die-result ${winner && !rolling ? 'die-winner' : ''}`}>
    <span className="die-name">{name}</span>
    <div className={`d20 ${rolling ? 'd20-rolling' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 120 132" fill="none">
        <path className="die-shell" d="M60 4 112 34 112 96 60 128 8 96 8 34Z" />
        <path className="die-facets" d="M60 4 32 49 8 34M60 4 88 49 112 34M8 96 32 49 88 49 112 96M8 96 60 101 112 96M32 49 60 101 88 49M60 101V128" />
      </svg>
      <strong>{rolling ? '?' : value}</strong>
    </div>
    <span className="player-caption">{rolling ? 'Rolling…' : winner ? 'Higher roll' : 'D20 result'}</span>
  </div>;
}

export default function DiceResults({ rolls, playerName, onStart }) {
  const [rolling, setRolling] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!rolling) return;
    const timer = setTimeout(() => setRolling(false), 900);
    return () => clearTimeout(timer);
  }, [rolling]);
  return <>
    <h2>{rolling ? 'Rolling D20s…' : 'Roll results'}</h2>
    <div className="dice-reveal" aria-hidden="true">
      {[1, 2].map(num => <Die key={num} value={rolls[`p${num}`]} name={playerName(num)} winner={rolls.winner === num} rolling={rolling} />)}
    </div>
    <p role="status" className="roll-summary">{rolling ? 'Rolling two twenty-sided dice.' : `${playerName(1)} rolled ${rolls.p1}. ${playerName(2)} rolled ${rolls.p2}. ${playerName(rolls.winner)} chooses first or second.`}</p>
    <div className="block-buttons">
      <button disabled={rolling} onClick={() => onStart(rolls.winner)}>Go first</button>
      <button disabled={rolling} onClick={() => onStart(3 - rolls.winner)}>Go second</button>
    </div>
  </>;
}
