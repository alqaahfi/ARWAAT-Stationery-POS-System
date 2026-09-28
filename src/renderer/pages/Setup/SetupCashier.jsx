import React, { useState, useEffect } from 'react';
import theme from '../../config/theme';
import { Label, TextInput, Banner, Button } from '../../components/ui';

export default function SetupCashier({ onActivated, onBack }) {
  const [stationCode, setStationCode] = useState('');
  const [syncSecret, setSyncSecret] = useState('');
  const [error, setError] = useState('');
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  async function handleActivate() {
    setError('');
    if (!stationCode.trim()) {
      setError('Enter a station code for this PC, e.g. C1');
      return;
    }
    if (!syncSecret.trim()) {
      setError("Enter the Sync Secret shown on the Admin PC's screen.");
      return;
    }
    const res = await window.api.license.activateCashier({ 
      stationCode: stationCode.trim(), 
      syncSecret: syncSecret.trim() 
    });
    if (!res.success) {
      setError('Could not save cashier setup.');
      return;
    }
    onActivated();
  }

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes popUp {
            0% { opacity: 0; transform: scale(0.9) translateY(20px); }
            60% { transform: scale(1.02) translateY(-5px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes ambientDrift {
            0% { transform: scale(1) translate(0px, 0px); }
            50% { transform: scale(1.05) translate(-15px, -15px); }
            100% { transform: scale(1) translate(0px, 0px); }
          }
          @keyframes pulseBorder {
            0% { border-color: #facc15; }
            50% { border-color: #ec4899; }
            100% { border-color: #facc15; }
          }
          * { box-sizing: border-box; }
        `}
      </style>

      {/* Vibrant Comic / Pop Art Halftone Background */}
      <div style={styles.bgImageLayer} />
      
      {/* Deep colorful overlay to make text readable but keep the pop */}
      <div style={styles.bgColorOverlay} />

      {/* Halftone dot pattern overlay */}
      <div style={styles.comicHalftoneOverlay} />

      {/* Immersive Bold Branding */}
      <div style={styles.backgroundBrand}>POS</div>

      {/* Dynamic light tracking the cursor - Neon Yellow/Pink */}
      <div 
        style={{
          ...styles.cursorGlow,
          background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(236, 72, 153, 0.15), transparent 40%)`
        }} 
      />

      {/* Main Comic-Glassmorphism Card */}
      <div 
        style={{
          ...styles.card, 
          opacity: isLoaded ? 1 : 0, 
          animation: isLoaded ? 'popUp 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none'
        }}
      >
        <div style={styles.cardHeader}>
          {onBack && (
            <button style={styles.backButton} onClick={onBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
          )}
          <div style={styles.comicPill}>
            <span>ZAP! CONNECTION SETUP</span>
          </div>
        </div>

        <h2 style={styles.title}>CASHIER TERMINAL</h2>
        <p style={styles.subtitle}>
          This PC auto-detects the Admin hub. Just punch in your <strong>Station Code</strong> and the secret <strong>Sync Code</strong> to link 'em up!
        </p>

        <div style={styles.formContainer}>
          <div style={styles.inputGroup}>
            <Label style={styles.label}>STATION ID</Label>
            <TextInput
              value={stationCode}
              onChange={(e) => setStationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. C1"
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <Label style={styles.label}>SECRET SYNC CODE</Label>
            <TextInput
              value={syncSecret}
              onChange={(e) => setSyncSecret(e.target.value.trim())}
              placeholder="Enter the code from Admin PC"
              style={{ ...styles.input, fontFamily: '"JetBrains Mono", monospace' }}
            />
          </div>

          {error && <Banner style={styles.banner}>{error}</Banner>}

          <Button 
            onClick={handleActivate} 
            style={styles.comicButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-4px, -4px)';
              e.currentTarget.style.boxShadow = '8px 8px 0px #000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(0px, 0px)';
              e.currentTarget.style.boxShadow = '4px 4px 0px #000';
            }}
          >
            ACTIVATE TERMINAL!
          </Button>
        </div>
      </div>
    </div>
  );
}

// Comic / Pop-Art Style System
const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a', 
    fontFamily: '"Inter", "SF Pro Display", -apple-system, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  bgImageLayer: {
    position: 'absolute',
    top: -30, left: -30, right: -30, bottom: -30,
    // A vibrant, colorful abstract background
    backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'saturate(200%) contrast(120%)',
    animation: 'ambientDrift 30s ease-in-out infinite',
    zIndex: 0,
  },
  bgColorOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'linear-gradient(135deg, rgba(59, 36, 110, 0.85) 0%, rgba(20, 10, 40, 0.95) 100%)', // Deep purple comic night gradient
    zIndex: 1,
  },
  comicHalftoneOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1.5px, transparent 1.5px)',
    backgroundSize: '12px 12px',
    zIndex: 2,
    pointerEvents: 'none',
  },
  backgroundBrand: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-5deg)', // Dutch angle for comic feel
    fontSize: '28vw',
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#ffffff',
    opacity: 0.03,
    letterSpacing: '-0.05em',
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 2,
    whiteSpace: 'nowrap',
    textShadow: '10px 10px 0px rgba(0,0,0,0.5)',
  },
  cursorGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
    zIndex: 3,
    transition: 'background 0.1s ease-out',
  },
  card: {
    position: 'relative',
    zIndex: 4,
    display: 'flex',
    flexDirection: 'column',
    width: '480px',
    padding: '48px 48px',
    // Glassmorphism meets comic book border
    background: 'rgba(20, 10, 40, 0.6)', 
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '4px solid #facc15', // Thick neon yellow comic border
    boxShadow: '12px 12px 0px rgba(0, 0, 0, 0.8)', // Hard comic drop shadow
    animation: 'pulseBorder 4s infinite',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    background: '#ec4899', // Hot pink
    border: '3px solid #000',
    borderRadius: '50%',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '3px 3px 0px #000',
  },
  comicPill: {
    background: '#facc15', // Neon Yellow
    padding: '6px 14px',
    borderRadius: '4px',
    border: '2px solid #000',
    marginLeft: 'auto',
    transform: 'rotate(2deg)',
    boxShadow: '3px 3px 0px #000',
    color: '#000',
    fontWeight: '900',
    fontSize: '12px',
    letterSpacing: '1px',
  },
  title: { 
    fontSize: '36px', 
    fontWeight: '900', 
    color: '#ffffff',
    margin: '0 0 12px 0',
    letterSpacing: '-1px',
    textTransform: 'uppercase',
    textShadow: '3px 3px 0px #ec4899', // Hot pink shadow
    fontStyle: 'italic',
  },
  subtitle: { 
    color: '#cbd5e1',
    fontSize: '15px',
    lineHeight: '1.6',
    fontWeight: '500',
    margin: '0 0 32px 0',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#38bdf8', // Bright Cyan
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textShadow: '1px 1px 0px #000',
  },
  input: {
    backgroundColor: '#fff',
    border: '3px solid #000',
    padding: '16px 16px',
    borderRadius: '8px',
    color: '#000',
    outline: 'none',
    fontSize: '16px',
    fontWeight: '700',
    width: '100%',
    boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.05)', // Inner comic shadow
  },
  banner: {
    backgroundColor: '#ef4444', 
    border: '3px solid #000',
    color: '#fff',
    padding: '14px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '800',
    textTransform: 'uppercase',
    boxShadow: '4px 4px 0px #000',
  },
  comicButton: {
    width: '100%',
    marginTop: '8px',
    padding: '18px',
    backgroundColor: '#38bdf8', // Cyan base
    color: '#000', 
    border: '4px solid #000',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: '900',
    fontStyle: 'italic',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '4px 4px 0px #000',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  }
};