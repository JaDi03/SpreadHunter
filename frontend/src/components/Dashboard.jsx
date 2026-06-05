import ExecuteButton from './ExecuteButton';
import PriceChart from './PriceChart';

// Flatten prices object into a list of { pair, dex, feeTier, price }
function flattenPrices(livePrices) {
  if (!livePrices) return [];
  const rows = [];
  const seen = new Set(); // deduplicate by pair+dex (same price for all fee tiers in V2)
  for (const [pair, feeTiers] of Object.entries(livePrices)) {
    for (const [feeTier, dexPrices] of Object.entries(feeTiers)) {
      for (const [dex, data] of Object.entries(dexPrices)) {
        const key = `${pair}-${dex}`;
        if (!seen.has(key)) {
          rows.push({ pair, dex, feeTier: Number(feeTier), price: data.price });
          seen.add(key);
        }
      }
    }
  }
  return rows;
}

export default function Dashboard({ opportunities, livePrices, onExecuteSuccess, userWallet }) {
  const priceRows = flattenPrices(livePrices);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Live Price Monitor */}
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: priceRows.length > 0 ? 'var(--accent-green)' : 'var(--text-muted)',
            boxShadow: priceRows.length > 0 ? '0 0 6px var(--accent-green)' : 'none',
            animation: priceRows.length > 0 ? 'pulse 2s infinite' : 'none'
          }} />
          <h2 style={{ color: 'var(--text-muted)', fontSize: '1.0rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Live Price Feed
          </h2>
        </div>

        {priceRows.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem 0' }}>
            ⟳ Waiting for first scan cycle…
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {priceRows.map((row, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                minWidth: '160px',
                flex: '1'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {row.pair} · {row.dex}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {Number(row.price).toFixed(6)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  EURC per USDC
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Price History Chart */}
      <PriceChart />

      {/* Arbitrage Opportunities Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '1.0rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Arb Opportunities
        </h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Pair</th>
                <th>Buy On</th>
                <th>Sell On</th>
                <th>Spread</th>
                <th>Net (after fees)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}>📡 Monitoring UnitFlow · XyloNet · EURC/USDC</div>
                    <div style={{ fontSize: '0.8rem' }}>No cross-DEX spread detected yet. Watching every {'>'}30s…</div>
                  </td>
                </tr>
              ) : (
                opportunities.map((opp, i) => (
                  <tr key={i} style={{ background: opp.isProfitable ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                    <td style={{ fontWeight: 600 }}>
                      {opp.pair}{' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {opp.feeTier / 10000}%
                      </span>
                    </td>
                    <td>
                      {opp.buyDex}
                      <br />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {Number(opp.buyPrice).toFixed(6)}
                      </span>
                    </td>
                    <td>
                      {opp.sellDex}
                      <br />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {Number(opp.sellPrice).toFixed(6)}
                      </span>
                    </td>
                    <td style={{ color: opp.isProfitable ? 'var(--accent-green)' : 'inherit', fontFamily: 'JetBrains Mono, monospace' }}>
                      {opp.rawSpreadPercent}%
                    </td>
                    <td style={{ color: opp.isProfitable ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {opp.netSpreadPercent}%
                    </td>
                    <td>
                      <ExecuteButton opportunity={opp} onSuccess={onExecuteSuccess} userWallet={userWallet} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
