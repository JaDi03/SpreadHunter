import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://spreadhunter.onrender.com';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(10,14,26,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.8rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: '0.2rem' }}>
            {p.name}: <strong>{Number(p.value).toFixed(6)}</strong>
          </div>
        ))}
        {payload.length === 2 && (
          <div style={{
            marginTop: '0.4rem',
            paddingTop: '0.4rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: payload[1].value > payload[0].value ? '#10b981' : '#f87171',
          }}>
            Spread: {Math.abs(((payload[1].value - payload[0].value) / payload[0].value) * 100).toFixed(4)}%
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function PriceChart() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/prices/history?pair=EURC/USDC`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped = data.map(d => ({
        time: formatTime(d.timestamp),
        ts: d.timestamp,
        buyPrice: Number(d.buyPrice),
        sellPrice: Number(d.sellPrice),
      }));
      setHistory(mapped);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    // Refresh every 30s
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const minPrice = history.length > 0 ? Math.min(...history.map(d => Math.min(d.buyPrice, d.sellPrice))) * 0.9998 : 0.99;
  const maxPrice = history.length > 0 ? Math.max(...history.map(d => Math.max(d.buyPrice, d.sellPrice))) * 1.0002 : 1.01;

  return (
    <div className="panel">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: error ? 'var(--accent-red)' : 'var(--accent-green)',
            boxShadow: error ? 'none' : '0 0 6px var(--accent-green)',
            animation: error ? 'none' : 'pulse 2s infinite'
          }} />
          <h2 style={{ color: 'var(--text-muted)', fontSize: '1.0rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            EURC/USDC Price History
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastUpdate && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchHistory}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '0.3rem 0.7rem',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          ⟳ Loading price history…
        </div>
      ) : error ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-red)', fontSize: '0.85rem' }}>
          ⚠ {error} — Make sure the backend is running.
        </div>
      ) : history.length === 0 ? (
        <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.5rem' }}>
          <div style={{ fontSize: '2rem' }}>📊</div>
          <div style={{ fontSize: '0.9rem' }}>No price history yet.</div>
          <div style={{ fontSize: '0.78rem', opacity: 0.6 }}>Prices are recorded each scan cycle. Come back in a moment.</div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="buyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minPrice, maxPrice]}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => v.toFixed(5)}
                width={72}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.5rem', color: 'rgba(255,255,255,0.5)' }}
              />
              <Area
                type="monotone"
                dataKey="buyPrice"
                name="Buy Price"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#buyGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
              <Area
                type="monotone"
                dataKey="sellPrice"
                name="Sell Price"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#sellGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#10b981' }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Stats bar */}
          <div style={{
            display: 'flex', gap: '1.5rem', marginTop: '1rem',
            paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap'
          }}>
            {[
              {
                label: 'Latest Buy', 
                value: history.at(-1)?.buyPrice?.toFixed(6) ?? '—',
                color: '#3b82f6'
              },
              {
                label: 'Latest Sell', 
                value: history.at(-1)?.sellPrice?.toFixed(6) ?? '—',
                color: '#10b981'
              },
              {
                label: 'Period High', 
                value: Math.max(...history.map(d => Math.max(d.buyPrice, d.sellPrice))).toFixed(6),
                color: '#f59e0b'
              },
              {
                label: 'Period Low', 
                value: Math.min(...history.map(d => Math.min(d.buyPrice, d.sellPrice))).toFixed(6),
                color: '#f87171'
              },
              {
                label: 'Data Points', 
                value: history.length,
                color: 'rgba(255,255,255,0.4)'
              },
            ].map((stat, i) => (
              <div key={i}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                  {stat.label}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.95rem', fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
