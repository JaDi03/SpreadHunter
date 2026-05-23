import React, { useState } from 'react';
import axios from 'axios';

export default function ExecuteButton({ opportunity, onSuccess, userWallet }) {
  const [status, setStatus] = useState('idle'); // idle, executing, success, error

  const handleExecute = async () => {
    setStatus('executing');
    try {
      // 1. Ask backend for calldata
      const response = await fetch('/api/build-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          opportunity, 
          amountIn: '1000',
          recipientAddress: userWallet?.address
        }),
      });
      
      // 2. Sign and send with embedded wallet (App Kit)
      // await wallet.sendTransaction(calldata);
      
      // Simulating execution delay for MVP Demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Inform backend of success to trigger ERC-8004 Reputation logging
      await axios.post('/api/record-success', { reasoningText: opportunity.reasoning });
      
      setStatus('success');
      if (onSuccess) onSuccess();
      
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  if (!opportunity || !opportunity.isProfitable) {
    return <button className="btn" disabled>Waiting for spread...</button>;
  }

  if (status === 'executing') {
    return <button className="btn" disabled>Executing Swaps & Recording Reputation...</button>;
  }

  if (status === 'success') {
    return <button className="btn" style={{ backgroundColor: 'var(--accent-green)' }} disabled>Success! Reputation Logged</button>;
  }

  return (
    <button className="btn btn-execute" onClick={handleExecute}>
      Execute Arbitrage
    </button>
  );
}
