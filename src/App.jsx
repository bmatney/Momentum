import { useState, useEffect, useCallback } from "react";
import "./App.css";
import universusLogo from "./universus-logo.png";

function App() {
  const START_LIFE = 25;
  const DEFAULT_STAT = 4;

  const [player1Life, setPlayer1Life] = useState(START_LIFE);
  const [player2Life, setPlayer2Life] = useState(START_LIFE);
  const [attackingPlayer, setAttackingPlayer] = useState(null);
  const [attackSpeed, setAttackSpeed] = useState(DEFAULT_STAT);
  const [attackDamage, setAttackDamage] = useState(DEFAULT_STAT);
  const [attackZone, setAttackZone] = useState("high");
  const [gameOver, setGameOver] = useState(null);
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const closePanel = () => setAttackingPlayer(null);

  const updatePlayerLife = (playerNum, delta) => {
    if (playerNum === 1) {
      setPlayer1Life(prev => {
        const newLife = prev + delta;
        if (newLife <= 0) setGameOver(2);
        return Math.max(0, newLife);
      });
    } else {
      setPlayer2Life(prev => {
        const newLife = prev + delta;
        if (newLife <= 0) setGameOver(1);
        return Math.max(0, newLife);
      });
    }
  };

  const applyAttack = useCallback((type) => {
    let damage = 0;

    if (type === "half") damage = Math.ceil(attackDamage / 2);
    if (type === "unblocked") damage = attackDamage;

    if (attackingPlayer === 1) {
      updatePlayerLife(1, -damage);
    } else {
      updatePlayerLife(2, -damage);
    }

    setAttackSpeed(DEFAULT_STAT);
    setAttackDamage(DEFAULT_STAT);
    closePanel();
  }, [attackingPlayer, attackDamage]);

  const renderPlayer = (playerNum) => {
    const life = playerNum === 1 ? player1Life : player2Life;

    // Always mirror Player 2
    const playerClass = playerNum === 2 ? "player-rotate" : "";

    return (
      <div className={`player ${playerClass}`}>
        <div className="player-name">Player {playerNum}</div>

        <div
          className="life-total"
          onClick={() => setAttackingPlayer(playerNum)}
        >
          {life}
        </div>

        <div className="controls">
          <button onClick={() => updatePlayerLife(playerNum, -1)}>-</button>
          <button onClick={() => updatePlayerLife(playerNum, 1)}>+</button>
        </div>
      </div>
    );
  };

  const resetGame = () => {
    setPlayer1Life(START_LIFE);
    setPlayer2Life(START_LIFE);
    setAttackSpeed(DEFAULT_STAT);
    setAttackDamage(DEFAULT_STAT);
    setAttackZone("high");
    setGameOver(null);
    setAttackingPlayer(null);
  };

  if (showLoading) {
    return (
      <div className="loading-screen">
        <img src={universusLogo} alt="Universus Logo" className="loading-logo" />
      </div>
    );
  }

  const panelClass =
    attackingPlayer === 1
      ? "attack-face-down"
      : attackingPlayer === 2
      ? "attack-face-up"
      : "";

  return (
    <div className="container main-screen">
      {renderPlayer(2)}
      {renderPlayer(1)}

      {attackingPlayer && !gameOver && (
        <div className="modal-backdrop" onClick={closePanel}>
          <div
            className={`attack-panel ${panelClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="attack-life-bar">
              <div className="attack-life">
                <div className="attack-player-name">Player 1</div>
                <div className="attack-player-life">{player1Life}</div>
                <div className="controls">
                  <button onClick={() => updatePlayerLife(1, -1)}>-</button>
                  <button onClick={() => updatePlayerLife(1, 1)}>+</button>
                </div>
              </div>

              <div className="attack-life">
                <div className="attack-player-name">Player 2</div>
                <div className="attack-player-life">{player2Life}</div>
                <div className="controls">
                  <button onClick={() => updatePlayerLife(2, -1)}>-</button>
                  <button onClick={() => updatePlayerLife(2, 1)}>+</button>
                </div>
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">Speed</div>
              <div className="stat-value">{attackSpeed}</div>
              <div className="stat-controls">
                <button onClick={() => setAttackSpeed(v => Math.max(0, v - 1))}>-</button>
                <button onClick={() => setAttackSpeed(v => v + 1)}>+</button>
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">Damage</div>
              <div className="stat-value">{attackDamage}</div>
              <div className="stat-controls">
                <button onClick={() => setAttackDamage(v => Math.max(0, v - 1))}>-</button>
                <button onClick={() => setAttackDamage(v => v + 1)}>+</button>
              </div>
            </div>

            <div className="zone-buttons">
              <button
                data-zone="high"
                className={attackZone === "high" ? "selected-zone" : ""}
                onClick={() => setAttackZone("high")}
              >
                High
              </button>
              <button
                data-zone="mid"
                className={attackZone === "mid" ? "selected-zone" : ""}
                onClick={() => setAttackZone("mid")}
              >
                Mid
              </button>
              <button
                data-zone="low"
                className={attackZone === "low" ? "selected-zone" : ""}
                onClick={() => setAttackZone("low")}
              >
                Low
              </button>
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
          <div className="attack-panel">
            <h1>Game Over</h1>
            <h2>Player {gameOver} Wins!</h2>
            <button className="reset-button" onClick={resetGame}>
              New Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;