import { useState, useEffect, useRef } from "react";
import { KeepAwake } from '@capacitor-community/keep-awake';
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
  // Map your specific attack zones to whatever colors you want
  // Map your specific attack zones to exact state strings
    const zoneColors = {
      "high": "#ED1C24",   // Red
      "mid": "#F7941D",    // orange
      "low": "#FFDE00",    // yellow
      "default": "#2c3e50" // Your standard panel background color
    };

    // Use your actual state variable (attackZone)
    const currentPanelColor = attackZone ? zoneColors[attackZone] : zoneColors["default"];
  // State for tracking who goes first
  const [firstPlayer, setFirstPlayer] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResults, setRollResults] = useState(null);
  // Keep the screen from going to sleep
    useEffect(() => {
      const keepScreenOn = async () => {
        await KeepAwake.keepAwake();
      };
      keepScreenOn();
    }, []);
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

    const handleRollDice = () => {
        setIsRolling(true);

        // Quick delay for "rolling" suspense
        setTimeout(() => {
          let p1 = Math.floor(Math.random() * 20) + 1;
          let p2 = Math.floor(Math.random() * 20) + 1;

          // Reroll if there's a tie
          while (p1 === p2) {
            p2 = Math.floor(Math.random() * 20) + 1;
          }

          setRollResults({ p1, p2 });
          const winner = p1 > p2 ? 1 : 2;

          // Leave the results on screen for 2.5 seconds before starting the game
          setTimeout(() => {
            setFirstPlayer(winner);
            setIsRolling(false);
            setRollResults(null);
          }, 2500);
        }, 600);
      };

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
          <div
            className={`attack-panel ${panelClass}`}
            style={{ backgroundColor: currentPanelColor }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="panel-life-display">
                            {/* P2 gets inverted if P2 is the target */}
                            <MiniLife
                              label="P2"
                              life={player2Life}
                              onUpdate={(d) => updatePlayerLife(2, d)}
                              inverted={targetPlayer === 2}
                            />

                            {/* P1 gets inverted if P1 is the target */}
                            <MiniLife
                              label="P1"
                              life={player1Life}
                              onUpdate={(d) => updatePlayerLife(1, d)}
                              inverted={targetPlayer === 1}
                            />
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

                  {isRolling ? (
                    <div className="roll-display">
                      {rollResults ? (
                        <>
                          <div className="dice-results">
                            <div className="dice-score">
                              <span>P2</span>
                              <strong>{rollResults.p2}</strong>
                            </div>
                            <div className="dice-score">
                              <span>P1</span>
                              <strong>{rollResults.p1}</strong>
                            </div>
                          </div>
                          <h3 className="roll-winner">Player {rollResults.p1 > rollResults.p2 ? 1 : 2} goes first!</h3>
                        </>
                      ) : (
                        <h3 style={{ opacity: 0.7 }}>Rolling d20s...</h3>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="block-buttons" style={{ marginBottom: "16px" }}>
                        <button onClick={() => setFirstPlayer(2)}>Player 2</button>
                        <button onClick={() => setFirstPlayer(1)}>Player 1</button>
                      </div>
                      <button className="roll-button" onClick={handleRollDice}>🎲 Roll d20s</button>
                    </>
                  )}
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

const MiniLife = ({ label, life, onUpdate, inverted }) => (
  // We dynamically add the inverted class here
  <div className={`mini-life ${inverted ? "mini-life-inverted" : ""}`}>
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
