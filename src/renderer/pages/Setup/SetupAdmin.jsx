import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Label, TextInput, Banner, Button } from '../../components/ui';

// resumeCreateAccount: the license is already activated (persisted in
// license_activation) but no admin user exists yet.
export default function SetupAdmin({ onActivated, onBack, resumeCreateAccount = false }) {
  const [machineId, setMachineId] = useState('');
  const [shopName, setShopName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [stationCode, setStationCode] = useState('MAIN');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(resumeCreateAccount ? 2 : 1);
  const [syncSecret, setSyncSecret] = useState('');
  const [copied, setCopied] = useState(false);

  const [mode, setMode] = useState('key'); // 'key' | 'restore'
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    setIsLoaded(true);
    window.api.license.getMachineId().then(setMachineId);

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  async function handleActivate() {
    setError('');
    if (!shopName.trim() || !licenseKey.trim()) {
      setError('HQ requires Shop Name and Activation Key!');
      return;
    }
    const res = await window.api.license.activateAdmin({
      licenseKey: licenseKey.trim().replace(/\s+/g, '').toUpperCase(),
      shopName: shopName.trim(),
      stationCode: stationCode.trim() || 'MAIN',
    });
    if (!res.success) {
      setError(res.reason ? `${res.reason} — contact ARWAAT HQ.` : 'Activation sequence failed.');
      return;
    }
    setSyncSecret(res.syncSecret || '');
    setStep('secret');
  }

  async function handleCopySecret() {
    try {
      await navigator.clipboard.writeText(syncSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked
    }
  }

  async function handleCreateAdmin() {
    setError('');
    if (!fullName.trim() || !username.trim() || password.length < 6) {
      setError('Fill all fields — password must be at least 6 characters.');
      return;
    }
    const res = await window.api.users.createFirstAdmin({
      fullName: fullName.trim(),
      username: username.trim(),
      password,
    });
    if (!res.success) {
      setError(res.reason || 'Could not forge admin profile.');
      return;
    }
    onActivated();
  }

  async function handleRestore() {
    setRestoreError('');
    setRestoring(true);
    const res = await window.api.backup.validateAndRestore();
    setRestoring(false);
    if (res.canceled) return;
    if (!res.success) {
      setRestoreError(res.reason || 'Could not restore that backup archive.');
      return;
    }
  }

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes popUp {
            0% { opacity: 0; transform: scale(0.95) translateY(20px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes ambientDrift {
            0% { transform: scale(1) translate(0px, 0px); }
            50% { transform: scale(1.05) translate(-15px, -15px); }
            100% { transform: scale(1) translate(0px, 0px); }
          }
          @keyframes pulseAdminBorder {
            0% { border-color: #38bdf8; }
            50% { border-color: #facc15; }
            100% { border-color: #38bdf8; }
          }
          * { box-sizing: border-box; }
          
          /* Custom scrollbar to keep it looking clean if it scrolls */
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.3); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.6); }
        `}
      </style>

      {/* Vibrant Comic / Pop Art Halftone Background - Changed to FIXED so it doesn't break on scroll */}
      <div style={styles.bgImageLayer} />
      
      {/* Deep authoritative blue overlay */}
      <div style={styles.bgColorOverlay} />

      {/* Halftone dot pattern overlay */}
      <div style={styles.comicHalftoneOverlay} />

      {/* Immersive Bold Branding - "HQ" to sound authoritative */}
      <div style={styles.backgroundBrand}>ADMIN HQ</div>

      {/* Dynamic light tracking the cursor - Neon Cyan */}
      <div 
        style={{
          ...styles.cursorGlow,
          background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(56, 189, 248, 0.2), transparent 40%)`
        }} 
      />

      {/* Main Comic-Glassmorphism Card */}
      <div 
        style={{
          ...styles.card, 
          opacity: isLoaded ? 1 : 0, 
          animation: isLoaded ? 'popUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none'
        }}
      >
        
        {/* Header Section */}
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
            <span>COMMAND CENTER INIT</span>
          </div>
        </div>

        <h2 style={styles.title}>ADMIN OVERRIDE</h2>

        {/* --- STEP: RESUME CREATE ACCOUNT --- */}
        {resumeCreateAccount && step === 2 && (
          <p style={styles.subtitle}>
            System core activated! Finish initialization by forging the Master Admin account below.
          </p>
        )}

        {/* --- STEP 1: KEY ACTIVATION --- */}
        {mode === 'key' && step === 1 && (
          <div style={styles.formContainer}>
            <div style={styles.inputGroup}>
              <Label style={styles.label}>SYSTEM HARDWARE ID</Label>
              <div style={styles.monoBox}>{machineId || 'SCANNING HARDWARE...'}</div>
            </div>

            <div style={styles.inputGroup}>
              <Label style={styles.label}>BASE OPERATION NAME</Label>
              <TextInput 
                value={shopName} 
                onChange={(e) => setShopName(e.target.value)} 
                placeholder="e.g. Al-Falah Base" 
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <Label style={styles.label}>HQ CLEARANCE KEY</Label>
              <TextInput
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                style={{ ...styles.input, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', letterSpacing: '2px' }}
              />
            </div>

            <div style={styles.inputGroup}>
              <Label style={styles.label}>COMMAND STATION CODE</Label>
              <TextInput
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="MAIN"
                style={styles.input}
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
              ENGAGE SYSTEM!
            </Button>

            <button style={styles.ghostLink} onClick={() => { setMode('restore'); setError(''); }}>
              DETECT PREVIOUS BACKUP ARCHIVE? RESTORE PROTOCOL
            </button>
          </div>
        )}

        {/* --- STEP 1: RESTORE BACKUP --- */}
        {mode === 'restore' && (
          <div style={styles.formContainer}>
            <p style={styles.subtitle}>
              Injecting a previous backup archive will restore shop data, clearance, and user accounts. No activation key needed. Stand by for reboot upon completion.
            </p>

            {restoreError && <Banner style={styles.banner}>{restoreError}</Banner>}

            <Button 
              onClick={handleRestore} 
              disabled={restoring} 
              style={restoring ? { ...styles.comicButton, opacity: 0.7 } : styles.comicButton}
            >
              {restoring ? 'RESTORING ARCHIVES...' : 'SELECT BACKUP DRIVE'}
            </Button>

            <button style={styles.ghostLink} onClick={() => { setMode('key'); setRestoreError(''); }}>
              &larr; ABORT. RETURN TO ACTIVATION
            </button>
          </div>
        )}

        {/* --- STEP: SYNC SECRET --- */}
        {step === 'secret' && (
          <div style={styles.formContainer}>
            <p style={styles.subtitle}>
              Clearance granted! This is your highly classified <strong>NETWORK SYNC CODE</strong>. 
              Distribute this code ONLY to Cashier Terminals to link them to the mainframe.
            </p>

            <div style={styles.inputGroup}>
              <Label style={styles.label}>MASTER SYNC CODE</Label>
              <div style={{...styles.monoBox, color: '#facc15', fontSize: '20px', padding: '24px'}}>{syncSecret}</div>
            </div>

            <Button 
              variant="secondary" 
              onClick={handleCopySecret} 
              style={styles.secondaryComicButton}
            >
              {copied ? '✓ COPIED TO SECURE CLIPBOARD' : 'COPY SECRET CODE'}
            </Button>

            <Button 
              onClick={() => setStep(2)} 
              style={styles.comicButton}
            >
              PROCEED TO ADMIN FORGING
            </Button>
          </div>
        )}

        {/* --- STEP 2: CREATE ADMIN --- */}
        {step === 2 && (
          <div style={styles.formContainer}>
            {!resumeCreateAccount && <p style={styles.subtitle}>Mainframe unlocked. Forge the Master Commander credentials.</p>}

            <div style={styles.inputGroup}>
              <Label style={styles.label}>COMMANDER FULL NAME</Label>
              <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} style={styles.input} />
            </div>

            <div style={styles.inputGroup}>
              <Label style={styles.label}>SYSTEM ALIAS (USERNAME)</Label>
              <TextInput value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} />
            </div>

            <div style={styles.inputGroup}>
              <Label style={styles.label}>SECURE PASSPHRASE</Label>
              <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
            </div>

            {error && <Banner style={styles.banner}>{error}</Banner>}

            <Button 
              onClick={handleCreateAdmin} 
              style={{ ...styles.comicButton, backgroundColor: '#facc15' }} // Yellow button for final step impact
            >
              AUTHORIZE COMMANDER!
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Comic / Pop-Art Style System - Authoritative Admin Variant
const styles = {
  container: {
    minHeight: '100vh',         // Changed from height to minHeight so it can scroll if needed
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6vh 24px',        // Added vertical and horizontal padding so it NEVER touches the borders!
    boxSizing: 'border-box',
    backgroundColor: '#0f172a', 
    fontFamily: '"Inter", "SF Pro Display", -apple-system, sans-serif',
    position: 'relative',
    overflowX: 'hidden',
    overflowY: 'auto',          // Allows scrolling on smaller screens
  },
  bgImageLayer: {
    position: 'fixed',          // Changed to fixed so background stays put when scrolling
    top: -30, left: -30, right: -30, bottom: -30,
    backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'saturate(150%) hue-rotate(180deg) contrast(130%) brightness(0.6)', 
    animation: 'ambientDrift 30s ease-in-out infinite',
    zIndex: 0,
  },
  bgColorOverlay: {
    position: 'fixed',          // Fixed positioning
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'linear-gradient(135deg, rgba(10, 20, 50, 0.9) 0%, rgba(5, 10, 20, 0.95) 100%)', 
    zIndex: 1,
  },
  comicHalftoneOverlay: {
    position: 'fixed',          // Fixed positioning
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1.5px, transparent 1.5px)',
    backgroundSize: '12px 12px',
    zIndex: 2,
    pointerEvents: 'none',
  },
  backgroundBrand: {
    position: 'fixed',          // Fixed positioning
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-3deg)', 
    fontSize: '26vw',
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
    position: 'fixed',          // Fixed positioning so light doesn't break on scroll
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
    width: '100%',              // Responsive width
    maxWidth: '540px',          // Limits maximum width
    margin: 'auto',             // Helps perfectly center in a scrolling flex container
    padding: '40px',            // Slightly reduced padding to save vertical space
    background: 'rgba(10, 15, 30, 0.65)', 
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '4px solid #38bdf8',
    boxShadow: '12px 12px 0px rgba(0, 0, 0, 0.9)', 
    animation: 'pulseAdminBorder 4s infinite',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',       // Adjusted gap
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    background: '#facc15',
    border: '3px solid #000',
    borderRadius: '50%',
    color: '#000',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '3px 3px 0px #000',
    flexShrink: 0,
  },
  comicPill: {
    background: '#38bdf8', 
    padding: '6px 14px',
    borderRadius: '4px',
    border: '2px solid #000',
    marginLeft: 'auto',
    transform: 'rotate(-2deg)', 
    boxShadow: '3px 3px 0px #000',
    color: '#000',
    fontWeight: '900',
    fontSize: '12px',
    letterSpacing: '1.5px',
  },
  title: { 
    fontSize: '32px',           // Slightly scaled down to prevent cramming
    fontWeight: '900', 
    color: '#ffffff',
    margin: '0 0 8px 0',
    letterSpacing: '-1px',
    textTransform: 'uppercase',
    textShadow: '3px 3px 0px #38bdf8', 
    fontStyle: 'italic',
  },
  subtitle: { 
    color: '#cbd5e1',
    fontSize: '14px',
    lineHeight: '1.6',
    fontWeight: '500',
    margin: '0 0 24px 0',       // Adjusted gap
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',                // Clean gap spacing between fields
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',                 // Gap between label and input
  },
  label: {
    fontSize: '12px',
    color: '#facc15',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textShadow: '1px 1px 0px #000',
  },
  input: {
    backgroundColor: '#fff',
    border: '3px solid #000',
    padding: '14px 16px',
    borderRadius: '8px',
    color: '#000',
    outline: 'none',
    fontSize: '15px',
    fontWeight: '700',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.05)', 
  },
  monoBox: {
    backgroundColor: '#0f172a',
    border: '3px solid #000',
    padding: '14px 16px',
    borderRadius: '8px',
    fontFamily: '"JetBrains Mono", "Courier New", monospace',
    fontSize: '13px',
    fontWeight: '800',
    color: '#38bdf8',
    wordBreak: 'break-all',
    textAlign: 'center',
    boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)', 
  },
  banner: {
    backgroundColor: '#ef4444', 
    border: '3px solid #000',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '800',
    textTransform: 'uppercase',
    boxShadow: '4px 4px 0px #000',
  },
  comicButton: {
    width: '100%',
    marginTop: '4px',
    padding: '16px',
    backgroundColor: '#38bdf8', 
    color: '#000', 
    border: '4px solid #000',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '900',
    fontStyle: 'italic',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '4px 4px 0px #000',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  secondaryComicButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#334155', 
    color: '#fff', 
    border: '3px solid #000',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '4px 4px 0px #000',
    textTransform: 'uppercase',
  },
  ghostLink: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    marginTop: '4px',
    fontSize: '11px',
    fontWeight: '800',
    textDecoration: 'none',
    textAlign: 'center',
    padding: '8px',
    transition: 'color 0.2s',
    letterSpacing: '1px',
  }
};