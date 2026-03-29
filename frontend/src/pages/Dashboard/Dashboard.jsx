import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/common/Navbar';
import { getActivePolicty, getAllClaims, getTriggerStatus, autoProcessClaim } from '../../services/api';

export default function Dashboard() {
  const { worker }    = useAuth();
  const navigate      = useNavigate();
  const [policy,   setPolicy]   = useState(null);
  const [claims,   setClaims]   = useState([]);
  const [triggers, setTriggers] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    Promise.all([
      getActivePolicty().then(({ data }) => setPolicy(data.policy)),
      getAllClaims().then(({ data }) => setClaims(data.claims?.slice(0, 3) || [])),
      getTriggerStatus().then(({ data }) => setTriggers(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSimulate = async () => {
    if (!policy) return alert('Activate a policy first');
    setSimulating(true);
    try {
      const { data } = await autoProcessClaim({
        triggerType: 'rain', triggerLevel: 3,
        triggerSources: [{ source: 'IMD (demo)', value: '45mm/hr', confirmedAt: new Date() }],
        actualEarned: 0,
      });
      alert(`✅ Claim processed! Payout: ₹${data.breakdown.payoutAmount}\nDecision: ${data.decision.message}`);
      getAllClaims().then(({ data }) => setClaims(data.claims?.slice(0, 3) || []));
    } catch (err) {
      alert(err.response?.data?.error || 'Simulation failed');
    } finally { setSimulating(false); }
  };

  if (loading) return <><Navbar /><div style={{ padding: 40, color: '#8b949e' }}>Loading...</div></>;

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Good {getTimeGreeting()}, {worker?.name?.split(' ')[0]} 👋</h1>
          <p style={{ color: '#8b949e', fontSize: 13, marginTop: 4 }}>{worker?.city} · {worker?.zone}</p>
        </div>

        {/* Policy status card */}
        <div className="card" style={{ marginBottom: 16, borderColor: policy ? '#196c2e' : '#30363d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 4 }}>Weekly Coverage</div>
              {policy ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#39d353' }}>
                    ₹{policy.maxPayout?.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                    {policy.tier?.toUpperCase()} · {(policy.coveragePct * 100)}% coverage ·
                    Expires {new Date(policy.weekEnd).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 16, color: '#8b949e', marginTop: 4 }}>No active policy</div>
              )}
            </div>
            <span className={`badge ${policy ? 'badge-green' : 'badge-amber'}`}>
              {policy ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          {!policy && (
            <button className="btn-primary" onClick={() => navigate('/policy')} style={{ marginTop: 16 }}>
              Activate Weekly Policy →
            </button>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>₹{policy?.premium?.finalAmount || '—'}</div>
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>Weekly Premium</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{claims.length}</div>
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>Total Claims</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{worker?.claimsFreeWeeks || 0}w</div>
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>Claims-Free</div>
          </div>
        </div>

        {/* Live trigger status */}
        {triggers && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Live Disruption Monitor</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(triggers.allResults || {}).map(([key, val]) => (
                <div key={key} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12,
                  background: val.triggered ? '#490202' : '#0d2818',
                  color:      val.triggered ? '#f85149'  : '#39d353',
                  border: `1px solid ${val.triggered ? '#f85149' : '#39d353'}`,
                }}>
                  {key.replace('_', ' ')} {val.triggered ? `⚠ L${val.level}` : '✓'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demo trigger button */}
        <div className="card" style={{ marginBottom: 16, borderColor: '#1f4487' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Demo — Simulate Disruption</div>
          <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
            Simulate a heavy rain event and watch the full automated claim pipeline run in real time.
          </p>
          <button onClick={handleSimulate} disabled={simulating || !policy}
            style={{ background: '#1f4487', color: '#93c5fd', border: '1px solid #388bfd', padding: '8px 16px', borderRadius: 6, fontSize: 13 }}>
            {simulating ? 'Processing...' : '🌧 Simulate Rain Claim'}
          </button>
        </div>

        {/* Recent claims */}
        {claims.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Recent Claims</div>
              <button onClick={() => navigate('/claims')}
                style={{ background: 'none', color: '#388bfd', border: 'none', fontSize: 12, padding: 0 }}>
                View all →
              </button>
            </div>
            {claims.map((c) => (
              <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #21262d' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.triggerType.replace('_', ' ').toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: '#8b949e' }}>{new Date(c.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#39d353' }}>₹{c.payoutAmount}</div>
                  <span className={`badge ${c.payoutStatus === 'paid' ? 'badge-green' : c.payoutStatus === 'rejected' ? 'badge-red' : 'badge-amber'}`}>
                    {c.payoutStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
