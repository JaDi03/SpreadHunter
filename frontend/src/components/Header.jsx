import React from 'react';

// Status dot colors
const STATUS_COLOR = {
  live: 'var(--accent-green)',
  connecting: '#f59e0b',
  disconnected: 'var(--accent-red)',
};

const STATUS_LABEL = {
  live: 'Live',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
};

export default function Header({ wsStatus = 'connecting' }) {
  return (
    <header className="header panel" style={{ padding: '1rem 1.5rem', marginBottom: '0' }}>
      <div className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img src="/logo.PNG" alt="SpreadHunter Logo" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
        {/* Animated pulse dot */}
        <span style={{ position: 'relative', display: 'inline-flex', width: '12px', height: '12px' }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: STATUS_COLOR[wsStatus] || 'var(--text-muted)',
              opacity: wsStatus === 'live' ? 0.4 : 0,
              animation: wsStatus === 'live' ? 'ping 1.5s ease-in-out infinite' : 'none',
            }}
          />
          <span
            style={{
              position: 'relative',
              display: 'inline-flex',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: STATUS_COLOR[wsStatus] || 'var(--text-muted)',
            }}
          />
        </span>
      </div>

      {/* Network + status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'JetBrains Mono, monospace',
            background: 'var(--bg-elevated)',
            padding: '0.25rem 0.6rem',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
          }}
        >
          Arc Testnet · EURC/USDC
        </span>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: STATUS_COLOR[wsStatus],
          }}
        >
          ● {STATUS_LABEL[wsStatus]}
        </span>
      </div>
    </header>
  );
}
