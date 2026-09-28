import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import { Label, TextInput, Banner, Button } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Track cursor position for the ambient interactive glow
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.success) setError(res.reason || 'Authentication failed.');
  }

  return (
    <div style={styles.container}>
      {/* Inject Keyframes for smooth enter and ambient drift */}
      <style>
        {`
          @keyframes fadeUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes ambientDrift {
            0% { transform: scale(1) translate(0px, 0px); }
            50% { transform: scale(1.02) translate(-10px, -10px); }
            100% { transform: scale(1) translate(0px, 0px); }
          }
          * { box-sizing: border-box; }
        `}
      </style>

      {/* Dynamic light tracking the cursor */}
      <div
        style={{
          ...styles.glowOverlay,
          background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.05), transparent 40%)`,
        }}
      />

      {/* LEFT PANEL: Immersive Branding */}
      <div style={styles.leftPanel}>
        {/* Modern minimal dark drifting background */}
        <div style={styles.bgImageLayer} />
        
        {/* Sleek vignette/dark overlay to ensure text contrast */}
        <div style={styles.bgDarkOverlay} />
        
        {/* Huge Ambient Brand Typography */}
        <div style={styles.backgroundBrand}>ARWAAT</div>
        
        <div style={{...styles.brandContent, opacity: isLoaded ? 1 : 0, transform: isLoaded ? 'translateY(0)' : 'translateY(20px)'}}>
          {/* Minimalist Geometric Corporate Icon */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '24px' }}>
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
            <line x1="12" y1="22" x2="12" y2="15.5"></line>
            <polyline points="22 8.5 12 15.5 2 8.5"></polyline>
            <polyline points="2 15.5 12 8.5 22 15.5"></polyline>
            <line x1="12" y1="2" x2="12" y2="8.5"></line>
          </svg>

          <h1 style={styles.brandTitle}>ARWAAT</h1>
          <h2 style={styles.brandSubtitle}>Stationery Systems Inc.</h2>
          
          <div style={styles.statusWrapper}>
            <div style={styles.dotIndicator} />
            <span style={styles.statusText}>Secure POS Terminal v4.0.2 — Online & Encrypted</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Secure Login Form */}
      <div style={styles.rightPanel}>
        <form 
          onSubmit={handleSubmit}
          style={{
            ...styles.card,
            opacity: isLoaded ? 1 : 0, 
            transform: isLoaded ? 'translateY(0)' : 'translateY(20px)'
          }}
        >
          
          <div style={styles.header}>
            <div style={styles.authDotIndicator} />
            <p style={styles.systemStatus}>AUTHENTICATION REQUIRED</p>
          </div>

          <div style={styles.formHeader}>
            <h3 style={styles.title}>Terminal Access</h3>
            <p style={styles.subtitle}>Provide credentials to initialize session</p>
          </div>

          <div style={styles.inputGroup}>
            <Label style={styles.label}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Username
            </Label>
            <TextInput 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              autoFocus 
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <Label style={styles.label}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Password
            </Label>
            <TextInput 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={styles.input}
            />
          </div>

          {error && <Banner style={styles.banner}>{error}</Banner>}

          <Button 
            type="submit" 
            disabled={loading} 
            style={loading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
          >
            {loading ? 'Authenticating...' : 'Initialize Session'}
          </Button>
        </form>
      </div>
    </div>
  );
}

// Design System / Styles tailored to minimal monochrome standard
const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'row', 
    backgroundColor: '#0a0a0a',
    fontFamily: theme.font?.family || '"Inter", "SF Pro Display", -apple-system, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  glowOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
    zIndex: 4,
    transition: 'background 0.15s ease-out', 
  },
  
  // -- LEFT PANEL --
  leftPanel: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 10%',
    zIndex: 1,
    overflow: 'hidden',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  },
  bgImageLayer: {
    position: 'absolute',
    top: -30, left: -30, right: -30, bottom: -30,
    // Original requested tech background
    backgroundImage: 'url(https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'grayscale(100%) contrast(120%) brightness(0.7)', // Filtered to match minimal theme
    animation: 'ambientDrift 40s ease-in-out infinite',
    zIndex: 0,
  },
  bgDarkOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'radial-gradient(circle at center, rgba(10, 10, 10, 0.5) 0%, rgba(10, 10, 10, 0.95) 100%)',
    zIndex: 1,
  },
  backgroundBrand: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '14vw',
    fontWeight: '900',
    color: '#ffffff',
    opacity: 0.02,
    letterSpacing: '-0.05em',
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 2,
    whiteSpace: 'nowrap',
  },
  brandContent: {
    position: 'relative',
    zIndex: 3,
    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  brandTitle: {
    fontSize: '56px',
    fontWeight: '600',
    letterSpacing: '-1.5px',
    margin: '0 0 4px 0',
    color: '#FFFFFF',
  },
  brandSubtitle: {
    fontSize: '20px',
    fontWeight: '400',
    margin: '0 0 32px 0',
    color: '#737373',
  },
  statusWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '100px',
    width: 'fit-content',
    backdropFilter: 'blur(10px)',
  },
  dotIndicator: {
    width: '8px',
    height: '8px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    boxShadow: '0 0 10px rgba(255,255,255,0.8)',
  },
  statusText: {
    fontSize: '13px',
    color: '#a3a3a3',
    fontWeight: '500',
    letterSpacing: '0.5px',
  },

  // -- RIGHT PANEL --
  rightPanel: {
    width: '480px',
    backgroundColor: 'rgba(10, 10, 10, 0.7)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    boxShadow: '-30px 0 60px rgba(0,0,0,0.8)',
  },
  card: {
    width: '100%',
    padding: '0 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s', // Slight delay from left panel
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  authDotIndicator: {
    width: '6px',
    height: '6px',
    backgroundColor: '#fff',
    borderRadius: '50%',
  },
  systemStatus: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: '#888',
    margin: 0,
  },
  formHeader: {
    marginBottom: '8px',
  },
  title: { 
    fontSize: '28px', 
    fontWeight: '500', 
    letterSpacing: '-0.5px', 
    margin: '0 0 6px 0', 
    color: '#ffffff',
  },
  subtitle: {
    fontSize: '15px',
    color: '#737373',
    margin: 0,
    fontWeight: '400',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  label: {
    fontSize: '12px',
    color: '#a3a3a3',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '16px',
    borderRadius: '12px',
    color: '#FFFFFF',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontSize: '15px',
  },
  banner: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeft: '2px solid #fff',
    color: '#fff',
    padding: '14px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    backdropFilter: 'blur(10px)',
  },
  button: {
    width: '100%',
    marginTop: '12px',
    padding: '16px',
    backgroundColor: '#ffffff', // High contrast minimal button
    color: '#000000',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#737373',
    cursor: 'not-allowed',
  }
};