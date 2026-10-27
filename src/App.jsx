import { useState, useEffect, useCallback, useReducer, useRef, useEffectEvent, memo } from "react";

import { gameReducer, loadGame, saveGame, initialGame, resolveDamage, healthChanges } from './game';
import Modal from './Modal';
import { defaultPreferences, loadPreferences, savePreferences } from './preferences';
import release from '../release.config.json';
import fontLicense from '../public/fonts/OFL.txt?raw';

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
const PlayerSection = memo(({ num, name, life, onUpdate, onOpen, rotated, isFirst }) => (
  <div className={`player ${rotated ? "player-rotate" : ""}`} onClick={() => onOpen(num)}>
    <button className={`player-name player-open ${isFirst ? "first-name-active" : ""}`} aria-label={`Open attack panel for player ${num}`} onClick={e => { e.stopPropagation(); onOpen(num); }}>
      {name}
    </button>

    <span className="player-caption">P{num} · {isFirst ? "Goes first" : "Tap name for attack"}</span>
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
  const [preferences, setPreferences] = useState(() => {
    try { return loadPreferences(window.localStorage); } catch { return defaultPreferences; }
  });
  const [preferencesSaveFailed, setPreferencesSaveFailed] = useState(false);
  const playerName = num => preferences.names[num - 1].trim() || `Player ${num}`;
  const updatePreferences = next => {
    setPreferences(next);
    try { setPreferencesSaveFailed(!savePreferences(window.localStorage, next)); }
    catch { setPreferencesSaveFailed(true); }
  };
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

  const [isThrow, setIsThrow] = useState(false);

  // --- State: UI & Flow ---
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [utilityPanel, setUtilityPanel] = useState(null);
  const changes = healthChanges(game);

  // --- State: Touch Gestures ---
  const touchStart = useRef(null);
  const modalHistoryOpen = useRef(false);

  // --- Helpers ---
  const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
    if (!preferences.haptics) return;
    try {
      await Haptics.impact({ style });
    } catch {
      // Silently fail on web environments
    }
  }, [preferences.haptics]);

  // --- Lifecycle: Device Initialization ---
  useEffect(() => {
    let cancelled = false;
    let splashTimer;
    const initApp = async () => {
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

  useEffect(() => {
    const apply = () => (preferences.keepAwake ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
      .catch(error => console.warn('Screen awake setting unavailable:', error));
    apply();
  }, [preferences.keepAwake]);

  // Event callbacks see current dialog state without replacing native listeners.
  const handleBackButton = useEffectEvent(({ canGoBack }) => {
    if (utilityPanel) setUtilityPanel(null);
    else if (targetPlayer !== null) setTargetPlayer(null);
    else if (showResetConfirm) setShowResetConfirm(false);
    else if (canGoBack) window.history.back();
    else CapApp.exitApp().catch(error => console.warn('Unable to exit app:', error));
  });
  const handlePopState = useEffectEvent(() => {
    modalHistoryOpen.current = false;
    if (utilityPanel) setUtilityPanel(null);
    else if (targetPlayer !== null) setTargetPlayer(null);
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

  // Only navigate back for entries created by this mounted app.
  // A reload with #modal must not navigate away from the tracker.
  useEffect(() => {
    const isModalOpen = targetPlayer !== null || showResetConfirm || utilityPanel !== null;
    if (isModalOpen && !modalHistoryOpen.current) {
      window.history.pushState({ momentumModal: true }, '', '#modal');
      modalHistoryOpen.current = true;
    } else if (!isModalOpen && modalHistoryOpen.current) {
      modalHistoryOpen.current = false;
      if (window.history.state?.momentumModal) window.history.back();
    } else if (!isModalOpen && window.location.hash === '#modal') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [targetPlayer, showResetConfirm, utilityPanel]);

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
    setIsThrow(false);
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
    setIsThrow(false);
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

      {(saveFailed || preferencesSaveFailed) && <p role="alert" className="save-warning">Changes could not be saved. Keep the app open to preserve this session.</p>}
      {/* --- MAIN GAME AREA --- */}
      <div className="game-area" inert={!firstPlayer || !!gameOver || targetPlayer !== null || showResetConfirm || utilityPanel !== null}>
        <PlayerSection
          num={2}
          name={playerName(2)}
          life={player2Life}
          onUpdate={updatePlayerLife}
          onOpen={openAttackPanel}
          rotated
          isFirst={firstPlayer === 2}
        />

        <div className="center-divider">
          <div className="toolbar">
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
            <button className="toolbar-text" onClick={() => setUtilityPanel('history')}>History</button>
            <button className="toolbar-text" onClick={() => setUtilityPanel('help')}>Help</button>
          </div>
          <span className="brand-wordmark">MOMENTUM</span>
        </div>

        <PlayerSection
          num={1}
          name={playerName(1)}
          life={player1Life}
          onUpdate={updatePlayerLife}
          onOpen={openAttackPanel}
          isFirst={firstPlayer === 1}
        />
      </div>

      {/* --- INITIAL SETUP & DICE ROLL MODAL --- */}
      {!firstPlayer && !gameOver && !utilityPanel && (
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
                  {playerName(diceRolls.winner)} chooses
                </h3>

                <p className="helper-text">The roll winner chooses to play first or second.</p>
                <div className="block-buttons">
                  <button onClick={() => dispatch({ type: 'start', player: diceRolls.winner })}>Go first</button>
                  <button onClick={() => dispatch({ type: 'start', player: 3 - diceRolls.winner })}>Go second</button>
                </div>
              </>
            ) : (
              <>
                <div className="setup-heading"><span className="eyebrow">MOMENTUM / NEW GAME</span><h1>Ready to battle?</h1></div>
                <div className="name-fields">
                  {[1, 2].map(num => <label key={num}>Player {num}
                    <input aria-label={`Player ${num} name`} maxLength={24} placeholder={`Player ${num}`} value={preferences.names[num - 1]}
                      onChange={event => updatePreferences({ ...preferences, names: preferences.names.map((name, i) => i === num - 1 ? event.target.value : name) })} />
                  </label>)}
                </div>
                <div className="setup-title">Starting health</div>
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
                  <button onClick={() => dispatch({ type: 'start', player: 1 })}>{playerName(1)}</button>
                  <button onClick={() => dispatch({ type: 'start', player: 2 })}>{playerName(2)}</button>
                </div>
                <button className="roll-button" onClick={rollDice}>🎲 ROLL D20s</button>
              </>
            )}
            <button className="text-button" onClick={() => setUtilityPanel('help')}>Help, settings & privacy</button>
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
                  aria-pressed={attackZone === z}
                  className={attackZone === z ? "selected-zone" : ""}
                  onClick={() => { setAttackZone(z); triggerHaptic(); }}
                >
                  {z.toUpperCase()}
                </button>
              ))}
            </div>

            <label className="toggle-row"><span>Throw attack<small>A full block still deals half damage, rounded up.</small></span>
              <input type="checkbox" checked={isThrow} onChange={event => setIsThrow(event.target.checked)} />
            </label>
            <p className="helper-text">Apply damage to {playerName(targetPlayer)}</p>
            <div className="block-buttons damage-buttons">
              {[['none', 'No block'], ['half', 'Half block'], ['full', 'Full block']].map(([block, label]) => {
                const amount = resolveDamage(attackDamage, block, isThrow);
                return <button key={block} onClick={() => applyDamage(amount)} aria-label={`${label}: apply ${amount} damage`}>
                  <span>{label}</span><strong>{amount}</strong><small>damage</small>
                </button>;
              })}
            </div>
          </Modal>
        </div>
      )}

      {utilityPanel && <div className="modal-backdrop" onClick={() => setUtilityPanel(null)}>
        <Modal label={utilityPanel === 'history' ? 'Health history' : 'Help and settings'} onClose={() => setUtilityPanel(null)} className="attack-panel utility-panel">
          <div className="panel-heading"><h2>{utilityPanel === 'history' ? 'Health history' : 'Momentum'}</h2>
            <button onClick={() => setUtilityPanel(null)}>Close</button></div>
          {utilityPanel === 'history' ? <>
            <p className="helper-text">Newest first. Undo removes the latest change.</p>
            {changes.length ? <ol className="health-history">{changes.map(change => <li key={change.id}>
              <span><b>{playerName(change.player)}</b><small>P{change.player} · {change.from} → {change.to}</small></span>
              <strong className={change.delta > 0 ? 'health-gain' : 'health-loss'}>{change.delta > 0 ? '+' : ''}{change.delta}</strong>
            </li>)}</ol> : <p>No health changes yet.</p>}
            <button onClick={handleUndo} disabled={!history.length}>Undo last change</button>
          </> : <>
            <p className="helper-text">An unofficial companion for UniVersus. Not affiliated with or endorsed by UVS Games.</p>
            <section><h3>Make it yours</h3>
              <label className="toggle-row"><span>Vibration<small>Feedback when you change health or roll.</small></span>
                <input type="checkbox" checked={preferences.haptics} onChange={e => updatePreferences({ ...preferences, haptics: e.target.checked })} /></label>
              <label className="toggle-row"><span>Keep screen awake<small>Keep the tracker visible during play.</small></span>
                <input type="checkbox" checked={preferences.keepAwake} onChange={e => updatePreferences({ ...preferences, keepAwake: e.target.checked })} /></label>
            </section>
            <section><h3>At the table</h3>
              <p>Use + and − to adjust health. Tap a player’s name to calculate damage to that player. Set speed, damage, zone and Throw, then choose a block result. Card effects may require a manual health adjustment.</p>
              <p>Undo corrects the last health change, even after a winning hit. History shows the current game’s changes. Reset starts a new game and keeps your starting health and names.</p>
              <p>The highlighted player goes first; it is not a turn tracker. Roll winners choose first or second.</p>
              <p>For tournament play, disable device messaging as required by the event rules and follow the organizer’s instructions.</p>
              <a href="https://uvsgames.com/universus/organized-play/rules-and-documents/" target="_blank" rel="noreferrer">Official UniVersus rules ↗</a>
            </section>
            <section><h3>Privacy</h3>
              <p>Names, game state, undo history and settings stay on this device. No account, advertising or analytics. Device backups may include app data.</p>
              <p>Reset clears the match history; names and settings stay saved. Device app-data controls can remove saved data. External links and email use their providers’ privacy policies.</p>
              {release.privacyPolicyUrl && <a href={release.privacyPolicyUrl} target="_blank" rel="noreferrer">Full privacy policy ↗</a>}
            </section>
            <section><h3>Support & credits</h3>
              <a href={`mailto:${release.supportEmail}`}>{release.supportEmail}</a>
              {release.supportUrl && <p><a href={release.supportUrl} target="_blank" rel="noreferrer">Support website ↗</a></p>}
              <p>UniVersus belongs to its respective owners. Momentum uses original app artwork.</p>
              <p>Barlow Condensed by Jeremy Tribby, licensed under the SIL Open Font License.</p>
              <details><summary>Font license</summary><pre className="license-text">{fontLicense}</pre></details>
            </section>
          </>}
        </Modal>
      </div>}

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
