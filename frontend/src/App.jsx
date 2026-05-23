import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StatsPanel from './components/StatsPanel';
import Dashboard from './components/Dashboard';
import ReasoningModal from './components/ReasoningModal';
import BridgeButton from './components/BridgeButton';
import WalletOnboarding from './components/WalletOnboarding';
import AgentSetupWizard from './components/AgentSetupWizard';

function App() {
  const [opportunities, setOpportunities] = useState([]);
  const [livePrices, setLivePrices] = useState(null);
  const [stats, setStats] = useState({
    opportunitiesFound: 0,
    totalProfitUsdc: 0,
    successRate: 0,
    totalTxs: 0,
    agentId: null,
    usdcBalance: '0.00',
    eurcBalance: '0.00'
  });
  const [currentReasoning, setCurrentReasoning] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | live | disconnected
  const [userWallet, setUserWallet] = useState(() => {
    const saved = localStorage.getItem('spreadhunter_user_wallet');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAgentRegistered, setIsAgentRegistered] = useState(null);
  const [tradeAmount, setTradeAmount] = useState('1');

  useEffect(() => {
    // 0. Fetch config
    fetch('http://localhost:3001/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.settings?.defaultAmountIn) {
          setTradeAmount(data.settings.defaultAmountIn);
        }
      })
      .catch(err => console.error("Config fetch failed", err));
    // 1. Check if agent is globally registered
    fetch('http://localhost:3001/api/setup/status')
      .then(res => res.json())
      .then(data => {
        setIsAgentRegistered(data.isRegistered);
        if (data.isRegistered && data.agentId) {
          // Store agent ID in state
          setStats(prev => ({ ...prev, agentId: data.agentId }));
        }
      })
      .catch(err => console.error("Setup check failed", err));

    // 2. Fetch USDC balance if we have a wallet
    if (userWallet?.address) {
      fetch(`http://localhost:3001/api/wallet/${userWallet.address}/balance`)
        .then(res => res.json())
        .then(data => {
          if (data.balance) setStats(prev => ({ ...prev, usdcBalance: data.balance }));
          if (data.eurcBalance) setStats(prev => ({ ...prev, eurcBalance: data.eurcBalance }));
        })
        .catch(err => console.error("Balance fetch failed", err));
    }

    let ws;
    let retryTimeout;

    function connect() {
      setWsStatus('connecting');
      ws = new WebSocket('ws://localhost:3001');

      ws.onopen = () => setWsStatus('live');

      ws.onmessage = (event) => {
        const { type, data } = JSON.parse(event.data);

        if (type === 'opportunity_found') {
          setOpportunities((prev) => [data, ...prev].slice(0, 10));
          setStats((prev) => ({ ...prev, opportunitiesFound: prev.opportunitiesFound + 1 }));
          setCurrentReasoning(data.reasoning);
        }

        if (type === 'prices_updated') {
          setLivePrices(data);
        }

        if (type === 'execution_started') {
          setCurrentReasoning(prev => prev ? `${prev}\n\n⚡ Executing trade: ${data.buyDex} → ${data.sellDex}...` : `⚡ Executing trade: ${data.buyDex} → ${data.sellDex}...`);
        }

        if (type === 'execution_success') {
          const explorerBase = data.explorerBase || 'https://testnet.arcscan.app';
          setStats((prev) => ({
            ...prev,
            totalTxs: prev.totalTxs + 1,
            successRate: Math.round(((prev.totalTxs + 1) / (prev.opportunitiesFound || 1)) * 100),
          }));
          setCurrentReasoning(prev =>
            `${prev || ''}\n\n✅ EXECUTED\n` +
            `  Leg 1: ${explorerBase}/tx/${data.leg1Hash}\n` +
            `  Leg 2: ${explorerBase}/tx/${data.leg2Hash}\n` +
            `  Net Profit: ~${data.netSpreadPercent}%`
          );
        }

        if (type === 'execution_failed') {
          setCurrentReasoning(prev => `${prev || ''}\n\n❌ Execution failed: ${data.error}`);
        }
      };


      ws.onclose = () => {
        setWsStatus('disconnected');
        // Auto-reconnect after 5 s
        retryTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      ws?.close();
      clearTimeout(retryTimeout);
    };
  }, [userWallet?.address]);

  const handleExecuteSuccess = () => {
    setStats((prev) => ({
      ...prev,
      totalTxs: prev.totalTxs + 1,
      successRate: Math.round(((prev.totalTxs + 1) / (prev.opportunitiesFound || 1)) * 100),
    }));
  };

  const handleWalletCreated = (wallet) => {
    setUserWallet(wallet);
    localStorage.setItem('spreadhunter_user_wallet', JSON.stringify(wallet));
  };

  if (isAgentRegistered === null) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
        Connecting...
      </div>
    );
  }

  if (isAgentRegistered === false) {
    return <AgentSetupWizard onComplete={(wallet) => {
      setIsAgentRegistered(true);
      // The owner wallet created during setup IS the agent wallet — skip WalletOnboarding
      if (wallet) {
        setUserWallet(wallet);
        localStorage.setItem('spreadhunter_user_wallet', JSON.stringify(wallet));
      }
    }} />;
  }

  if (!userWallet) {
    return (
      <div className="app-container">
        <Header wsStatus={wsStatus} />
        <WalletOnboarding onWalletCreated={handleWalletCreated} />
      </div>
    );
  }

  const handleUpdateTradeAmount = async (newAmount) => {
    try {
      const res = await fetch('http://localhost:3001/api/config/trade-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newAmount })
      });
      const data = await res.json();
      if (data.success) {
        setTradeAmount(data.amount);
      }
    } catch (err) {
      console.error("Failed to update trade amount:", err);
    }
  };

  return (
    <div className="app-container">
      <Header wsStatus={wsStatus} />
      
      {/* Portfolio Info and Agent Registry */}
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        
        {/* Wallet & Balance */}
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', fontWeight: 'bold' }}>Agent Portfolio (Arc)</div>
          <div style={{ color: 'var(--accent-green)', fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.1rem' }}>{Number(stats.usdcBalance).toFixed(2)} USDC</div>
          <div style={{ color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{Number(stats.eurcBalance).toFixed(2)} EURC</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Available to trade</div>
        </div>

        {/* Deposit Info */}
        <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginBottom: '0.25rem', fontWeight: 'bold' }}>Deposit Funds</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Send USDC (Arc/Sepolia/Base/Arb) to this address:</div>
          <div style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>{userWallet.address}</div>
        </div>

        {/* Trade Size Setting */}
        <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 'bold' }}>Max Trade Size</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="number" 
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              onBlur={() => handleUpdateTradeAmount(tradeAmount)}
              style={{ background: 'var(--bg-dark)', border: '1px solid #333', color: 'white', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '80px', fontFamily: 'JetBrains Mono', fontSize: '1rem' }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>USDC</span>
          </div>
        </div>

        {/* ERC-8004 Identity */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', fontWeight: 'bold' }}>ERC-8004 Identity</div>
          {stats.agentId ? (
            <a 
              href={`https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/${stats.agentId}`} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}
            >
              #{stats.agentId} ↗
            </a>
          ) : (
             <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Pending Registration...</div>
          )}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>View Reputation & Tx History</div>
        </div>
      </div>

      <StatsPanel stats={stats} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        <Dashboard opportunities={opportunities} livePrices={livePrices} onExecuteSuccess={handleExecuteSuccess} userWallet={userWallet} />
        <ReasoningModal text={currentReasoning} />
      </div>
    </div>
  );
}

export default App;
