import React, { useState } from 'react';

const styles = {
  fullscreen: {
    minHeight: '100vh',
    background: 'var(--bg-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '3rem',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 8px 60px rgba(0,0,0,0.6)',
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: '-80px',
    right: '-80px',
    width: '240px',
    height: '240px',
    background: 'radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 70%)',
    pointerEvents: 'none',
    borderRadius: '50%',
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  iconCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(37,99,235,0.12)',
    border: '1px solid rgba(37,99,235,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#f0f0f5',
    textAlign: 'center',
    margin: '0 0 0.5rem 0',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '2rem',
  },
  infoBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  infoTitle: {
    fontWeight: '600',
    fontSize: '0.9rem',
    color: '#f0f0f5',
    marginBottom: '0.75rem',
  },
  infoList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent-blue)',
    flexShrink: 0,
    marginTop: '0.45rem',
  },
  btnPrimary: {
    width: '100%',
    padding: '0.9rem 1.5rem',
    background: 'var(--accent-blue)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  btnGreen: {
    width: '100%',
    padding: '0.9rem 1.5rem',
    background: '#059669',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 0 20px rgba(16,185,129,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.4)',
    color: '#f87171',
    padding: '0.9rem 1rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
  },
  addressBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1.25rem',
  },
  addressLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: '600',
    marginBottom: '0.5rem',
  },
  addressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  addressCode: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    color: '#60a5fa',
    wordBreak: 'break-all',
    flex: 1,
    background: 'rgba(37,99,235,0.08)',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid rgba(37,99,235,0.2)',
  },
  copyBtn: {
    padding: '0.5rem',
    background: 'var(--bg-dark)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    transition: 'all 0.15s',
    display: 'flex',
    flexShrink: 0,
  },
  faucetLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: '#60a5fa',
    fontSize: '0.9rem',
    fontWeight: '500',
    textDecoration: 'none',
    padding: '0.6rem 1rem',
    border: '1px solid rgba(37,99,235,0.4)',
    borderRadius: '8px',
    background: 'rgba(37,99,235,0.06)',
    transition: 'all 0.2s',
    marginBottom: '1.5rem',
    width: '100%',
    justifyContent: 'center',
  },
  divider: {
    height: '1px',
    background: 'var(--border-color)',
    margin: '1.5rem 0',
  },
  successIconCircle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.12)',
    border: '2px solid rgba(16,185,129,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem',
    boxShadow: '0 0 40px rgba(16,185,129,0.2)',
  },
  successCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1.5rem',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    marginBottom: '1.5rem',
  },
  dataLabel: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    fontWeight: '600',
    marginBottom: '0.35rem',
  },
  agentIdValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#f0f0f5',
    fontFamily: "'JetBrains Mono', monospace",
  },
  explorerLink: {
    display: 'block',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.75rem',
    color: '#60a5fa',
    wordBreak: 'break-all',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    marginTop: '0.25rem',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
  },
  stepDot: (active, done) => ({
    width: done ? '28px' : '8px',
    height: '8px',
    borderRadius: '4px',
    background: done ? '#10b981' : active ? 'var(--accent-blue)' : 'var(--border-color)',
    transition: 'all 0.3s',
  }),
};

function Spinner() {
  return (
    <svg style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function AgentSetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wallets, setWallets] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [copied, setCopied] = useState(false);

  const generateWallets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://spreadhunter.onrender.com/api/setup/generate-wallets', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setWallets(data.wallets);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(wallets.ownerWallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const registerAgent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://spreadhunter.onrender.com/api/setup/register-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerWalletAddress: wallets.ownerWallet }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setAgentData(data);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Pass the owner wallet back so App.jsx can skip WalletOnboarding
  const handleEnter = () => {
    onComplete({ address: wallets.ownerWallet, id: null, blockchain: 'ARC-TESTNET' });
  };

  return (
    <div style={styles.fullscreen}>
      <div style={styles.card}>
        <div style={styles.glow} />

        {/* Step Indicator */}
        <div style={styles.stepIndicator}>
          {[1, 2, 3].map(s => (
            <div key={s} style={styles.stepDot(step === s, step > s)} />
          ))}
        </div>

        {/* Header */}
        <div style={styles.headerIcon}>
          <div style={styles.iconCircle}>
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#60a5fa">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
        </div>
        <h1 style={styles.h1}>Agent Initial Setup</h1>
        <p style={styles.subtitle}>ERC-8004 Global Identity Registration</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* ── Step 1: Intro ── */}
        {step === 1 && (
          <div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'center', lineHeight: 1.6 }}>
              Before SpreadHunter can operate, we need to create its on-chain identity on Arc Testnet using the ERC-8004 standard.
            </p>
            <div style={styles.infoBox}>
              <p style={styles.infoTitle}>What happens next?</p>
              <ul style={styles.infoList}>
                {[
                  'Two Developer-Controlled Wallets will be created via Circle W3S.',
                  'Wallet #1 (Owner) registers the Agent\'s ERC-8004 identity.',
                  'Wallet #2 (Validator) records reputation — required by the protocol to prevent self-dealing.',
                  'No private keys are exposed or stored anywhere.'
                ].map((item, i) => (
                  <li key={i} style={styles.infoItem}>
                    <span style={styles.dot} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={generateWallets}
              disabled={loading}
              style={{ ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
            >
              {loading ? <><Spinner /> Generating Wallets...</> : 'Generate Master Wallets →'}
            </button>
          </div>
        )}

        {/* ── Step 2: Fund & Register ── */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ ...styles.successIconCircle, width: '52px', height: '52px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', margin: '0 auto 0.75rem', boxShadow: 'none' }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#10b981">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.4rem' }}>Wallets Generated!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                The Owner Wallet needs testnet ARC tokens to pay gas fees for the on-chain registration.
              </p>
            </div>

            <div style={styles.addressBox}>
              <p style={styles.addressLabel}>Owner Wallet Address</p>
              <div style={styles.addressRow}>
                <code style={styles.addressCode}>{wallets.ownerWallet}</code>
                <button onClick={copyToClipboard} style={styles.copyBtn} title="Copy to clipboard">
                  {copied
                    ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#10b981"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  }
                </button>
              </div>
            </div>

            <a
              href="https://faucet.circle.com/?_gl=1*vlhhl4*_gcl_au*MTg0NTc1MjMyLjE3NzkxMjQwODM."
              target="_blank"
              rel="noreferrer"
              style={styles.faucetLink}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              Open Circle Testnet Faucet
            </a>

            <div style={styles.divider} />

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
              Come back here once you've funded the wallet.
            </p>

            <button
              onClick={registerAgent}
              disabled={loading}
              style={{ ...styles.btnGreen, ...(loading ? styles.btnDisabled : {}) }}
            >
              {loading
                ? <><Spinner /> Registering On-Chain... (up to 30s)</>
                : '✓ I have funded the wallet — Register Agent'
              }
            </button>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 3 && (
          <div>
            <div style={styles.successIconCircle}>
              <svg width="34" height="34" fill="none" viewBox="0 0 24 24" stroke="#10b981">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem' }}>
              Agent Registered Successfully!
            </h2>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              SpreadHunter now has a permanent on-chain identity on Arc Testnet.
            </p>

            <div style={styles.successCard}>
              <div>
                <p style={styles.dataLabel}>ERC-8004 Agent ID</p>
                <p style={styles.agentIdValue}>#{agentData.agentId}</p>
              </div>
              <div style={{ height: '1px', background: 'var(--border-color)' }} />
              <div>
                <p style={styles.dataLabel}>Transaction Hash</p>
                <a
                  href={`https://testnet.arcscan.app/tx/${agentData.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.explorerLink}
                >
                  {agentData.txHash}
                </a>
                <a
                  href={`https://testnet.arcscan.app/tx/${agentData.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none' }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  View on ArcScan Explorer ↗
                </a>
              </div>
            </div>

            <button onClick={handleEnter} style={styles.btnPrimary}>
              Enter SpreadHunter →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentSetupWizard;
