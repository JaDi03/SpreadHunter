import { useState } from 'react';

// Circle CCTP Bridge Button
// Uses the Circle Cross-Chain Transfer Protocol to bridge USDC from another chain
// into the Arc Testnet so the agent has funds to execute arbitrage.
// The Circle W3S SDK handles the embedded wallet signing flow.
export default function BridgeButton({ onBridgeComplete }) {
  const [status, setStatus] = useState('idle'); // idle | pending | success | error
  const [txHash, setTxHash] = useState(null);

  const handleBridge = async () => {
    setStatus('pending');
    try {
      // Circle CCTP flow:
      // 1. User approves USDC spend on source chain via embedded wallet
      // 2. Call CCTP TokenMessenger.depositForBurn on source chain
      // 3. Circle attestation service generates a signed message
      // 4. Call MessageTransmitter.receiveMessage on Arc Testnet to finalize
      //
      // For the MVP demo we call a helper endpoint on our backend that
      // initiates the Circle CCTP transfer and returns the burn tx hash.
      // The backend uses the Circle W3S SDK (server-side) to submit the tx.
      const response = await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Amount in USDC micro-units (6 decimals): 10 USDC = 10_000_000
          amount: '10000000',
          // Destination is Arc Testnet — domain registered with Circle
          destinationDomain: 5,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Bridge request failed');
      }

      const { burnTxHash } = await response.json();
      setTxHash(burnTxHash);
      setStatus('success');
      if (onBridgeComplete) onBridgeComplete(burnTxHash);

      setTimeout(() => setStatus('idle'), 5000);
    } catch (err) {
      console.error('Bridge error:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const label = {
    idle: 'Bridge USDC via Circle CCTP',
    pending: 'Bridging…',
    success: txHash
      ? `Bridged! Burn Tx: ${txHash.slice(0, 10)}…`
      : 'Bridge Complete ✓',
    error: 'Bridge Failed — Retry',
  }[status];

  const colorMap = {
    idle: 'var(--accent-blue)',
    pending: 'var(--accent-blue)',
    success: 'var(--accent-green)',
    error: 'var(--accent-red)',
  };

  return (
    <button
      id="bridge-btn"
      className="btn"
      onClick={handleBridge}
      disabled={status === 'pending'}
      style={{
        backgroundColor: colorMap[status],
        transition: 'background-color 0.3s',
        fontSize: '0.85rem',
      }}
    >
      {status === 'pending' && (
        <span style={{ marginRight: '0.4rem', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
      )}
      {label}
    </button>
  );
}
