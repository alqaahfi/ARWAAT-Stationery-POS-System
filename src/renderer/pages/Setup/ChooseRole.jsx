import React, { useState, useEffect } from 'react';

export default function ChooseRole({ onChoose }) {
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [hoverAdmin, setHoverAdmin] = useState(false);
  const [hoverCashier, setHoverCashier] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Smooth cursor tracking and load state
  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={styles.container}>
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
          * {
            box-sizing: border-box;
          }
        `}
      </style>

      {/* Modern, abstract dark mesh background */}
      <div style={styles.bgImageLayer} />
      
      {/* Sleek vignette/dark overlay to ensure contrast */}
      <div style={styles.bgDarkOverlay} />

      {/* Immersive ARWAAT background branding */}
      <div style={styles.backgroundBrand}>
        ARWAAT
      </div>

      {/* Dynamic light tracking the cursor for interaction */}
      <div 
        style={{
          ...styles.cursorGlow,
          background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.04), transparent 40%)`
        }} 
      />

      {/* Main UI Card */}
      <div style={{...styles.card, opacity: isLoaded ? 1 : 0, transform: isLoaded ? 'translateY(0)' : 'translateY(20px)'}}>
        
        <div style={styles.header}>
          <div style={styles.dotIndicator} />
          <p style={styles.systemStatus}>SYSTEM INITIALIZATION</p>
        </div>

        <h1 style={styles.title}>Select Environment</h1>
        <p style={styles.subtitle}>Choose your operational workspace to proceed.</p>
        
        <div style={styles.buttonRow}>
          {/* Admin Button */}
          <button 
            style={{
              ...styles.roleButton,
              ...(hoverAdmin ? styles.adminButtonHover : {})
            }}
            onMouseEnter={() => setHoverAdmin(true)}
            onMouseLeave={() => setHoverAdmin(false)}
            onClick={() => onChoose('admin')}
          >
            <div style={styles.iconWrapper(hoverAdmin)}>
              <AdminIcon hover={hoverAdmin} />
            </div>
            <span style={styles.buttonText}>System Admin</span>
            <span style={styles.buttonSubtext}>Configuration & Management</span>
          </button>

          {/* Cashier Button */}
          <button 
            style={{
              ...styles.roleButton,
              ...(hoverCashier ? styles.cashierButtonHover : {})
            }}
            onMouseEnter={() => setHoverCashier(true)}
            onMouseLeave={() => setHoverCashier(false)}
            onClick={() => onChoose('cashier')}
          >
            <div style={styles.iconWrapper(hoverCashier)}>
              <CashierIcon hover={hoverCashier} />
            </div>
            <span style={styles.buttonText}>Point of Sale</span>
            <span style={styles.buttonSubtext}>Terminal & Transactions</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimalist Admin Icon (Key / Security Access)
const AdminIcon = ({ hover }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={hover ? "#000" : "#fff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.3s ease' }}>
    <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
    <circle cx="16.5" cy="7.5" r=".5" />
  </svg>
);

// Minimalist Cashier Icon (Modern POS Register)
const CashierIcon = ({ hover }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={hover ? "#000" : "#fff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.3s ease' }}>
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="8" y="8" width="8" height="4" rx="1" ry="1" />
    <path d="M16 16h.01" />
    <path d="M12 16h.01" />
    <path d="M8 16h.01" />
  </svg>
);

// Design System / Styles
const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    fontFamily: '"Inter", "SF Pro Display", -apple-system, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  bgImageLayer: {
    position: 'absolute',
    top: -30, left: -30, right: -30, bottom: -30,
    // Modern minimal dark architectural/geometric image
    backgroundImage: 'url("https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=2000&q=80")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'grayscale(100%) contrast(120%)',
    animation: 'ambientDrift 40s ease-in-out infinite',
    zIndex: 0,
  },
  bgDarkOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'radial-gradient(circle at center, rgba(10, 10, 10, 0.6) 0%, rgba(10, 10, 10, 0.95) 100%)',
    zIndex: 1,
  },
  backgroundBrand: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '18vw',
    fontWeight: '900',
    color: '#ffffff',
    opacity: 0.02,
    letterSpacing: '-0.05em',
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 2,
    whiteSpace: 'nowrap',
  },
  cursorGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
    zIndex: 3,
    transition: 'background 0.15s ease-out',
  },
  card: {
    position: 'relative',
    zIndex: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '64px 80px',
    background: 'rgba(20, 20, 20, 0.4)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    borderRadius: '32px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  dotIndicator: {
    width: '8px',
    height: '8px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    boxShadow: '0 0 10px rgba(255,255,255,0.8)',
  },
  systemStatus: {
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: '#888',
    margin: 0,
  },
  title: { 
    fontSize: '36px', 
    fontWeight: '500', 
    color: '#ffffff',
    margin: '0 0 12px 0',
    letterSpacing: '-1px'
  },
  subtitle: { 
    color: '#737373',
    fontSize: '16px',
    marginBottom: '48px',
    fontWeight: '400',
    margin: '0 0 48px 0',
  },
  buttonRow: { 
    display: 'flex', 
    gap: '20px' 
  },
  roleButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '32px',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.02)',
    cursor: 'pointer',
    width: '240px',
    height: '180px',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrapper: (isHovered) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
    marginBottom: 'auto',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  }),
  buttonText: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: '6px',
    transition: 'color 0.3s ease',
  },
  buttonSubtext: {
    fontSize: '13px',
    color: '#666666',
    fontWeight: '400',
    transition: 'color 0.3s ease',
  },
  adminButtonHover: {
    transform: 'translateY(-8px)',
    background: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
  },
  cashierButtonHover: {
    transform: 'translateY(-8px)',
    background: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
  },
};