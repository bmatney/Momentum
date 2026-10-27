import { useState, useEffect, useCallback, useReducer, useRef, useEffectEvent, memo } from "react";

import { gameReducer, loadGame, saveGame, initialGame } from './game';
import Modal from './Modal';

// Capacitor Imports
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';

// Assets & Styles
import logo from './assets/logo.png';
import "./App.css";

// =========================================
// 1. CONSTANTS & CONFIG
// =========================================
const DEFAULT_STAT = 4;
const ZONES = { HIGH: "high", MID: "mid", LOW: "low" };

// =========================================
// 2. MEMOIZED SUB-COMPONENTS
// =========================================
const PlayerSection = memo(({ num, life, onUpdate, onOpen, rotated, isFirst }) => (
  <div className={`player ${rotated ? "player-rotate" : ""}`} onClick={() => onOpen(num)}>
    <button className={`player-name player-open ${isFirst ? "first-name-active" : ""}`} aria-label={`Open attack panel for player ${num}`} onClick={e => { e.stopPropagation(); onOpen(num); }}>
      PLAYER {num}
    </button>

    <div className="life-total">{life}</div>

    <div className="controls">
      <button aria-label={`Decrease player ${num} life`} onClick={(e) => { e.stopPropagation(); onUpdate(num, -1); }}>-</button>
      <button aria-label={`Increase player ${num} life`} onClick={(e) => { e.stopPropagation(); onUpdate(num, 1); }}>+</button>
    </div>
  </div>
));

const MiniLife = memo(({ num, label, life, onUpdate, inverted }) => (
  <div className={`mini-life ${inverted ? "mini-life-inverted" : ""}`}>
    <span className="mini-label">{label} LIFE</span>
    <div className="mini-life-val">{life}</div>
    <div className="mini-controls">
      <button aria-label={`Decrease ${label} life`} onClick={() => onUpdate(num, -1)}>-</button>
      <button aria-label={`Increase ${label} life`} onClick={() => onUpdate(num, 1)}>+</button>
    </div>
  </div>
));

const StatControl = memo(({ label, val, set }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{val}</div>
    <div className="stat-controls">
      <button aria-label={`Decrease ${label}`} onClick={() => set(v => v - 1)}>-</button>
      <button aria-label={`Increase ${label}`} onClick={() => set(v => v + 1)}>+</button>
    </div>
  </div>
));

// =========================================
// 3. MAIN APPLICATION COMPONENT
// =========================================
function App() {

  // --- State: Game Stats ---
  const [game, dispatch] = useReducer(gameReducer, undefined, () => {
    try { return loadGame(window.localStorage); } catch { return initialGame; }
  });
  const { baseLifeP1, baseLifeP2, player1Life, player2Life, firstPlayer, diceRolls, gameOver, history } = game;
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    let saved = false;
    try { saved = saveGame(window.localStorage, game); } catch { /* Storage can be unavailable. */ }
    // Storage is an external system; reflect its write result in the UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveFailed(!saved);
  }, [game]);

  // --- State: Attack Panel ---
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [attackSpeed, setAttackSpeed]   = useState(DEFAULT_STAT);
  const [attackDamage, setAttackDamage] = useState(DEFAULT_STAT);
  const [attackZone, setAttackZone]     = useState(ZONES.HIGH);

  // --- State: UI & Flow ---
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // --- State: Touch Gestures ---
  const touchStart = useRef(null);

  // --- Helpers ---
  const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
    try {
      await Haptics.impact({ style });
    } catch {
      // Silently fail on web environments
    }
  }, []);

  // --- Lifecycle: Device Initialization ---
  useEffect(() => {
    let cancelled = false;
    let splashTimer;
    const initApp = async () => {
      try { await KeepAwake.keepAwake(); }
      catch (e) { console.warn("KeepAwake not available:", e); }

      if (cancelled) return;
      try { await ScreenOrientation.lock({ orientation: 'portrait' }); }
      catch (e) { console.warn("ScreenOrientation not available:", e); }

      if (cancelled) return;
      splashTimer = setTimeout(async () => {
        try { await SplashScreen.hide(); }
        catch (e) { console.warn("SplashScreen hide failed:", e); }
      }, 2000);
    };

    initApp();
    return () => {
      cancelled = true;
      clearTimeout(splashTimer);
    };
  }, []);

  // Event callbacks see current dialog state without replacing native listeners.
  const handleBackButton = useEffectEvent(({ canGoBack }) => {
    if (targetPlayer !== null) setTargetPlayer(null);
    else if (showResetConfirm) setShowResetConfirm(false);
    else if (canGoBack) window.history.back();
    else CapApp.exitApp().catch(error => console.warn('Unable to exit app:', error));
  });
  const handlePopState = useEffectEvent(() => {
    if (targetPlayer !== null) setTargetPlayer(null);
    else if (showResetConfirm) setShowResetConfirm(false);
  });

  useEffect(() => {
    let disposed = false;
    let listener;
    const removeListener = handle => {
      handle.remove().catch(error => console.warn('Unable to remove back listener:', error));
    };
    CapApp.addListener('backButton', event => handleBackButton(event))
      .then(handle => {
        if (disposed) removeListener(handle);
        else listener = handle;
      })
      .catch(error => console.warn('Back button not available:', error));

    const onPopState = () => handlePopState();
    window.addEventListener('popstate', onPopState);
    return () => {
      disposed = true;
      if (listener) removeListener(listener);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Keep browser history and body styling in sync with dismissible dialogs.
  useEffect(() => {
    const isModalOpen = targetPlayer !== null || showResetConfirm;

    if (isModalOpen) {
      document.body.classList.add('modal-open');
      if (window.location.hash !== "#modal") {
        window.history.pushState(null, "", "#modal");
      }
    } else {
      document.body.classList.remove('modal-open');
      if (window.location.hash === "#modal") {
        window.history.back();
      }
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [targetPlayer, showResetConfirm]);

  // --- Logic: Game Actions ---
  const updatePlayerLife = useCallback((playerNum, delta) => {
    dispatch({ type: 'life', player: playerNum, delta });
    if (delta !== 0) triggerHaptic(ImpactStyle.Light);
  }, [triggerHaptic]);

  const updateBaseLife = (playerNum, delta) => {
    triggerHaptic(ImpactStyle.Light);
    dispatch({ type: 'base', player: playerNum, delta });
  };

  const resetGame = () => {
    dispatch({ type: 'reset' });
    setTargetPlayer(null);
    setShowResetConfirm(false);
    setAttackSpeed(DEFAULT_STAT);
    setAttackDamage(DEFAULT_STAT);
    setAttackZone(ZONES.HIGH);
    triggerHaptic(ImpactStyle.Heavy);
  };

  const handleUndo = () => {
    dispatch({ type: 'undo' });
    setTargetPlayer(null);
    triggerHaptic(ImpactStyle.Medium);
  };

  const rollDice = () => {
    triggerHaptic(ImpactStyle.Heavy);
    let p1, p2;
    do {
      p1 = Math.floor(Math.random() * 20) + 1;
      p2 = Math.floor(Math.random() * 20) + 1;
    } while (p1 === p2);

    dispatch({ type: 'roll', rolls: { p1, p2, winner: p1 > p2 ? 1 : 2 } });
  };

  const openAttackPanel = useCallback((num) => {
    triggerHaptic(ImpactStyle.Medium);
    setTargetPlayer(num);
    setAttackSpeed(DEFAULT_STAT);
    setAttackDamage(DEFAULT_STAT);
    setAttackZone(ZONES.HIGH);
  }, [triggerHaptic]);

  const applyDamage = (amount) => {
    const resolvedDamage = Math.max(0, amount);
    updatePlayerLife(targetPlayer, -resolvedDamage);
    setTargetPlayer(null);
  };

  // --- Logic: Gesture Handling ---
  const handleTouchStart = (e) => {
    const touch = e.targetTouches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (e) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !e.changedTouches.length) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - start.x;
    const deltaY = touchEndY - start.y;

    // Swipe Right OR Swipe Down clears modals
    if ((deltaX > 75 && Math.abs(deltaX) > Math.abs(deltaY)) ||
        (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX))) {
      if (targetPlayer !== null) setTargetPlayer(null);
      if (showResetConfirm) setShowResetConfirm(false);
    }

  };

  // =========================================
  // RENDER
  // =========================================
  return (
    <div className="container main-screen">
      <img src={logo} alt="Momentum Logo" className="background-watermark" />

      {saveFailed && <p role="alert" className="save-warning">Game could not be saved. Keep the app open to preserve this match.</p>}
      {/* --- MAIN GAME AREA --- */}
      <div className="game-area" inert={!firstPlayer || !!gameOver || targetPlayer !== null || showResetConfirm}>
        <PlayerSection
          num={2}
          life={player2Life}
          onUpdate={updatePlayerLife}
          onOpen={openAttackPanel}
          rotated
          isFirst={firstPlayer === 2}
        />

        <div className="center-divider">
          <div style={{ display: 'flex', gap: '15px', zIndex: 20 }}>
            <button
              className="divider-reset-btn"
              onClick={() => setShowResetConfirm(true)}
              aria-label="Reset"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              className="divider-undo-btn"
              onClick={handleUndo}
              disabled={!history.length}
              aria-label="Undo"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            </button>
          </div>
        </div>

        <PlayerSection
          num={1}
          life={player1Life}
          onUpdate={updatePlayerLife}
          onOpen={openAttackPanel}
          isFirst={firstPlayer === 1}
        />
      </div>

      {/* --- INITIAL SETUP & DICE ROLL MODAL --- */}
      {!firstPlayer && !gameOver && (
        <div className="modal-backdrop">
          <Modal label="Game setup" className="attack-panel attack-face-up">

            {diceRolls ? (
              <>
                <h2>Roll Results</h2>
                <div className="dice-results">
                  <div className="dice-score">
                    <span>P1 Roll</span>
                    <strong>{diceRolls.p1}</strong>
                  </div>
                  <div className="dice-score">
                    <span>P2 Roll</span>
                    <strong>{diceRolls.p2}</strong>
                  </div>
                </div>

                <h3 className="roll-winner" style={{ textAlign: 'center' }}>
                  Player {diceRolls.winner} goes first!
                </h3>

                <button
                  className="roll-button"
                  onClick={() => { dispatch({ type: 'start', player: diceRolls.winner }); }}
                >
                  START GAME
                </button>
              </>
            ) : (
              <>
                <div className="setup-title">Starting Life</div>
                <div className="dice-results">
                  <div className="dice-score">
                    <span>P1 Total</span>
                    <strong>{baseLifeP1}</strong>
                    <div className="stat-controls">
                      <button aria-label="Decrease player 1 starting life" onClick={() => updateBaseLife(1, -1)}>-</button>
                      <button aria-label="Increase player 1 starting life" onClick={() => updateBaseLife(1, 1)}>+</button>
                    </div>
                  </div>
                  <div className="dice-score">
                    <span>P2 Total</span>
                    <strong>{baseLifeP2}</strong>
                    <div className="stat-controls">
                      <button aria-label="Decrease player 2 starting life" onClick={() => updateBaseLife(2, -1)}>-</button>
                      <button aria-label="Increase player 2 starting life" onClick={() => updateBaseLife(2, 1)}>+</button>
                    </div>
                  </div>
                </div>

                <div className="setup-title">Who Goes First?</div>
                <div className="block-buttons">
                  <button onClick={() => dispatch({ type: 'start', player: 1 })}>Player 1</button>
                  <button onClick={() => dispatch({ type: 'start', player: 2 })}>Player 2</button>
                </div>
                <button className="roll-button" onClick={rollDice}>🎲 ROLL D20s</button>
              </>
            )}

          </Modal>
        </div>
      )}

      {/* --- ATTACK CALCULATION MODAL --- */}
      {targetPlayer && !gameOver && (
        <div
          className="modal-backdrop"
          onClick={() => setTargetPlayer(null)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { touchStart.current = null; }}
        >
          <Modal label="Attack calculation" onClose={() => setTargetPlayer(null)}
            className={`attack-panel ${targetPlayer === 1 ? "attack-face-down" : "attack-face-up"}`}
          >
            <button onClick={() => setTargetPlayer(null)}>Close Attack</button>
            <div className="panel-life-display">
              {targetPlayer === 1 ? (
                <>
                  <MiniLife num={2} label="P2" life={player2Life} onUpdate={updatePlayerLife} />
                  <MiniLife num={1} label="P1" life={player1Life} onUpdate={updatePlayerLife} inverted />
                </>
              ) : (
                <>
                  <MiniLife num={1} label="P1" life={player1Life} onUpdate={updatePlayerLife} />
                  <MiniLife num={2} label="P2" life={player2Life} onUpdate={updatePlayerLife} inverted />
                </>
              )}
            </div>

            <div className="stat-group">
              <StatControl label="Speed" val={attackSpeed} set={setAttackSpeed} />
              <StatControl label="Damage" val={attackDamage} set={setAttackDamage} />
            </div>

            <div className="zone-buttons">
              {Object.values(ZONES).map(z => (
                <button
                  key={z}
                  data-zone={z}
                  className={attackZone === z ? "selected-zone" : ""}
                  onClick={() => { setAttackZone(z); triggerHaptic(); }}
                >
                  {z.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="block-buttons">
              <button onClick={() => applyDamage(attackDamage)}>No Block</button>
              <button onClick={() => applyDamage(Math.ceil(attackDamage / 2))}>Half Block</button>
              <button onClick={() => applyDamage(0)}>Full Block</button>
            </div>
          </Modal>
        </div>
      )}

      {/* --- RESET CONFIRMATION MODAL --- */}
      {showResetConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowResetConfirm(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { touchStart.current = null; }}
        >
          <Modal label="Reset game?" onClose={() => setShowResetConfirm(false)} className="attack-panel game-over-panel">
            <h2>Reset Game?</h2>
            <div className="block-buttons">
              <button style={{ backgroundColor: "#34495e" }} onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button style={{ backgroundColor: "#ED1C24" }} onClick={resetGame}>Reset</button>
            </div>
          </Modal>
        </div>
      )}

      {/* --- GAME OVER MODAL --- */}
      {gameOver && (
        <div className="modal-backdrop">
          <Modal label={`Player ${gameOver} wins`} className="attack-panel game-over-panel">
            <h2>PLAYER {gameOver} WINS!</h2>
            <button onClick={handleUndo} disabled={!history.length}>Undo Last Change</button>
            <button className="reset-button" onClick={resetGame}>New Game</button>
          </Modal>
        </div>
      )}
    </div>
  );
}

export default App;
