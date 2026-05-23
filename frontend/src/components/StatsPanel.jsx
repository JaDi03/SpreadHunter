import React from 'react';

export default function StatsPanel({ stats }) {
  return (
    <div className="stats-grid panel">
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{stats.opportunitiesFound}</div>
        <div className="stat-label">Arb Opportunities</div>
      </div>
      <div className="stat-card">
        <div className="stat-value" style={{ color: 'var(--accent-green)' }}>${stats.totalProfitUsdc.toFixed(2)}</div>
        <div className="stat-label">Total Profit (USDC)</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.totalTxs}</div>
        <div className="stat-label">Arc Transactions</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.successRate}%</div>
        <div className="stat-label">Success Rate</div>
      </div>
    </div>
  );
}
