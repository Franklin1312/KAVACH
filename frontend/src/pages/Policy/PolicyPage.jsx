import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import { getPremiumQuote, getActivePolicty, createPolicy, cancelPolicy, getAllPolicies } from '../../services/api';

const RUPEE = '\u20B9';
const TIERS = [
  { key: 'basic', label: 'Basic', pct: '50%', desc: 'Occasional workers' },
  { key: 'standard', label: 'Standard', pct: '70%', desc: 'Recommended' },
  { key: 'premium', label: 'Premium', pct: '85%', desc: 'Top earners' },
];

export default function PolicyPage() {
  const [selectedTier, setSelectedTier] = useState('standard');
  const [quote, setQuote] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getActivePolicty().then(({ data }) => setPolicy(data.policy));
    getAllPolicies().then(({ data }) => setHistory(data.policies || []));
    fetchQuote('standard');
  }, []);

  const fetchQuote = async (tier) => {
    try {
      const { data } = await getPremiumQuote(tier);
      setQuote(data.quote);
    } catch {
      setQuote(null);
    }
  };

  const handleTierChange = (tier) => {
    setSelectedTier(tier);
    fetchQuote(tier);
  };

  const handleActivate = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await createPolicy(selectedTier);
      setPolicy(data.policy);
      const historyResponse = await getAllPolicies();
      setHistory(historyResponse.data.policies || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to activate policy');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your active policy?')) return;
    try {
      await cancelPolicy(policy._id);
      setPolicy(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel policy');
    }
  };

  return (
    <>
      <Navbar />
      <div style={{ background: '#F5F7FA', minHeight: 'calc(100vh - 64px)' }}>
        <div className="page-container">
          <h1 className="page-title">Insurance Policy</h1>
          <p className="page-subtitle">Weekly income protection that renews every Monday</p>

          {policy && (
            <div style={{ background: 'linear-gradient(135deg, #E5F7EF 0%, #F4FFFA 100%)', border: '1px solid #BCEAD5', borderRadius: 16, padding: 24, marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
              <div>
                <span className="badge badge-green" style={{ marginBottom: 10 }}>ACTIVE</span>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#007A4D', fontFamily: 'Outfit, sans-serif' }}>{RUPEE}{policy.maxPayout?.toLocaleString('en-IN')} protected</div>
                <div style={{ fontSize: 13, color: '#5A6478', marginTop: 6 }}>{policy.tier?.toUpperCase()} · {RUPEE}{policy.premium?.finalAmount}/week</div>
                <div style={{ fontSize: 12, color: '#7B8794', marginTop: 4 }}>Expires {new Date(policy.weekEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
              </div>
              <button className="btn-danger" onClick={handleCancel}>Cancel Policy</button>
            </div>
          )}

          {!policy && (
            <>
              <div className="card" style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Choose Coverage Tier</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {TIERS.map((tier) => {
                    const selected = selectedTier === tier.key;
                    return (
                      <div key={tier.key} onClick={() => handleTierChange(tier.key)} style={{ padding: 18, borderRadius: 16, cursor: 'pointer', textAlign: 'center', border: `2px solid ${selected ? '#0B3D91' : '#E5E7EB'}`, background: selected ? '#EBF0FA' : '#fff' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: selected ? '#0B3D91' : '#1A1A2E', fontFamily: 'Outfit, sans-serif' }}>{tier.pct}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{tier.label}</div>
                        <div style={{ fontSize: 12, color: '#7B8794', marginTop: 6 }}>{tier.desc}</div>
                        {tier.key === 'standard' && <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: '#FF6B35' }}>POPULAR</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {quote && (
                <div className="card" style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Premium Breakdown</div>
                  <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #F0F0F0' }}>
                    <div style={{ fontSize: 42, fontWeight: 800, color: '#00A86B', fontFamily: 'Outfit, sans-serif' }}>{RUPEE}{quote.finalAmount}</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>per week · UPI AutoPay every Monday</div>
                    <div style={{ fontSize: 14, marginTop: 10 }}>Max payout: <strong style={{ color: '#0B3D91' }}>{RUPEE}{quote.maxPayout?.toLocaleString('en-IN')}</strong></div>
                  </div>

                  {[
                    ['Base rate', quote.breakdown?.baseRate],
                    ['Zone risk factor', `${quote.breakdown?.zoneRiskFactor}x`],
                    ['Season multiplier', `${quote.breakdown?.seasonMultiplier}x`],
                    ['Claims-free discount', `-${quote.breakdown?.claimsFreeDiscount}`],
                    ['Surge loading', `+${RUPEE}${quote.breakdown?.surgeLoading}`],
                    ['Tier multiplier', `${quote.breakdown?.tierMultiplier}x`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5', fontSize: 14 }}>
                      <span style={{ color: '#6B7280' }}>{label}</span>
                      <span style={{ fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, fontSize: 16, fontWeight: 800 }}>
                    <span>Weekly Premium</span>
                    <span style={{ color: '#00A86B' }}>{RUPEE}{quote.finalAmount}</span>
                  </div>
                </div>
              )}

              {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
              <button className="btn-primary" onClick={handleActivate} disabled={loading}>{loading ? 'Activating...' : `Activate ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Policy -&gt;`}</button>
            </>
          )}

          {history.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Policy History</div>
              {history.map((item) => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F0F0F0' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.tier?.toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: '#7B8794' }}>{new Date(item.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(item.weekEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 700 }}>{RUPEE}{item.premium?.finalAmount}</div>
                    <span className={`badge ${item.status === 'active' ? 'badge-green' : item.status === 'cancelled' ? 'badge-red' : 'badge-amber'}`}>{item.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
