import { useState, useEffect, useRef, useCallback, memo } from "react";
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App as CapacitorApp } from '@capacitor/app';
import "./App.css";

// 1. HOISTED VARIABLES: These never change, so they live outside the component
const START_LIFE = 25;
const DEFAULT_STAT = 4;
const zoneColors = {
  "high": "#ED1C24",   // Red
  "mid": "#F7941D",    // Orange
  "low": "#FFDE00",    // Yellow
  "default": "#2c3e50" // Your standard panel background color
};

function App() {
  const [player1Life, setPlayer1Life] = useState(START_LIFE);
  const [player2Life, setPlayer2Life] = useState(START_LIFE);
  const [targetPlayer, setTargetPlayer] = useState(null);

  const [attackSpeed, setAttackSpeed] = useState(DEFAULT_STAT);
  const [attackDamage, setAttackDamage] = useState(DEFAULT_STAT);
  const [attackZone, setAttackZone] = useState("high");
  const [gameOver, setGameOver] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false); // <-- Add this line

  // HAPTICS HELPER
  const triggerHaptic = async (style = ImpactStyle.Light) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Silently fail if testing on a desktop browser
    }
  };

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

  const isPanelOpen = useRef(false);
  useEffect(() => {
    isPanelOpen.current = targetPlayer !== null;
  }, [targetPlayer]);

  // FIXED: Android Native Back Button Interceptor
  useEffect(() => {
    // Save the promise so the cleanup function can properly await and remove it
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (isPanelOpen.current) {
        window.history.back();
      } else {
        CapacitorApp.minimizeApp();
      }
    });

    return () => {
      // Safely remove the listener once the promise resolves
      listenerPromise.then(listener => listener.remove());
    };
  }, []);

  // FIXED: Pure math function. No side effects inside state setters!
  const updatePlayerLife = useCallback((playerNum, delta) => {
    triggerHaptic(ImpactStyle.Light);
    if (playerNum === 1) {
      setPlayer1Life((prev) => Math.max(0, prev + delta));
    } else {
      setPlayer2Life((prev) => Math.max(0, prev + delta));
    }
  }, []);

  // NEW: Safely watch for Game Over condition natively outside of the state setter
  useEffect(() => {
    if (player1Life === 0) {
      setGameOver(2);
      triggerHaptic(ImpactStyle.Heavy);
    } else if (player2Life === 0) {
      setGameOver(1);
      triggerHaptic(ImpactStyle.Heavy);
    }
  }, [player1Life, player2Life]);

  const applyAttack = (type) => {
    if (targetPlayer === null) return;

    let damage = 0;
    if (type === "half") damage = Math.ceil(attackDamage / 2);
    else if (type === "unblocked") damage = attackDamage;

    damage = Math.max(0, damage);

    if (damage > 0) triggerHaptic(ImpactStyle.Heavy);

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

    if (Math.abs(distanceX) > 50 && Math.abs(distanceX) > Math.abs(distanceY)) {
      closePanel();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const panelClass = targetPlayer === 1 ? "attack-face-down" : "attack-face-up";

  const handleRollDice = () => {
    setIsRolling(true);
    triggerHaptic(ImpactStyle.Medium);

    setTimeout(() => {
      let p1 = Math.floor(Math.random() * 20) + 1;
      let p2 = Math.floor(Math.random() * 20) + 1;

      while (p1 === p2) {
        p2 = Math.floor(Math.random() * 20) + 1;
      }

      setRollResults({ p1, p2 });
      const winner = p1 > p2 ? 1 : 2;

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

        <div className="center-divider">
                  <button
                    className="divider-reset-btn"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    ↺
                  </button>
                </div>
        <PlayerSection
          num={1}
          life={player1Life}
          onUpdate={updatePlayerLife}
          onOpen={() => setTargetPlayer(1)}
          rotated={false}
          isFirst={firstPlayer === 1}
        />
      </div>

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
              <MiniLife
                label="P2"
                life={player2Life}
                onUpdate={(d) => updatePlayerLife(2, d)}
                inverted={targetPlayer === 2}
              />
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
                <button
                  key={z}
                  className={attackZone === z ? "selected-zone" : ""}
                  onClick={() => setAttackZone(z)}
                  data-zone={z}
                >
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
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="attack-panel game-over-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 10px 0" }}>Reset Game?</h2>
            <p style={{ marginBottom: "25px", opacity: 0.8 }}>Are you sure you want to restart? All life totals will be lost.</p>
            <div className="block-buttons">
              <button onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button style={{ backgroundColor: "#ED1C24" }} onClick={() => window.location.reload()}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 2. MEMOIZED COMPONENTS: Only re-render if their specific stats change
const PlayerSection = memo(({ num, life, onUpdate, onOpen, rotated, isFirst }) => (
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
));

const MiniLife = memo(({ label, life, onUpdate, inverted }) => (
  <div className={`mini-life ${inverted ? "mini-life-inverted" : ""}`}>
    <span className="mini-label">{label} LIFE</span>
    <div className="mini-life-val">{life}</div>
    <div className="mini-controls">
      <button onClick={() => onUpdate(-1)}>-</button>
      <button onClick={() => onUpdate(1)}>+</button>
    </div>
  </div>
));

const StatControl = memo(({ label, val, set }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{val}</div>
    <div className="stat-controls">
      <button onClick={() => set(v => v - 1)}>-</button>
      <button onClick={() => set(v => v + 1)}>+</button>
    </div>
  </div>
));

export default App;
