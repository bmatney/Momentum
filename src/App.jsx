import { useState, useEffect, useCallback, memo } from "react";
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import logo from './assets/logo.png'; 
import "./App.css";

// =========================================
// 1. CONSTANTS & CONFIG
// =========================================
const DEFAULT_STAT = 4;
const ZONES = { HIGH: "high", MID: "mid", LOW: "low" };

const zoneColors = {
  [ZONES.HIGH]: "#ED1C24",
  [ZONES.MID]: "#F7941D",
  [ZONES.LOW]: "#FFDE00",
  default: "#2c3e50"
};

// =========================================
// 2. MEMOIZED SUB-COMPONENTS
// =========================================

const PlayerSection = memo(({ num, life, onUpdate, onOpen, rotated, isFirst }) => (
  <div className={`player ${rotated ? "player-rotate" : ""}`} onClick={onOpen}>
    <div className={`player-name ${isFirst ? "first-name-active" : ""}`}>
      PLAYER {num}
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
      <button onClick={() => set(v => Math.max(0, v - 1))}>-</button>
      <button onClick={() => set(v => v + 1)}>+</button>
    </div>
  </div>
));

// =========================================
// 3. MAIN APPLICATION COMPONENT
// =========================================

function App() {
  // --- State: Game Stats ---
  const [baseLifeP1, setBaseLifeP1] = useState(25);
  const [baseLifeP2, setBaseLifeP2] = useState(25);
  const [player1Life, setPlayer1Life] = useState(25);
  const [player2Life, setPlayer2Life] = useState(25);

  // --- State: Attack Panel ---
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [attackSpeed, setAttackSpeed] = useState(DEFAULT_STAT);
  const [attackDamage, setAttackDamage] = useState(DEFAULT_STAT);
  const [attackZone, setAttackZone] = useState(ZONES.HIGH);

  // --- State: UI & Flow ---
  const [gameOver, setGameOver] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [firstPlayer, setFirstPlayer] = useState(null);
  const [diceRolls, setDiceRolls] = useState(null); 
  const [history, setHistory] = useState([]);

  // --- Helpers ---
  const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
    try { await Haptics.impact({ style }); } catch {}
  }, []);

  // --- Lifecycle: Device Init ---
  useEffect(() => {
    const initApp = async () => {
      try { 
        await KeepAwake.keepAwake(); 
        await SplashScreen.hide(); 
      } catch {}
    };
    initApp();
  }, []);

  // --- Lifecycle: Back Button Handling ---
  useEffect(() => {
    if (targetPlayer || showResetConfirm) {
      window.history.pushState({ panelOpen: true }, "");
    }
    const handleBackButton = () => {
      if (targetPlayer) setTargetPlayer(null);
      else if (showResetConfirm) setShowResetConfirm(false);
    };
    window.addEventListener("popstate", handleBackButton);
    return () => window.removeEventListener("popstate", handleBackButton);
  }, [targetPlayer, showResetConfirm]);

  // --- Logic: Game Actions ---
  const updatePlayerLife = useCallback((playerNum, delta) => {
    if (delta === 0) return;
    triggerHaptic(ImpactStyle.Light);
    setHistory(prev => [...prev, { p1: player1Life, p2: player2Life }]);

    if (playerNum === 1) {
      setPlayer1Life(prev => {
        const newVal = Math.max(0, prev + delta);
        if (newVal === 0) setGameOver(2);
        return newVal;
      });
    } else {
      setPlayer2Life(prev => {
        const newVal = Math.max(0, prev + delta);
        if (newVal === 0) setGameOver(1);
        return newVal;
      });
    }
  }, [player1Life, player2Life, triggerHaptic]);

  const resetGame = () => {
    setPlayer1Life(baseLifeP1); 
    setPlayer2Life(baseLifeP2);
    setHistory([]); 
    setFirstPlayer(null); 
    setGameOver(null);
    setShowResetConfirm(false); 
    triggerHaptic(ImpactStyle.Heavy);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setPlayer1Life(prevState.p1); 
    setPlayer2Life(prevState.p2);
    setGameOver(null); 
    setHistory(prev => prev.slice(0, -1));
    triggerHaptic(ImpactStyle.Medium);
  };

  const rollDice = () => {
    triggerHaptic(ImpactStyle.Heavy);
    let p1, p2; 
    do { 
      p1 = Math.floor(Math.random() * 20) + 1; 
      p2 = Math.floor(Math.random() * 20) + 1; 
    } while (p1 === p2);
    setDiceRolls({ p1, p2, winner: p1 > p2 ? 1 : 2 });
  };

  const openAttackPanel = (num) => {
    triggerHaptic(ImpactStyle.Medium); 
    setTargetPlayer(num);
    setAttackSpeed(DEFAULT_STAT); 
    setAttackDamage(DEFAULT_STAT); 
    setAttackZone(ZONES.HIGH);
  };

  const applyDamage = (amount) => { 
    updatePlayerLife(targetPlayer, -amount); 
    setTargetPlayer(null); 
  };

  return (
    <div className="container main-screen">
      <img src={logo} alt="Momentum Logo" className="background-watermark" />
      
      {/* 4. MAIN GAME AREA */}
      <div className="game-area">
        <PlayerSection 
          num={2} 
          life={player2Life} 
          onUpdate={updatePlayerLife} 
          onOpen={() => openAttackPanel(2)} 
          rotated 
          isFirst={firstPlayer === 2} 
        />
        
        <div className="center-divider">
          <div style={{ display: 'flex', gap: '15px', zIndex: 20 }}>
            <button className="divider-reset-btn" onClick={() => setShowResetConfirm(true)} aria-label="Reset">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button className="divider-undo-btn" onClick={handleUndo} disabled={!history.length} aria-label="Undo">
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
          onOpen={() => openAttackPanel(1)} 
          isFirst={firstPlayer === 1} 
        />
      </div>

      {/* 5. INITIAL SETUP / DICE ROLL MODAL */}
      {!firstPlayer && !gameOver && (
        <div className="modal-backdrop">
          <div className="attack-panel attack-face-up">
            {diceRolls ? (
              <>
                <h2>Roll Results</h2>
                <div className="dice-results">
                  <div className="dice-score"><span>P1 Roll</span><strong>{diceRolls.p1}</strong></div>
                  <div className="dice-score"><span>P2 Roll</span><strong>{diceRolls.p2}</strong></div>
                </div>
                <h3 className="roll-winner" style={{ textAlign: 'center' }}>Player {diceRolls.winner} goes first!</h3>
                <button className="roll-button" onClick={() => { setFirstPlayer(diceRolls.winner); setDiceRolls(null); }}>START GAME</button>
              </>
            ) : (
              <>
                <div className="stat-label">Starting Life</div>
                <div className="dice-results">
                  <div className="dice-score">
                    <span>P1 Total</span><strong>{baseLifeP1}</strong>
                    <div className="stat-controls">
                      <button onClick={() => { setBaseLifeP1(v => Math.max(1, v - 1)); setPlayer1Life(v => Math.max(1, v - 1)); triggerHaptic(); }}>-</button>
                      <button onClick={() => { setBaseLifeP1(v => v + 1); setPlayer1Life(v => v + 1); triggerHaptic(); }}>+</button>
                    </div>
                  </div>
                  <div className="dice-score">
                    <span>P2 Total</span><strong>{baseLifeP2}</strong>
                    <div className="stat-controls">
                      <button onClick={() => { setBaseLifeP2(v => Math.max(1, v - 1)); setPlayer2Life(v => Math.max(1, v - 1)); triggerHaptic(); }}>-</button>
                      <button onClick={() => { setBaseLifeP2(v => v + 1); setPlayer2Life(v => v + 1); triggerHaptic(); }}>+</button>
                    </div>
                  </div>
                </div>
                <div className="stat-label">Who Goes First?</div>
                <div className="block-buttons">
                  <button onClick={() => setFirstPlayer(1)}>Player 1</button>
                  <button onClick={() => setFirstPlayer(2)}>Player 2</button>
                </div>
                <button className="roll-button" onClick={rollDice}>🎲 ROLL D20s</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. ATTACK CALCULATION MODAL */}
      {targetPlayer && !gameOver && (
        <div className="modal-backdrop" onClick={() => setTargetPlayer(null)}>
          <div 
            className={`attack-panel ${targetPlayer === 1 ? "attack-face-down" : "attack-face-up"}`} 
            onClick={e => e.stopPropagation()} 
            style={{ backgroundColor: zoneColors[attackZone] }}
          >
            <div className="panel-life-display">
              {targetPlayer === 1 ? (
                <>
                  <MiniLife label="P2" life={player2Life} onUpdate={(d) => updatePlayerLife(2, d)} />
                  <MiniLife label="P1" life={player1Life} onUpdate={(d) => updatePlayerLife(1, d)} inverted />
                </>
              ) : (
                <>
                  <MiniLife label="P1" life={player1Life} onUpdate={(d) => updatePlayerLife(1, d)} />
                  <MiniLife label="P2" life={player2Life} onUpdate={(d) => updatePlayerLife(2, d)} inverted />
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
          </div>
        </div>
      )}

      {/* 7. RESET CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="attack-panel game-over-panel" onClick={e => e.stopPropagation()}>
            <h2>Reset Game?</h2>
            <div className="block-buttons">
              <button style={{ backgroundColor: "#34495e" }} onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button style={{ backgroundColor: "#ED1C24" }} onClick={resetGame}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* 8. GAME OVER MODAL */}
      {gameOver && (
        <div className="modal-backdrop">
          <div className="attack-panel game-over-panel">
            <h2>PLAYER {gameOver} WINS!</h2>
            <button className="reset-button" onClick={resetGame}>New Game</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;