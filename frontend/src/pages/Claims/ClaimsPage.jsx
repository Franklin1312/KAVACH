import React, { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import { getAllClaims, simulateTrigger, autoProcessClaim, getActivePolicty } from '../../services/api';

const TRIGGER_TYPES = [
  { key: 'rain',            label: '🌧 Heavy Rain',       level: 3 },
  { key: 'aqi',             label: '💨 Severe AQI',       level: 4 },
  { key: 'flood',           label: '🌊 Flash Flood',      level: 3 },
  { key: 'curfew',          label: '🚫 Curfew',           level: 4 },
  { key: 'platform_outage', label: '📵 Platform Outage',  level: 3 },
];

const STATUS_COLORS = {
  paid:          { bg: '#196c2e', color: '#39d353' },
  approved:      { bg: '#196c2e', color: '#39d353' },
  pending:       { bg: '#2e1b00', color: '#e3b341' },
  manual_review: { bg: '#1f4487', color: '#388bfd' },
  rejected:      { bg: '#490202', color: '#f85149' },
};

export default function ClaimsPage() {
  const [claims,    setClaims]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selected,  setSelected]  = useState('rain');
  const [hasPolicy, setHasPolicy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    Promise.all([
      getAllClaims().then(({ data }) => setClaims(data.claims || [])),
      getActivePolicty().then(({ data }) => setHasPolicy(!!data.policy)),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSimulate = async () => {
    if (!hasPolicy) return alert('Activate a policy first from the Policy page');
    const trigger = TRIGGER_TYPES.find((t) => t.key === selected);
    setSimulating(true);
    setLastResult(null);
    try {
      const { data: simData } = await simulateTrigger(trigger.key, trigger.level);
      const { data } = await autoProcessClaim(simData.triggerData);
      setLastResult(data);
      setClaims((prev) => [data.claim, ...prev]);
    } catch (err) {
      alert(err.response?.data?.error || 'Simulation failed');
    } finally { setSimulating(false); }
  };

  if (loading) return <><Navbar /><div style={{ padding: 40, color: '#8b949e' }}>Loading...</div></>;

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Claims</h1>
        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>Automated income protection payouts</p>

        {/* Simulator */}
        <div className="card" style={{ marginBottom: 20, borderColor: '#1f4487' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>🔬 Disruption Simulator</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {TRIGGER_TYPES.map((t) => (
              <div key={t.key} onClick={() => setSelected(t.key)} style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${selected === t.key ? '#388bfd' : '#30363d'}`,
                background: selected === t.key ? '#1f4487' : '#21262d',
                color: selected === t.key ? '#93c5fd' : '#8b949e',
              }}>
                {t.label}
              </div>
            ))}
          </div>
          <button onClick={handleSimulate} disabled={simulating}
            style={{ background: '#1f4487', color: '#93c5fd', border: '1px solid #388bfd', padding: '8px 20px', borderRadius: 6, fontSize: 13 }}>
            {simulating ? 'Processing pipeline...' : 'Fire Trigger →'}
          </button>
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="card" style={{ marginBottom: 20, borderColor: '#196c2e' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#39d353' }}>✅ Claim Processed</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              {[
                ['Predicted loss',   `₹${lastResult.breakdown?.predictedLoss}`],
                ['Actual earned',    `₹${lastResult.breakdown?.actualEarned}`],
                ['Net loss',         `₹${lastResult.breakdown?.netLoss}`],
                ['Coverage',         `${(lastResult.breakdown?.coveragePct * 100)}%`],
                ['Payout',           `₹${lastResult.breakdown?.payoutAmount}`],
                ['Fraud score',      `${lastResult.breakdown?.fraudScore}/100`],
                ['PPCS',             `${lastResult.breakdown?.ppcs}/100`],
                ['Decision',         lastResult.decision?.action?.replace('_', ' ').toUpperCase()],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ color: '#8b949e', fontSize: 11 }}>{label}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#21262d', borderRadius: 6, fontSize: 12, color: '#8b949e' }}>
              💬 {lastResult.decision?.message}
            </div>
          </div>
        )}

        {/* Claims history */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Claims History</div>

          {claims.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '24px 0', fontSize: 13 }}>
              No claims yet. Simulate a disruption above to see the pipeline in action.
            </div>
          ) : (
            claims.map((c) => {
              const sc = STATUS_COLORS[c.payoutStatus] || STATUS_COLORS.pending;
              return (
                <div key={c._id} style={{ padding: '14px 0', borderBottom: '1px solid #21262d' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {c.triggerType.replace('_', ' ').toUpperCase()} — Level {c.triggerLevel}
                      </div>
                      <div style={{ fontSize: 12, color: '#8b949e', marginTop: 3 }}>
                        {new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>
                        Predicted ₹{c.predictedLoss} · Earned ₹{c.actualEarned} · Net loss ₹{c.netLoss}
                      </div>
                      {c.fraudFlags?.length > 0 && (
                        <div style={{ fontSize: 11, color: '#f0883e', marginTop: 4 }}>
                          ⚠ Flags: {c.fraudFlags.join(', ')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#39d353' }}>₹{c.payoutAmount}</div>
                      <div style={{ marginTop: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {c.payoutStatus.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
