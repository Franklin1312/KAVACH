import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAdminStats, getAdminClaims, getAdminWorkers, getAdminSustainability } from '../../services/adminApi';
import axios from 'axios';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Cell, ComposedChart, Legend } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const RUPEE = '\u20B9';

const TRIGGER_LABELS = {
  rain: 'Rain',
  aqi: 'AQI',
  flood: 'Flood',
  curfew: 'Curfew',
  platform_outage: 'Outage',
  zone_freeze: 'Zone Freeze',
  heat: 'Heat',
};

const STATUS_COLORS = {
  paid: { bg: '#E5F7EF', color: '#007A4D' },
  approved: { bg: '#E5F7EF', color: '#007A4D' },
  pending: { bg: '#FFF8EB', color: '#B7791F' },
  manual_review: { bg: '#E3F2FD', color: '#0B3D91' },
  rejected: { bg: '#FDEAEA', color: '#E53935' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { adminLogout, admin } = useAuth();
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stress, setStress] = useState(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [sustainability, setSustainability] = useState(null);
  const [sustainLoading, setSustainLoading] = useState(false);
  const [expandedCities, setExpandedCities] = useState({});

  const token = localStorage.getItem('kavach_admin_token');
  const headers = { Authorization: `Bearer ${token}` };

  const handleAdminError = (err, fallbackMessage) => {
    if ([401, 403].includes(err?.response?.status)) {
      adminLogout();
      navigate('/', { replace: true });
      return;
    }
    alert(err.response?.data?.error || fallbackMessage);
  };

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      getAdminStats().then(({ data }) => setStats(data)),
      getAdminClaims().then(({ data }) => setClaims(data.claims || [])),
      getAdminWorkers().then(({ data }) => setWorkers(data.workers || [])),
      getAdminSustainability().then(({ data }) => setSustainability(data)).catch(() => { }),
    ])
      .catch((err) => handleAdminError(err, 'Could not load admin dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (claimId) => {
    setActionLoading((current) => ({ ...current, [claimId]: 'approving' }));
    try {
      await axios.put(`${API}/admin/claims/${claimId}/approve`, { reviewNotes: 'Manually approved by admin' }, { headers });
      fetchAll();
    } catch (err) {
      handleAdminError(err, 'Approve failed');
    } finally {
      setActionLoading((current) => ({ ...current, [claimId]: null }));
    }
  };

  const handleReject = async (claimId) => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    setActionLoading((current) => ({ ...current, [claimId]: 'rejecting' }));
    try {
      await axios.put(`${API}/admin/claims/${claimId}/reject`, { reason }, { headers });
      fetchAll();
    } catch (err) {
      handleAdminError(err, 'Reject failed');
    } finally {
      setActionLoading((current) => ({ ...current, [claimId]: null }));
    }
  };

  const handleStressTest = async () => {
    setStressLoading(true);
    try {
      const { data } = await axios.post(`${API}/admin/stress-test`, { days: 14, triggerType: 'rain', affectedPct: 0.7 }, { headers });
      setStress(data.scenario);
    } catch (err) {
      handleAdminError(err, 'Stress test failed');
    } finally {
      setStressLoading(false);
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA', color: '#5A6478' }}>Loading dashboard...</div>;
  }

  const summary = stats?.stats || {};
  const bcrColor = summary.bcrPct > 85 ? '#E53935' : summary.bcrPct > 70 ? '#F5A623' : '#00A86B';
  const projectionConfig = [
    { key: 'current', label: (entry) => `Current (${entry?.portfolioSize || 0})` },
    { key: 'at100000', label: '100,000 Workers' },
    { key: 'at250000', label: '250,000 Workers' },
    { key: 'at1000000', label: '1,000,000 Workers' },
  ];
  const projectionRows = projectionConfig
    .map(({ key, label }) => {
      const entry = sustainability?.breakEvenProjections?.[key];
      if (!entry) return null;
      return {
        name: typeof label === 'function' ? label(entry) : label,
        ...entry,
      };
    })
    .filter(Boolean);
  const adminProfile = {
    username: admin?.username || 'admin',
    phone: admin?.phone || 'Not available',
    role: admin?.role || 'admin',
    accessLevel: 'Full platform administration',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #0B3D91, #1A5BC4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>K</div>
          <span style={{ fontFamily: 'Outfit, sans-serif', color: '#0B3D91', fontWeight: 800, fontSize: 18 }}>KAVACH</span>
          <span style={{ color: '#5A6478', fontSize: 11, background: '#EBF0FA', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>Admin Panel</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={fetchAll} style={{ padding: '8px 16px' }}>Refresh</button>
          <button
            id="admin-logout-btn"
            onClick={() => { adminLogout(); navigate('/', { replace: true }); }}
            style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #E53935, #C62828)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="page-container">
        <h1 className="page-title">Analytics Dashboard</h1>
        <p className="page-subtitle">Real-time insurer view of BCR, fraud metrics, trigger mix, and zone risk</p>

        {summary.bcrSuspend && (
          <div style={{ background: '#FDEAEA', border: '1px solid #E53935', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 24 }}>!</span>
            <div>
              <div style={{ color: '#E53935', fontWeight: 700 }}>BCR exceeds 85% - New enrolments suspended</div>
              <div style={{ color: '#5A6478', fontSize: 13, marginTop: 2 }}>Burning Cost Ratio is {summary.bcrPct}%. Alert the reinsurer and pause new policy activations.</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid #E5E7EB', flexWrap: 'wrap' }}>
          {['overview', 'claims', 'workers', 'sustainability', 'stress', 'profile'].map((name) => (
            <button key={name} onClick={() => setTab(name)} style={{ background: 'none', border: 'none', color: tab === name ? '#0B3D91' : '#9CA3AF', fontWeight: tab === name ? 700 : 500, padding: '10px 20px', borderBottom: tab === name ? '3px solid #0B3D91' : '3px solid transparent', borderRadius: 0, fontSize: 14, fontFamily: tab === name ? 'Outfit, sans-serif' : 'inherit' }}>
              {name === 'stress' ? 'Stress Test' : name === 'sustainability' ? 'Sustainability' : name.charAt(0).toUpperCase() + name.slice(1)}
              {name === 'claims' && summary.pendingClaims > 0 && <span style={{ marginLeft: 6, background: '#FF6B35', color: '#fff', borderRadius: 10, fontSize: 10, padding: '2px 7px', fontWeight: 700 }}>{summary.pendingClaims}</span>}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 20, textAlign: 'center', border: `2px solid ${bcrColor}`, boxShadow: `0 4px 16px ${bcrColor}15` }}>
                <div style={{ fontSize: 12, color: '#5A6478', marginBottom: 4 }}>BCR (Burning Cost Ratio)</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: bcrColor, fontFamily: 'Outfit, sans-serif' }}>{summary.bcrPct}%</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Target: 55-70% {summary.bcrSuspend ? 'EXCEEDED' : 'ON TRACK'}</div>
              </div>
              {[
                { label: 'Active Policies', value: summary.activePolicies, color: '#0B3D91' },
                { label: 'Total Premiums', value: `${RUPEE}${(summary.totalPremiums || 0).toLocaleString('en-IN')}`, color: '#00A86B' },
                { label: 'Total Payouts', value: `${RUPEE}${(summary.totalPayouts || 0).toLocaleString('en-IN')}`, color: '#FF6B35' },
              ].map((item) => <div key={item.label} className="stat-card"><div className="stat-value" style={{ color: item.color }}>{item.value}</div><div className="stat-label">{item.label}</div></div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Registered Workers', value: summary.totalWorkers },
                { label: 'Total Claims', value: summary.totalClaims },
                { label: 'Pending Review', value: summary.pendingClaims, color: '#F5A623' },
                { label: 'Fraud Rejected', value: summary.rejectedClaims, color: '#E53935' },
              ].map((item) => <div key={item.label} className="stat-card"><div className="stat-value" style={{ color: item.color || '#1A1A2E' }}>{item.value ?? '-'}</div><div className="stat-label">{item.label}</div></div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Claims by Trigger</div>
                {(stats?.claimsByType || []).length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>No claims yet</div> : stats.claimsByType.map((item) => {
                  const max = stats.claimsByType[0]?.count || 1;
                  return <div key={item._id} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{TRIGGER_LABELS[item._id] || item._id}</span><span style={{ color: '#9CA3AF' }}>{item.count} · {RUPEE}{item.totalPayout?.toLocaleString('en-IN')}</span></div><div style={{ height: 8, background: '#F0F0F0', borderRadius: 4 }}><div style={{ height: 8, background: 'linear-gradient(90deg, #0B3D91, #2E7DD6)', borderRadius: 4, width: `${(item.count / max) * 100}%` }} /></div></div>;
                })}
              </div>

              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Claims by City</div>
                {(stats?.claimsByCity || []).length === 0 ? <div style={{ color: '#9CA3AF', fontSize: 13 }}>No claims yet</div> : stats.claimsByCity.map((item) => {
                  const max = stats.claimsByCity[0]?.count || 1;
                  return <div key={item._id} style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span style={{ textTransform: 'capitalize' }}>{item._id}</span><span style={{ color: '#9CA3AF' }}>{item.count} · {RUPEE}{item.totalPayout?.toLocaleString('en-IN')}</span></div><div style={{ height: 8, background: '#F0F0F0', borderRadius: 4 }}><div style={{ height: 8, background: 'linear-gradient(90deg, #FF6B35, #FFB347)', borderRadius: 4, width: `${(item.count / max) * 100}%` }} /></div></div>;
                })}
              </div>
            </div>
          </>
        )}

        {tab === 'claims' && (
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>All Claims</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ color: '#9CA3AF', textAlign: 'left' }}>{['Worker', 'City', 'Trigger', 'Predicted', 'Payout', 'Fraud', 'PPCS', 'Status', 'Payout ID', 'Date', 'Action'].map((heading) => <th key={heading} style={{ padding: '10px 12px', borderBottom: '2px solid #E5E7EB', fontWeight: 600, fontSize: 12 }}>{heading}</th>)}</tr></thead>
                <tbody>
                  {claims.map((claim) => {
                    const statusColor = STATUS_COLORS[claim.payoutStatus] || STATUS_COLORS.pending;
                    const actionState = actionLoading[claim._id];
                    const needsAction = ['pending', 'manual_review', 'approved'].includes(claim.payoutStatus);
                    return (
                      <tr key={claim._id} style={{ borderBottom: '1px solid #F0F0F0', background: needsAction ? '#FFFBF0' : 'transparent' }}>
                        <td style={{ padding: '12px 12px', fontWeight: 600 }}>{claim.worker?.name || '-'}</td>
                        <td style={{ padding: '12px 12px', color: '#5A6478', textTransform: 'capitalize' }}>{claim.worker?.city || '-'}</td>
                        <td style={{ padding: '12px 12px' }}>{TRIGGER_LABELS[claim.triggerType] || claim.triggerType}</td>
                        <td style={{ padding: '12px 12px' }}>{RUPEE}{claim.predictedLoss}</td>
                        <td style={{ padding: '12px 12px', fontWeight: 700, color: '#00A86B' }}>{RUPEE}{claim.payoutAmount}</td>
                        <td style={{ padding: '12px 12px', color: claim.fraudScore > 60 ? '#E53935' : claim.fraudScore > 30 ? '#F5A623' : '#00A86B', fontWeight: 600 }}>{claim.fraudScore}</td>
                        <td style={{ padding: '12px 12px' }}>{claim.ppcsScore}</td>
                        <td style={{ padding: '12px 12px' }}><span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: statusColor.bg, color: statusColor.color }}>{claim.payoutStatus.replace('_', ' ').toUpperCase()}</span></td>
                        <td style={{ padding: '12px 12px' }}>{claim.blockchainTxId ? <a href={`https://sepolia.etherscan.io/tx/${claim.blockchainTxId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0B3D91', fontFamily: 'monospace', fontSize: 11, textDecoration: 'none', background: '#EBF0FA', padding: '3px 8px', borderRadius: 6 }} title={claim.blockchainTxId}>{claim.blockchainTxId.slice(0, 6)}...{claim.blockchainTxId.slice(-4)}</a> : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>}</td>
                        <td style={{ padding: '12px 12px', color: '#9CA3AF' }}>{new Date(claim.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td style={{ padding: '12px 12px' }}>{needsAction ? <div style={{ display: 'flex', gap: 6 }}><button onClick={() => handleApprove(claim._id)} disabled={!!actionState} style={{ background: '#E5F7EF', color: '#007A4D', border: '1px solid #00A86B', padding: '4px 12px', borderRadius: 6, fontSize: 12 }}>{actionState === 'approving' ? '...' : 'Pay'}</button><button onClick={() => handleReject(claim._id)} disabled={!!actionState} style={{ background: '#FDEAEA', color: '#E53935', border: '1px solid #E53935', padding: '4px 12px', borderRadius: 6, fontSize: 12 }}>{actionState === 'rejecting' ? '...' : 'Reject'}</button></div> : <span style={{ color: '#9CA3AF', fontSize: 12 }}>-</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'workers' && (() => {
          // Group workers by city
          const grouped = workers.reduce((acc, w) => {
            const city = (w.city || 'Unknown').toLowerCase();
            if (!acc[city]) acc[city] = [];
            acc[city].push(w);
            return acc;
          }, {});
          const cities = Object.keys(grouped).sort();

          const toggleCity = (city) => {
            setExpandedCities((prev) => ({ ...prev, [city]: !prev[city] }));
          };

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>Registered Workers</div>
                  <div style={{ color: '#9CA3AF', fontSize: 13, marginTop: 2 }}>{workers.length} workers across {cities.length} cities</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { const all = {}; cities.forEach((c) => all[c] = true); setExpandedCities(all); }} style={{ background: '#EBF0FA', color: '#0B3D91', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Expand All</button>
                  <button onClick={() => setExpandedCities({})} style={{ background: '#F5F7FA', color: '#5A6478', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Collapse All</button>
                </div>
              </div>

              {cities.map((city) => {
                const isExpanded = expandedCities[city];
                return (
                <div key={city} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                  {/* City Header — clickable to toggle */}
                  <div
                    onClick={() => toggleCity(city)}
                    style={{ background: 'linear-gradient(135deg, #0B3D91 0%, #1A5BC4 100%)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', textTransform: 'capitalize', fontFamily: 'Outfit, sans-serif' }}>{city}</div>
                      <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 10px' }}>
                        {grouped[city].length} worker{grouped[city].length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ color: '#fff', fontSize: 18, fontWeight: 300, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>

                  {/* Workers Table — collapsible */}
                  {isExpanded && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: '#9CA3AF', textAlign: 'left', background: '#F9FAFB' }}>
                          {['Name', 'Phone', 'Zone', 'Platform', 'Weekly Income', 'Zone Risk', 'Engagement', 'DPDP', 'Joined'].map((h) => (
                            <th key={h} style={{ padding: '8px 16px', borderBottom: '1px solid #E5E7EB', fontWeight: 600, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[city].map((worker) => {
                          const days = worker.platformActiveDays || 0;
                          const threshold = (worker.platforms?.length || 1) > 1 ? 120 : 90;
                          const qualified = worker.engagementQualified || days >= threshold;
                          const hasConsent = worker.dpdpConsent?.gps && worker.dpdpConsent?.bank && worker.dpdpConsent?.platform;
                          return (
                          <tr key={worker._id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                            <td style={{ padding: '11px 16px', fontWeight: 600 }}>{worker.name}</td>
                            <td style={{ padding: '11px 16px', color: '#5A6478' }}>{worker.phone}</td>
                            <td style={{ padding: '11px 16px', color: '#5A6478' }}>{worker.zone}</td>
                            <td style={{ padding: '11px 16px' }}>{worker.platforms?.map((p) => p.name).join(', ') || '—'}</td>
                            <td style={{ padding: '11px 16px', fontWeight: 600 }}>{RUPEE}{worker.declaredWeeklyIncome?.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '11px 16px', fontWeight: 700, color: worker.zoneRiskFactor >= 1.3 ? '#E53935' : worker.zoneRiskFactor <= 0.85 ? '#00A86B' : '#F5A623' }}>
                              {worker.zoneRiskFactor}x
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: qualified ? '#E5F7EF' : '#FFF3E0', color: qualified ? '#007A4D' : '#E65100' }}>
                                {qualified ? '✓' : '⚠'} {days}d/{threshold}d
                              </span>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: hasConsent ? '#E5F7EF' : '#FDEAEA', color: hasConsent ? '#007A4D' : '#E53935', textAlign: 'center', lineHeight: '20px', fontSize: 12, fontWeight: 700 }}>
                                {hasConsent ? '✓' : '✗'}
                              </span>
                            </td>
                            <td style={{ padding: '11px 16px', color: '#9CA3AF' }}>{new Date(worker.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
                );
              })}
            </div>
          );
        })()}


        {tab === 'stress' && (
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #FF6B35, #FFB347)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>!</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>14-Day Monsoon Stress Scenario</div>
              </div>
              <p style={{ color: '#5A6478', fontSize: 14, marginBottom: 20 }}>Simulates a 14-day continuous monsoon event affecting 70% of active workers and projects the BCR impact.</p>
              <button className="btn-blue" onClick={handleStressTest} disabled={stressLoading} style={{ width: 'auto' }}>{stressLoading ? 'Running simulation...' : 'Run Stress Test'}</button>
            </div>

            {stress && (
              <div className="card" style={{ border: `2px solid ${stress.willTriggerSuspension ? '#E53935' : '#00A86B'}` }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: stress.willTriggerSuspension ? '#E53935' : '#00A86B' }}>{stress.willTriggerSuspension ? 'Suspension Triggered' : 'Platform Solvent'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                  {[
                    { label: 'Avg daily income/worker', value: `${RUPEE}${stress.avgDailyIncomePerWorker}` },
                    { label: 'Total premium pool', value: `${RUPEE}${stress.currentPremiums?.toLocaleString('en-IN')}` },
                    { label: 'Gross payout projected', value: `${RUPEE}${stress.totalProjectedPayout?.toLocaleString('en-IN')}` },
                    { label: 'Reinsurer absorbs (60% excess)', value: `${RUPEE}${stress.reinsurerAbsorbs?.toLocaleString('en-IN')}`, highlight: true },
                    { label: 'Net payout to platform', value: `${RUPEE}${stress.netProjectedPayout?.toLocaleString('en-IN')}` },
                    { label: 'Net BCR', value: stress.projectedBCR },
                  ].map((item) => (
                    <div key={item.label} style={{ background: item.highlight ? '#E8F5E9' : '#F5F7FA', borderRadius: 12, padding: '14px 18px', border: item.highlight ? '1px solid #4CAF50' : 'none' }}>
                      <div style={{ color: item.highlight ? '#2E7D32' : '#9CA3AF', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontWeight: 800, fontSize: 20, color: item.highlight ? '#1B5E20' : '#111827', fontFamily: 'Outfit, sans-serif' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: stress.willTriggerSuspension ? '#FDEAEA' : '#E5F7EF', border: `1px solid ${stress.willTriggerSuspension ? '#E53935' : '#00A86B'}`, borderRadius: 12, padding: '18px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: stress.willTriggerSuspension ? '#E53935' : '#00A86B', fontFamily: 'Outfit, sans-serif' }}>
                      Final Scenario BCR: {stress.projectedBCR}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#F44336' }}>
                      <del>Gross BCR: {stress.grossBCR}</del>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: '#5A6478' }}>{stress.recommendation}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'sustainability' && (
          <div>
            {/* P2P Ratio Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {(() => {
                const p2p = sustainability?.payoutToPremiumRatio4w || 0;
                const p2pPct = (p2p * 100).toFixed(1);
                const p2pColor = p2p > 0.85 ? '#E53935' : p2p > 0.70 ? '#F5A623' : '#00A86B';
                const bep = sustainability?.breakEvenProjections?.current || {};
                return [
                  { label: '4-Week P2P Ratio', value: `${p2pPct}%`, color: p2pColor, sub: p2p > 0.85 ? 'CRITICAL' : p2p > 0.70 ? 'ELEVATED' : 'HEALTHY' },
                  { label: 'Net Margin (Current)', value: `${RUPEE}${(bep.net || 0).toLocaleString('en-IN')}`, color: (bep.net || 0) >= 0 ? '#00A86B' : '#E53935', sub: `${bep.portfolioSize || 0} workers` },
                  { label: 'Projected at 100K Workers', value: `${RUPEE}${(sustainability?.breakEvenProjections?.at100000?.net || 0).toLocaleString('en-IN')}`, color: (sustainability?.breakEvenProjections?.at100000?.net || 0) >= 0 ? '#00A86B' : '#E53935', sub: 'Net margin' },
                  { label: 'Projected at 250K Workers', value: `${RUPEE}${(sustainability?.breakEvenProjections?.at250000?.net || 0).toLocaleString('en-IN')}`, color: (sustainability?.breakEvenProjections?.at250000?.net || 0) >= 0 ? '#00A86B' : '#E53935', sub: 'Net margin' },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#fff', borderRadius: 16, padding: 20, textAlign: 'center', border: `2px solid ${item.color}15`, boxShadow: `0 4px 16px ${item.color}10` }}>
                    <div style={{ fontSize: 12, color: '#5A6478', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: item.color, fontFamily: 'Outfit, sans-serif' }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{item.sub}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Premium vs Payout Weekly Trend */}
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, fontFamily: 'Outfit, sans-serif' }}>Weekly Premium vs Payout Trend</div>
                {sustainability?.weeklyTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={sustainability.weeklyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                      <Tooltip
                        contentStyle={{ background: '#1A1A2E', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12 }}
                        formatter={(value, name) => [`${RUPEE}${value.toLocaleString('en-IN')}`, name === 'premiums' ? 'Premiums' : 'Payouts']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="premiums" fill="#0B3D91" radius={[4, 4, 0, 0]} name="Premiums" />
                      <Bar dataKey="payouts" fill="#FF6B35" radius={[4, 4, 0, 0]} name="Payouts" />
                      <Line type="monotone" dataKey="ratio" stroke="#E53935" strokeWidth={2} dot={{ r: 3 }} name="P2P Ratio" yAxisId={0} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 40 }}>No weekly data yet</div>}
              </div>

              {/* Premium Per Worker Trend */}
              <div className="card">
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, fontFamily: 'Outfit, sans-serif' }}>Premium Per Worker Per Week</div>
                {sustainability?.premiumPerWorkerPerWeek?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={sustainability.premiumPerWorkerPerWeek} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="premGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0B3D91" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0B3D91" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                      <Tooltip
                        contentStyle={{ background: '#1A1A2E', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12 }}
                        formatter={(value) => [`${RUPEE}${value}`, 'Per Worker']}
                      />
                      <Area type="monotone" dataKey="premiumPerWorker" stroke="#0B3D91" fill="url(#premGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 40 }}>No data yet</div>}
              </div>
            </div>

            {/* Break-Even Projections */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, fontFamily: 'Outfit, sans-serif' }}>Break-Even Projections at Various Portfolio Sizes</div>
              {projectionRows.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={projectionRows}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5A6478' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                    <Tooltip
                      contentStyle={{ background: '#1A1A2E', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12 }}
                      formatter={(value, name) => [`${RUPEE}${value.toLocaleString('en-IN')}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="premiums" fill="#0B3D91" radius={[4, 4, 0, 0]} name="Premiums" />
                    <Bar dataKey="payouts" fill="#FF6B35" radius={[4, 4, 0, 0]} name="Payouts" />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net Margin">
                      {projectionRows.map((entry, idx) => (
                        <Cell key={idx} fill={(entry?.net || 0) >= 0 ? '#00A86B' : '#E53935'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading projections...</div>}
            </div>

            {/* Reinsurer Triggers */}
            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, fontFamily: 'Outfit, sans-serif' }}>Reinsurer Trigger Indicators</div>
              {sustainability?.reinsurerTriggers ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {/* BCR Threshold */}
                  <div style={{ background: sustainability.reinsurerTriggers.bcrThreshold85 ? '#FDEAEA' : '#E5F7EF', borderRadius: 12, padding: '18px 22px', border: `1px solid ${sustainability.reinsurerTriggers.bcrThreshold85 ? '#E53935' : '#00A86B'}` }}>
                    <div style={{ fontSize: 12, color: '#5A6478', marginBottom: 6 }}>BCR Threshold (85%)</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: sustainability.reinsurerTriggers.bcrThreshold85 ? '#E53935' : '#00A86B' }}>
                      {sustainability.reinsurerTriggers.bcrCurrent}%
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: sustainability.reinsurerTriggers.bcrThreshold85 ? '#E53935' : '#00A86B' }}>
                      {sustainability.reinsurerTriggers.bcrThreshold85 ? 'BREACHED' : 'WITHIN LIMIT'}
                    </div>
                  </div>

                  {/* Single Event Cap */}
                  <div style={{ background: '#F5F7FA', borderRadius: 12, padding: '18px 22px', border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, color: '#5A6478', marginBottom: 6 }}>Single Event Cap (40%)</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: sustainability.reinsurerTriggers.singleEventCap.percentage > 90 ? '#E53935' : '#0B3D91' }}>
                      {sustainability.reinsurerTriggers.singleEventCap.percentage}%
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                      {RUPEE}{sustainability.reinsurerTriggers.singleEventCap.current.toLocaleString('en-IN')} / {RUPEE}{sustainability.reinsurerTriggers.singleEventCap.limit.toLocaleString('en-IN')}
                    </div>
                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, marginTop: 8 }}>
                      <div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, sustainability.reinsurerTriggers.singleEventCap.percentage)}%`, background: sustainability.reinsurerTriggers.singleEventCap.percentage > 90 ? '#E53935' : sustainability.reinsurerTriggers.singleEventCap.percentage > 70 ? '#F5A623' : '#00A86B', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>

                  {/* Top Trigger Type */}
                  <div style={{ background: '#F5F7FA', borderRadius: 12, padding: '18px 22px', border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, color: '#5A6478', marginBottom: 6 }}>Highest Payout Trigger</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#0B3D91', textTransform: 'capitalize' }}>
                      {TRIGGER_LABELS[sustainability.reinsurerTriggers.singleEventCap.triggerType] || sustainability.reinsurerTriggers.singleEventCap.triggerType || 'None'}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                      {RUPEE}{sustainability.reinsurerTriggers.singleEventCap.current.toLocaleString('en-IN')} total payouts
                    </div>
                  </div>
                </div>
              ) : <div style={{ color: '#9CA3AF', fontSize: 13 }}>No reinsurer data available</div>}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16, alignItems: 'start' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg, #0B3D91, #1A5BC4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', boxShadow: '0 10px 24px rgba(11,61,145,0.22)' }}>
                  {adminProfile.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', fontFamily: 'Outfit, sans-serif' }}>{adminProfile.username}</div>
                  <div style={{ fontSize: 13, color: '#5A6478' }}>KAVACH platform administrator</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {[
                  { label: 'Role', value: adminProfile.role.toUpperCase() },
                  { label: 'Admin Phone', value: adminProfile.phone },
                  { label: 'Access Level', value: adminProfile.accessLevel },
                  { label: 'Session Mode', value: 'Authenticated admin session' },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#F8FAFD', border: '1px solid #E7EDF5', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>{item.label}</div>
                    <div style={{ fontSize: 15, color: '#1A1A2E', fontWeight: 700, lineHeight: 1.4 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card">
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Admin Permissions</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {[
                    'View platform metrics, claims, worker portfolio, and sustainability dashboards',
                    'Approve or reject claims under manual review',
                    'Run catastrophe stress testing scenarios',
                    'Monitor payout-to-premium health and reinsurer trigger thresholds',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#334155', fontSize: 14, lineHeight: 1.5 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#E5F7EF', color: '#007A4D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Platform Snapshot</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Active Policies', value: summary.activePolicies ?? '-' },
                    { label: 'Pending Claims', value: summary.pendingClaims ?? '-' },
                    { label: 'Burning Cost Ratio', value: `${summary.bcrPct ?? 0}%` },
                    { label: 'Fraud Rejections', value: summary.rejectedClaims ?? '-' },
                  ].map((item) => (
                    <div key={item.label} style={{ borderRadius: 12, background: '#F5F7FA', padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#0B3D91', fontFamily: 'Outfit, sans-serif' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
