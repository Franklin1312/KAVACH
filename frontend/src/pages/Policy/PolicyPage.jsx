import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import { getPremiumQuote, getActivePolicty, createPolicy, cancelPolicy, getAllPolicies } from '../../services/api';

const TIERS = [
  { key: 'basic',    label: 'Basic',    pct: '50%', mult: '0.7×', desc: 'Occasional workers' },
  { key: 'standard', label: 'Standard', pct: '70%', mult: '1.0×', desc: 'Recommended ★',     },
  { key: 'premium',  label: 'Premium',  pct: '85%', mult: '1.35×',desc: 'Top earners'         },
];

export default function PolicyPage() {
  const navigate            = useNavigate();
  const [selectedTier, setSelectedTier] = useState('standard');
  const [quote,   setQuote]   = useState(null);
  const [policy,  setPolicy]  = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getActivePolicty().then(({ data }) => setPolicy(data.policy));
    getAllPolicies().then(({ data }) => setHistory(data.policies || []));
    fetchQuote('standard');
  }, []);

  const fetchQuote = async (tier) => {
    try {
      const { data } = await getPremiumQuote(tier);
      setQuote(data.quote);
    } catch {}
  };

  const handleTierChange = (tier) => {
    setSelectedTier(tier);
    fetchQuote(tier);
  };

  const handleActivate = async () => {
    setError(''); setLoading(true);
    try {
      const { data } = await createPolicy(selectedTier);
      setPolicy(data.policy);
      getAllPolicies().then(({ d }) => setHistory(d?.policies || []));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to activate policy');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your active policy?')) return;
    try {
      await cancelPolicy(policy._id);
      setPolicy(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Insurance Policy</h1>
        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>Weekly income protection — renews every Monday</p>

        {/* Active policy banner */}
        {policy && (
          <div className="card" style={{ marginBottom: 20, borderColor: '#196c2e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-green" style={{ marginBottom: 6 }}>ACTIVE</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#39d353', marginTop: 4 }}>
                  ₹{policy.maxPayout?.toLocaleString('en-IN')} protected
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                  {policy.tier?.toUpperCase()} · ₹{policy.premium?.finalAmount}/week ·
                  Expires {new Date(policy.weekEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button onClick={handleCancel}
                style={{ background: '#490202', color: '#f85149', border: '1px solid #f85149', padding: '6px 14px', fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tier selector */}
        {!policy && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Choose Coverage Tier</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {TIERS.map((t) => (
                <div key={t.key} onClick={() => handleTierChange(t.key)} style={{
                  padding: 16, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${selectedTier === t.key ? '#39d353' : '#30363d'}`,
                  background: selectedTier === t.key ? '#196c2e' : '#21262d',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: selectedTier === t.key ? '#39d353' : '#e6edf3' }}>{t.pct}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: selectedTier === t.key ? '#39d353' : '#e6edf3' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Premium breakdown */}
        {quote && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Premium Breakdown</div>

            <div style={{ textAlign: 'center', marginBottom: 16, padding: '16px 0', borderBottom: '1px solid #21262d' }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: '#39d353' }}>₹{quote.finalAmount}</div>
              <div style={{ fontSize: 13, color: '#8b949e' }}>per week · UPI AutoPay every Monday</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>
                Max payout: <strong style={{ color: '#39d353' }}>₹{quote.maxPayout?.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {[
              ['Base rate',            quote.breakdown?.baseRate],
              ['Zone risk factor',     `${quote.breakdown?.zoneRiskFactor}×`],
              ['Season multiplier',    `${quote.breakdown?.seasonMultiplier}×`],
              ['Claims-free discount', `-${quote.breakdown?.claimsFreeDiscount}`],
              ['Surge loading',        `+₹${quote.breakdown?.surgeLoading}`],
              ['Tier multiplier',      `${quote.breakdown?.tierMultiplier}×`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #21262d' }}>
                <span style={{ color: '#8b949e' }}>{label}</span>
                <span>{val}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 700, fontSize: 15 }}>
              <span>Weekly Premium</span>
              <span style={{ color: '#39d353' }}>₹{quote.finalAmount}</span>
            </div>
          </div>
        )}

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

        {!policy && (
          <button className="btn-primary" onClick={handleActivate} disabled={loading}>
            {loading ? 'Activating...' : `Activate ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Policy →`}
          </button>
        )}

        {/* Policy history */}
        {history.length > 0 && (
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Policy History</div>
            {history.map((p) => (
              <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #21262d', fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{p.tier?.toUpperCase()}</span>
                  <span style={{ color: '#8b949e', marginLeft: 8 }}>
                    {new Date(p.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –
                    {new Date(p.weekEnd).toLocaleDateString('en-IN',   { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>₹{p.premium?.finalAmount}</span>
                  <span className={`badge ${p.status === 'active' ? 'badge-green' : p.status === 'cancelled' ? 'badge-red' : 'badge-amber'}`}>
                    {p.status.toUpperCase()}
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
