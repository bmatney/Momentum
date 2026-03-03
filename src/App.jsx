import { useState, useEffect, useCallback } from "react";
import "./App.css";

function App() {
  const START_LIFE = 25;
  const DEFAULT_STAT = 4;

  const [player1Life, setPlayer1Life] = useState(START_LIFE);
  const [player2Life, setPlayer2Life] = useState(START_LIFE);
  const [targetPlayer, setTargetPlayer] = useState(null); 

  const [attackSpeed, setAttackSpeed] = useState(DEFAULT_STAT);
  const [attackDamage, setAttackDamage] = useState(DEFAULT_STAT);
  const [attackZone, setAttackZone] = useState("high");
  const [gameOver, setGameOver] = useState(null);

  // Navigation / Back Gesture Logic
  useEffect(() => {
    const handlePopState = () => setTargetPlayer(null);
    if (targetPlayer) {
      window.history.pushState({ panelOpen: true }, "");
      window.addEventListener("popstate", handlePopState);
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, [targetPlayer]);

  const closePanel = () => {
    if (window.history.state?.panelOpen) window.history.back();
    else setTargetPlayer(null);
  };

  const updatePlayerLife = (playerNum, delta) => {
    const setter = playerNum === 1 ? setPlayer1Life : setPlayer2Life;
    setter((prev) => {
      const newLife = prev + delta;
      if (newLife <= 0) setGameOver(playerNum === 1 ? 2 : 1);
      return Math.max(0, newLife);
    });
  };

  const applyAttack = useCallback((type) => {
    if (targetPlayer === null) return;
    let damage = 0;
    if (type === "half") damage = Math.ceil(attackDamage / 2);
    else if (type === "unblocked") damage = attackDamage;

    updatePlayerLife(targetPlayer, -damage);
    setAttackSpeed(DEFAULT_STAT);
    setAttackDamage(DEFAULT_STAT);
    setAttackZone("high");
    closePanel();
  }, [targetPlayer, attackDamage]);

  const panelClass = targetPlayer === 1 ? "attack-face-down" : "attack-face-up";

  return (
    <div className="container main-screen">
      <div className="game-area">
        <PlayerSection num={2} life={player2Life} onUpdate={updatePlayerLife} onOpen={() => setTargetPlayer(2)} rotated />
        <div className="center-divider"></div>
        <PlayerSection num={1} life={player1Life} onUpdate={updatePlayerLife} onOpen={() => setTargetPlayer(1)} />
      </div>

      {targetPlayer && !gameOver && (
        <div className="modal-backdrop" onClick={closePanel}>
          <div className={`attack-panel ${panelClass}`} onClick={(e) => e.stopPropagation()}>
            <div className="panel-life-display">
                <MiniLife label="P2" life={player2Life} onUpdate={(d) => updatePlayerLife(2, d)} />
                <MiniLife label="P1" life={player1Life} onUpdate={(d) => updatePlayerLife(1, d)} />
            </div>

            <div className="stat-group">
              <StatControl label="Speed" val={attackSpeed} set={setAttackSpeed} />
              <StatControl label="Damage" val={attackDamage} set={setAttackDamage} />
            </div>

            <div className="zone-buttons">
              {["high", "mid", "low"].map(z => (
                <button key={z} className={attackZone === z ? "selected-zone" : ""} onClick={() => setAttackZone(z)} data-zone={z}>
                  {z.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="block-buttons">
              <button onClick={() => applyAttack("full")}>Full Block</button>
              <button onClick={() => applyAttack("half")}>Half Block</button>
              <button onClick={() => applyAttack("unblocked")}>Unblocked</button>
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="modal-backdrop">
          <div className="attack-panel game-over-panel">
            <h1>PLAYER {gameOver} WINS!</h1>
            <button className="reset-button" onClick={() => window.location.reload()}>New Game</button>
          </div>
        </div>
      )}
    </div>
  );
}

const PlayerSection = ({ num, life, onUpdate, onOpen, rotated }) => (
  <div className={`player ${rotated ? "player-rotate" : ""}`} onClick={onOpen}>
    <div className="player-name">Player {num}</div>
    <div className="life-total">{life}</div>
    <div className="controls">
      <button onClick={(e) => { e.stopPropagation(); onUpdate(num, -1); }}>-</button>
      <button onClick={(e) => { e.stopPropagation(); onUpdate(num, 1); }}>+</button>
    </div>
  </div>
);

const MiniLife = ({ label, life, onUpdate }) => (
  <div className="mini-life">
    <span className="mini-label">{label} LIFE</span>
    <div className="mini-life-val">{life}</div>
    <div className="mini-controls">
      <button onClick={() => onUpdate(-1)}>-</button>
      <button onClick={() => onUpdate(1)}>+</button>
    </div>
  </div>
);

const StatControl = ({ label, val, set }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{val}</div>
    <div className="stat-controls">
      <button onClick={() => set(v => Math.max(0, v - 1))}>-</button>
      <button onClick={() => set(v => v + 1)}>+</button>
    </div>
  </div>
);

export default App;