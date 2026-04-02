import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getAdminClaims, getAdminWorkers } from '../../services/adminApi';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TRIGGER_LABELS = {
  rain: '🌧 Rain', aqi: '💨 AQI', flood: '🌊 Flood',
  curfew: '🚫 Curfew', platform_outage: '📵 Outage',
  zone_freeze: '❄ Zone Freeze', heat: '🌡 Heat',
};

const STATUS_COLORS = {
  paid:          { bg: '#196c2e', color: '#39d353' },
  approved:      { bg: '#196c2e', color: '#39d353' },
  pending:       { bg: '#2e1b00', color: '#e3b341' },
  manual_review: { bg: '#1f4487', color: '#388bfd' },
  rejected:      { bg: '#490202', color: '#f85149' },
};

export default function AdminDashboard() {
  const navigate  = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [claims,  setClaims]  = useState([]);
  const [workers, setWorkers] = useState([]);
  const [tab,     setTab]     = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stress,  setStress]  = useState(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const token = localStorage.getItem('kavach_token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      getAdminStats().then(({ data }) => setStats(data)),
      getAdminClaims().then(({ data }) => setClaims(data.claims || [])),
      getAdminWorkers().then(({ data }) => setWorkers(data.workers || [])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (claimId) => {
    setActionLoading((p) => ({ ...p, [claimId]: 'approving' }));
    try {
      await axios.put(`${API}/admin/claims/${claimId}/approve`,
        { reviewNotes: 'Manually approved by admin' }, { headers });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Approve failed');
    } finally {
      setActionLoading((p) => ({ ...p, [claimId]: null }));
    }
  };

  const handleReject = async (claimId) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    setActionLoading((p) => ({ ...p, [claimId]: 'rejecting' }));
    try {
      await axios.put(`${API}/admin/claims/${claimId}/reject`, { reason }, { headers });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Reject failed');
    } finally {
      setActionLoading((p) => ({ ...p, [claimId]: null }));
    }
  };

  const handleStressTest = async () => {
    setStressLoading(true);
    try {
      const { data } = await axios.post(`${API}/admin/stress-test`,
        { days: 14, triggerType: 'rain', affectedPct: 0.7 }, { headers });
      setStress(data.scenario);
    } catch (err) {
      alert(err.response?.data?.error || 'Stress test failed');
    } finally { setStressLoading(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      Loading dashboard...
    </div>
  );

  const s = stats?.stats || {};
  const bcrColor = s.bcrPct > 85 ? '#f85149' : s.bcrPct > 70 ? '#e3b341' : '#39d353';

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117' }}>
      {/* Top bar */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#39d353', fontWeight: 700, fontSize: 18 }}>⛨ KAVACH</span>
          <span style={{ color: '#8b949e', fontSize: 12, background: '#21262d', padding: '2px 10px', borderRadius: 20, border: '1px solid #30363d' }}>Insurer Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchAll} style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d', padding: '6px 14px', borderRadius: 6, fontSize: 12 }}>↻ Refresh</button>
          <button onClick={() => navigate('/dashboard')} style={{ background: '#21262d', color: '#8b949e', border: '1px solid #30363d', padding: '6px 14px', borderRadius: 6, fontSize: 12 }}>← Worker View</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Analytics Dashboard</h1>
        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>Real-time insurer view — BCR, fraud metrics, zone risk</p>

        {/* BCR Warning Banner */}
        {s.bcrSuspend && (
          <div style={{ background: '#490202', border: '1px solid #f85149', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ color: '#f85149', fontWeight: 600 }}>BCR exceeds 85% — New enrolments suspended</div>
              <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>Burning Cost Ratio is {s.bcrPct}%. Alert reinsurer and pause new policy activations.</div>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #30363d' }}>
          {['overview', 'claims', 'workers', 'stress'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none',
              color: tab === t ? '#e6edf3' : '#8b949e',
              fontWeight: tab === t ? 600 : 400,
              padding: '8px 16px',
              borderBottom: tab === t ? '2px solid #39d353' : '2px solid transparent',
              borderRadius: 0, fontSize: 14, cursor: 'pointer',
            }}>
              {t === 'stress' ? '⚡ Stress Test' : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'claims' && s.pendingClaims > 0 && (
                <span style={{ marginLeft: 6, background: '#e3b341', color: '#000', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
                  {s.pendingClaims}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            {/* BCR + Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <div className="card" style={{ textAlign: 'center', borderColor: bcrColor }}>
                <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>BCR (Burning Cost Ratio)</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: bcrColor }}>{s.bcrPct}%</div>
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
                  {Math.round((s.bcrPct || 0) * 0.65)} paise per ₹1 → payouts
                </div>
                <div style={{ fontSize: 10, marginTop: 4, color: s.bcrSuspend ? '#f85149' : '#39d353' }}>
                  Target: 55–70% {s.bcrSuspend ? '⚠ EXCEEDED' : '✓'}
                </div>
              </div>
              {[
                { label: 'Active Policies',  value: s.activePolicies,  color: '#39d353' },
                { label: 'Total Premiums',   value: `₹${(s.totalPremiums || 0).toLocaleString('en-IN')}`, color: '#39d353' },
                { label: 'Total Payouts',    value: `₹${(s.totalPayouts || 0).toLocaleString('en-IN')}`,  color: '#f0883e' },
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
                { label: 'Total Claims',        value: s.totalClaims },
                { label: 'Pending Review',       value: s.pendingClaims,  color: '#e3b341' },
                { label: 'Fraud Rejected',       value: s.rejectedClaims, color: '#f85149' },
              ].map((m) => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: m.color || '#e6edf3' }}>{m.value ?? '—'}</div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Claims by trigger */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Claims by Trigger Type</div>
                {(stats?.claimsByType || []).length === 0
                  ? <div style={{ color: '#8b949e', fontSize: 13 }}>No claims yet</div>
                  : stats.claimsByType.map((t) => {
                    const max = stats.claimsByType[0]?.count || 1;
                    return (
                      <div key={t._id} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span>{TRIGGER_LABELS[t._id] || t._id}</span>
                          <span style={{ color: '#8b949e' }}>{t.count} · ₹{t.totalPayout?.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
                          <div style={{ height: 6, background: '#39d353', borderRadius: 3, width: `${(t.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Claims by city */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Claims by City</div>
                {(stats?.claimsByCity || []).length === 0
                  ? <div style={{ color: '#8b949e', fontSize: 13 }}>No claims yet</div>
                  : stats.claimsByCity.map((c) => {
                    const max = stats.claimsByCity[0]?.count || 1;
                    return (
                      <div key={c._id} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ textTransform: 'capitalize' }}>{c._id}</span>
                          <span style={{ color: '#8b949e' }}>{c.count} · ₹{c.totalPayout?.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
                          <div style={{ height: 6, background: '#388bfd', borderRadius: 3, width: `${(c.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Fraud distribution */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Fraud Score Distribution</div>
                {[
                  { label: 'Auto-approved (0–30)',  index: 0, color: '#39d353' },
                  { label: 'Soft flag (31–60)',      index: 1, color: '#e3b341' },
                  { label: 'Verify (61–80)',         index: 2, color: '#f0883e' },
                  { label: 'Manual review (81–100)', index: 3, color: '#f85149' },
                ].map((b) => {
                  const count = stats?.fraudDist?.[b.index]?.count || 0;
                  const total = s.totalClaims || 1;
                  return (
                    <div key={b.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>{b.label}</span>
                        <span style={{ color: '#8b949e' }}>{count}</span>
                      </div>
                      <div style={{ height: 6, background: '#21262d', borderRadius: 3 }}>
                        <div style={{ height: 6, background: b.color, borderRadius: 3, width: `${(count / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daily volume */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Claims Volume — Last 7 Days</div>
                {!stats?.dailyClaims?.length
                  ? <div style={{ color: '#8b949e', fontSize: 13 }}>No claims in last 7 days</div>
                  : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                      {stats.dailyClaims.map((d) => {
                        const max = Math.max(...stats.dailyClaims.map((x) => x.count), 1);
                        return (
                          <div key={d._id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ fontSize: 10, color: '#8b949e' }}>{d.count}</div>
                            <div style={{ width: '100%', background: '#39d353', borderRadius: '3px 3px 0 0', height: `${(d.count / max) * 60}px`, minHeight: 4 }} />
                            <div style={{ fontSize: 9, color: '#8b949e' }}>{d._id?.slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>
          </>
        )}

        {/* ── CLAIMS ── */}
        {tab === 'claims' && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              All Claims
              {s.pendingClaims > 0 && (
                <span style={{ marginLeft: 10, background: '#2e1b00', color: '#e3b341', borderRadius: 10, fontSize: 11, padding: '2px 10px' }}>
                  {s.pendingClaims} need review
                </span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#8b949e', textAlign: 'left' }}>
                    {['Worker', 'City', 'Trigger', 'Predicted', 'Payout', 'Fraud', 'PPCS', 'Status', 'Date', 'Action'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #30363d', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => {
                    const sc  = STATUS_COLORS[c.payoutStatus] || STATUS_COLORS.pending;
                    const act = actionLoading[c._id];
                    const needsAction = ['pending', 'manual_review'].includes(c.payoutStatus);
                    return (
                      <tr key={c._id} style={{ borderBottom: '1px solid #21262d', background: needsAction ? 'rgba(227,179,65,0.04)' : 'transparent' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600 }}>{c.worker?.name || '—'}</td>
                        <td style={{ padding: '10px 10px', textTransform: 'capitalize', color: '#8b949e' }}>{c.worker?.city || '—'}</td>
                        <td style={{ padding: '10px 10px' }}>{TRIGGER_LABELS[c.triggerType] || c.triggerType}</td>
                        <td style={{ padding: '10px 10px' }}>₹{c.predictedLoss}</td>
                        <td style={{ padding: '10px 10px', fontWeight: 700, color: '#39d353' }}>₹{c.payoutAmount}</td>
                        <td style={{ padding: '10px 10px', color: c.fraudScore > 60 ? '#f85149' : c.fraudScore > 30 ? '#e3b341' : '#39d353' }}>{c.fraudScore}</td>
                        <td style={{ padding: '10px 10px', color: '#8b949e' }}>{c.ppcsScore}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.color }}>
                            {c.payoutStatus.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '10px 10px', color: '#8b949e' }}>
                          {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          {needsAction ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleApprove(c._id)} disabled={!!act}
                                style={{ background: '#196c2e', color: '#39d353', border: '1px solid #39d353', padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                                {act === 'approving' ? '...' : '✓ Pay'}
                              </button>
                              <button onClick={() => handleReject(c._id)} disabled={!!act}
                                style={{ background: '#490202', color: '#f85149', border: '1px solid #f85149', padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                                {act === 'rejecting' ? '...' : '✕ Reject'}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#8b949e', fontSize: 11 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WORKERS ── */}
        {tab === 'workers' && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Registered Workers</div>
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
          </div>
        )}

        {/* ── STRESS TEST ── */}
        {tab === 'stress' && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⚡ 14-Day Monsoon Stress Scenario</div>
              <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
                Simulates a 14-day continuous monsoon event affecting 70% of active workers.
                Projects the BCR impact and tells you whether the platform remains solvent.
                This is the actuarial stress test required by DEVTrails guidelines.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Duration',         value: '14 days' },
                  { label: 'Trigger type',      value: '🌧 Heavy Rain' },
                  { label: 'Workers affected',  value: '70%' },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#21262d', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ color: '#8b949e', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <button onClick={handleStressTest} disabled={stressLoading}
                style={{ background: '#388bfd', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                {stressLoading ? 'Running simulation...' : '▶ Run Stress Test'}
              </button>
            </div>

            {stress && (
              <div className="card" style={{ borderColor: stress.willTriggerSuspension ? '#f85149' : '#39d353' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: stress.willTriggerSuspension ? '#f85149' : '#39d353' }}>
                  {stress.willTriggerSuspension ? '⚠️ Stress Test Result — SUSPENSION TRIGGERED' : '✅ Stress Test Result — Platform Solvent'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Active policies',            value: stress.totalActivePolicies },
                    { label: 'Projected affected workers', value: stress.projectedAffectedWorkers },
                    { label: 'Avg daily income/worker',    value: `₹${stress.avgDailyIncomePerWorker}` },
                    { label: 'Payout/worker/day',          value: `₹${stress.payoutPerWorkerPerDay}` },
                    { label: 'Total projected payout',     value: `₹${stress.totalProjectedPayout?.toLocaleString('en-IN')}` },
                    { label: 'Current premiums',           value: `₹${stress.currentPremiums?.toLocaleString('en-IN')}` },
                  ].map((item) => (
                    <div key={item.label} style={{ background: '#21262d', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ color: '#8b949e', fontSize: 11, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: stress.willTriggerSuspension ? '#490202' : '#0d2818', border: `1px solid ${stress.willTriggerSuspension ? '#f85149' : '#39d353'}`, borderRadius: 8, padding: '16px 20px' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: stress.willTriggerSuspension ? '#f85149' : '#39d353', marginBottom: 4 }}>
                    Projected BCR: {stress.projectedBCR}
                  </div>
                  <div style={{ fontSize: 13, color: '#8b949e' }}>
                    {stress.recommendation}
                  </div>
                  {stress.willTriggerSuspension && (
                    <div style={{ marginTop: 12, fontSize: 12, color: '#f0883e' }}>
                      Action required: Alert reinsurer · Pause new enrolments · Increase surge loading for next premium cycle
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
