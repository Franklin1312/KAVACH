import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getAdminClaims, getAdminWorkers } from '../../services/adminApi';

const TRIGGER_LABELS = {
  rain:            '🌧 Rain',
  aqi:             '💨 AQI',
  flood:           '🌊 Flood',
  curfew:          '🚫 Curfew',
  platform_outage: '📵 Outage',
  zone_freeze:     '❄ Zone Freeze',
  heat:            '🌡 Heat',
};

const STATUS_COLORS = {
  paid:          { bg: '#196c2e', color: '#39d353' },
  approved:      { bg: '#196c2e', color: '#39d353' },
  pending:       { bg: '#2e1b00', color: '#e3b341' },
  manual_review: { bg: '#1f4487', color: '#388bfd' },
  rejected:      { bg: '#490202', color: '#f85149' },
};

export default function AdminDashboard() {
  const navigate   = useNavigate();
  const [stats,    setStats]   = useState(null);
  const [claims,   setClaims]  = useState([]);
  const [workers,  setWorkers] = useState([]);
  const [tab,      setTab]     = useState('overview');
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAdminStats().then(({ data }) => setStats(data)),
      getAdminClaims().then(({ data }) => setClaims(data.claims || [])),
      getAdminWorkers().then(({ data }) => setWorkers(data.workers || [])),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
        Loading dashboard...
      </div>
    );
  }

  const s = stats?.stats || {};

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117' }}>
      {/* Top bar */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#39d353', fontWeight: 700, fontSize: 18 }}>⛨ KAVACH</span>
          <span style={{ color: '#8b949e', fontSize: 12, background: '#21262d', padding: '2px 10px', borderRadius: 20, border: '1px solid #30363d' }}>
            Insurer Admin
          </span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d', padding: '6px 14px', borderRadius: 6, fontSize: 12 }}>
          ← Worker View
        </button>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Analytics Dashboard</h1>
        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>Real-time insurer view — loss ratios, fraud metrics, zone risk</p>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #30363d', paddingBottom: 0 }}>
          {['overview', 'claims', 'workers'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none',
              color:       tab === t ? '#e6edf3' : '#8b949e',
              fontWeight:  tab === t ? 600 : 400,
              padding:     '8px 16px',
              borderBottom: tab === t ? '2px solid #39d353' : '2px solid transparent',
              borderRadius: 0, fontSize: 14,
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            {/* Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Active Policies',   value: s.activePolicies,  color: '#39d353' },
                { label: 'Total Premiums',    value: `₹${(s.totalPremiums || 0).toLocaleString('en-IN')}`, color: '#39d353' },
                { label: 'Total Payouts',     value: `₹${(s.totalPayouts || 0).toLocaleString('en-IN')}`,  color: '#f0883e' },
                { label: 'Loss Ratio',        value: `${s.lossRatio}%`, color: s.lossRatio > 90 ? '#f85149' : s.lossRatio > 70 ? '#e3b341' : '#39d353' },
              ].map((m) => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Registered Workers', value: s.totalWorkers },
                { label: 'Total Claims',        value: s.totalClaims  },
                { label: 'Pending Review',      value: s.pendingClaims, color: '#e3b341' },
                { label: 'Fraud Rejected',      value: s.rejectedClaims, color: '#f85149' },
              ].map((m) => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: m.color || '#e6edf3' }}>{m.value ?? '—'}</div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Claims by trigger type */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Claims by Trigger Type</div>
                {stats?.claimsByType?.length === 0 && (
                  <div style={{ color: '#8b949e', fontSize: 13 }}>No claims yet</div>
                )}
                {stats?.claimsByType?.map((t) => {
                  const max = stats.claimsByType[0]?.count || 1;
                  return (
                    <div key={t._id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>{TRIGGER_LABELS[t._id] || t._id}</span>
                        <span style={{ color: '#8b949e' }}>{t.count} · ₹{t.totalPayout?.toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
                        <div style={{ height: 6, background: '#39d353', borderRadius: 3, width: `${(t.count / max) * 100}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Claims by city */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Claims by City</div>
                {stats?.claimsByCity?.length === 0 && (
                  <div style={{ color: '#8b949e', fontSize: 13 }}>No claims yet</div>
                )}
                {stats?.claimsByCity?.map((c) => {
                  const max = stats.claimsByCity[0]?.count || 1;
                  return (
                    <div key={c._id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ textTransform: 'capitalize' }}>{c._id}</span>
                        <span style={{ color: '#8b949e' }}>{c.count} · ₹{c.totalPayout?.toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
                        <div style={{ height: 6, background: '#388bfd', borderRadius: 3, width: `${(c.count / max) * 100}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fraud score distribution */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Fraud Score Distribution</div>
                {[
                  { label: 'Auto-approved (0–30)',  index: 0, color: '#39d353' },
                  { label: 'Soft flag (31–60)',      index: 1, color: '#e3b341' },
                  { label: 'Verify (61–80)',         index: 2, color: '#f0883e' },
                  { label: 'Manual review (81–100)', index: 3, color: '#f85149' },
                ].map((b) => {
                  const count = stats?.fraudDist?.[b.index]?.count || 0;
                  const total = stats?.stats?.totalClaims || 1;
                  return (
                    <div key={b.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>{b.label}</span>
                        <span style={{ color: '#8b949e' }}>{count}</span>
                      </div>
                      <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
                        <div style={{ height: 6, background: b.color, borderRadius: 3, width: `${(count / total) * 100}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daily claims volume (last 7 days) */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Claims Volume — Last 7 Days</div>
                {stats?.dailyClaims?.length === 0 ? (
                  <div style={{ color: '#8b949e', fontSize: 13 }}>No claims in the last 7 days</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                    {(stats?.dailyClaims || []).map((d) => {
                      const max = Math.max(...(stats?.dailyClaims || []).map((x) => x.count), 1);
                      return (
                        <div key={d._id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontSize: 10, color: '#8b949e' }}>{d.count}</div>
                          <div style={{ width: '100%', background: '#39d353', borderRadius: '3px 3px 0 0', height: `${(d.count / max) * 60}px`, minHeight: 4 }} />
                          <div style={{ fontSize: 9, color: '#8b949e' }}>{d._id.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── CLAIMS TAB ───────────────────────────────────────────── */}
        {tab === 'claims' && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>All Claims (latest 50)</div>
            {claims.length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: 13 }}>No claims yet</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#8b949e', textAlign: 'left' }}>
                      {['Worker', 'City', 'Trigger', 'Predicted', 'Payout', 'Fraud', 'PPCS', 'Status', 'Date'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #30363d', fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((c) => {
                      const sc = STATUS_COLORS[c.payoutStatus] || STATUS_COLORS.pending;
                      return (
                        <tr key={c._id} style={{ borderBottom: '1px solid #21262d' }}>
                          <td style={{ padding: '10px 10px' }}>{c.worker?.name || '—'}</td>
                          <td style={{ padding: '10px 10px', textTransform: 'capitalize', color: '#8b949e' }}>{c.worker?.city || '—'}</td>
                          <td style={{ padding: '10px 10px' }}>{TRIGGER_LABELS[c.triggerType] || c.triggerType}</td>
                          <td style={{ padding: '10px 10px' }}>₹{c.predictedLoss}</td>
                          <td style={{ padding: '10px 10px', fontWeight: 700, color: '#39d353' }}>₹{c.payoutAmount}</td>
                          <td style={{ padding: '10px 10px', color: c.fraudScore > 60 ? '#f85149' : c.fraudScore > 30 ? '#e3b341' : '#39d353' }}>
                            {c.fraudScore}
                          </td>
                          <td style={{ padding: '10px 10px', color: '#8b949e' }}>{c.ppcsScore}</td>
                          <td style={{ padding: '10px 10px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.color }}>
                              {c.payoutStatus.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', color: '#8b949e' }}>
                            {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── WORKERS TAB ──────────────────────────────────────────── */}
        {tab === 'workers' && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Registered Workers (latest 50)</div>
            {workers.length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: 13 }}>No workers registered yet</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#8b949e', textAlign: 'left' }}>
                      {['Name', 'Phone', 'City', 'Zone', 'Platform', 'Weekly Income', 'Zone Risk', 'Claims-Free', 'Joined'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #30363d', fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w) => (
                      <tr key={w._id} style={{ borderBottom: '1px solid #21262d' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600 }}>{w.name}</td>
                        <td style={{ padding: '10px 10px', color: '#8b949e' }}>{w.phone}</td>
                        <td style={{ padding: '10px 10px', textTransform: 'capitalize' }}>{w.city}</td>
                        <td style={{ padding: '10px 10px', color: '#8b949e' }}>{w.zone}</td>
                        <td style={{ padding: '10px 10px' }}>{w.platforms?.map((p) => p.name).join(', ')}</td>
                        <td style={{ padding: '10px 10px' }}>₹{w.declaredWeeklyIncome?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 10px', color: w.zoneRiskFactor >= 1.3 ? '#f85149' : w.zoneRiskFactor <= 0.85 ? '#39d353' : '#e3b341' }}>
                          {w.zoneRiskFactor}×
                        </td>
                        <td style={{ padding: '10px 10px', color: '#8b949e' }}>{w.claimsFreeWeeks}w</td>
                        <td style={{ padding: '10px 10px', color: '#8b949e' }}>
                          {new Date(w.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
