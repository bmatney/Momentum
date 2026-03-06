import { useState, useEffect, useRef } from "react";
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

  // State for tracking who goes first
  const [firstPlayer, setFirstPlayer] = useState(null);

  // Swipe Gesture Refs
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

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
      const newLife = Math.max(0, prev + delta);
      if (newLife === 0) setGameOver(playerNum === 1 ? 2 : 1);
      return newLife;
    });
  };

  const applyAttack = (type) => {
    if (targetPlayer === null) return;

    let damage = 0;
    if (type === "half") damage = Math.ceil(attackDamage / 2);
    else if (type === "unblocked") damage = attackDamage;

    // PREVENT HEALING: Ensure damage never resolves below 0
    damage = Math.max(0, damage);

    updatePlayerLife(targetPlayer, -damage);
    setAttackSpeed(DEFAULT_STAT);
    setAttackDamage(DEFAULT_STAT);
    setAttackZone("high");
    closePanel();
  };

  // Swipe Handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const distanceX = touchStartX.current - touchEndX;
    const distanceY = touchStartY.current - touchEndY;

    // Check if swipe is mostly horizontal and exceeds 50px threshold
    if (Math.abs(distanceX) > 50 && Math.abs(distanceX) > Math.abs(distanceY)) {
      closePanel();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // FLIPPED: The panel now faces the attacking player!
    const panelClass = targetPlayer === 1 ? "attack-face-down" : "attack-face-up";
  return (
    <div className="container main-screen">
      <div className="game-area">
        <PlayerSection
          num={2}
          life={player2Life}
          onUpdate={updatePlayerLife}
          onOpen={() => setTargetPlayer(2)}
          rotated={true}
          isFirst={firstPlayer === 2}
        />

        <div className="center-divider"></div>

        <PlayerSection
          num={1}
          life={player1Life}
          onUpdate={updatePlayerLife}
          onOpen={() => setTargetPlayer(1)}
          rotated={false}
          isFirst={firstPlayer === 1}
        />
      </div> {/* Correctly closed game-area! */}

      {/* Attack Panel Modal */}
      {targetPlayer && !gameOver && (
        <div
          className="modal-backdrop"
          onClick={closePanel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
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

      {/* First Player Selection Popup */}
      {!firstPlayer && !gameOver && (
        <div className="modal-backdrop">
          <div className="attack-panel game-over-panel">
            <h2 style={{ margin: "0 0 20px 0" }}>Who goes first?</h2>
            <div className="block-buttons">
              <button onClick={() => setFirstPlayer(2)}>Player 2</button>
              <button onClick={() => setFirstPlayer(1)}>Player 1</button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
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

const PlayerSection = ({ num, life, onUpdate, onOpen, rotated, isFirst }) => (
  <div className={`player ${rotated ? "player-rotate" : ""} ${isFirst ? "first-player-highlight" : ""}`} onClick={onOpen}>
    <div className={`player-name ${isFirst ? "first-name-active" : ""}`}>
      Player {num} {isFirst && <span className="first-tag">1ST</span>}
    </div>
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
      {/* Allows negative stats */}
      <button onClick={() => set(v => v - 1)}>-</button>
      <button onClick={() => set(v => v + 1)}>+</button>
    </div>
  </div>
);

export default App;
