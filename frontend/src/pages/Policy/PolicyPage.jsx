import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import { useLanguage } from '../../context/LanguageContext';
import { getPremiumQuote, getActivePolicty, createPolicy, cancelPolicy, getAllPolicies } from '../../services/api';

const RUPEE = '\u20B9';
const TIERS = [
  { key: 'basic', label: 'Basic', pct: '50%', desc: 'Occasional workers', medal: '🥉', medalNum: 3 },
  { key: 'standard', label: 'Standard', pct: '70%', desc: 'Recommended', medal: '🥈', medalNum: 2, popular: true, subDesc: '⭐' },
  { key: 'premium', label: 'Premium', pct: '85%', desc: 'Maximum protection', medal: '🥇', medalNum: 1 },
];

export default function PolicyPage() {
  const [selectedTier, setSelectedTier] = useState('standard');
  const { t } = useLanguage();
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

      // If backend returned a Razorpay order, launch the checkout popup
      if (data.razorpayOrder) {
        const options = {
          key:         data.razorpayOrder.keyId,
          amount:      data.razorpayOrder.amount,
          currency:    data.razorpayOrder.currency,
          order_id:    data.razorpayOrder.orderId,
          name:        'KAVACH',
          description: `${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Weekly Premium`,
          image:       '',
          theme:       { color: '#0B3D91' },
          prefill: {
            contact: localStorage.getItem('kavach_phone') || '',
          },
          handler: function (response) {
            // Payment successful — update UI
            setPolicy(data.policy);
            getAllPolicies().then(({ data: h }) => setHistory(h.policies || []));
          },
          modal: {
            ondismiss: function () {
              // User closed the popup without paying — policy still created but unpaid
              setPolicy(data.policy);
              getAllPolicies().then(({ data: h }) => setHistory(h.policies || []));
            },
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          setError(`Payment failed: ${resp.error.description}`);
        });
        rzp.open();
      } else {
        // Mock mode — no checkout popup, policy is instantly active
        setPolicy(data.policy);
        const historyResponse = await getAllPolicies();
        setHistory(historyResponse.data.policies || []);
      }
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
          <h1 className="page-title">{t('policy.title', 'Insurance Policy')}</h1>
          <p className="page-subtitle">{t('policy.subtitle', 'Weekly income protection that renews every Monday')}</p>

          {policy && (
            <div style={{ background: 'linear-gradient(135deg, #E5F7EF 0%, #F4FFFA 100%)', border: '1px solid #BCEAD5', borderRadius: 16, padding: 24, marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
              <div>
                <span className="badge badge-green" style={{ marginBottom: 10 }}>ACTIVE</span>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#007A4D', fontFamily: 'Outfit, sans-serif' }}>{RUPEE}{policy.maxPayout?.toLocaleString('en-IN')} {t('policy.protected', 'protected')}</div>
                <div style={{ fontSize: 13, color: '#5A6478', marginTop: 6 }}>{policy.tier?.toUpperCase()} · {RUPEE}{policy.premium?.finalAmount}/{t('policy.perWeek', 'per week · UPI AutoPay every Monday').split(' · ')[0]}</div>
                <div style={{ fontSize: 12, color: '#7B8794', marginTop: 4 }}>{t('policy.expires', 'Expires')} {new Date(policy.weekEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
              </div>
              <button className="btn-danger" onClick={handleCancel}>{t('policy.cancel', 'Cancel Policy')}</button>
            </div>
          )}

          {!policy && (
            <>
              <div className="card" style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, fontFamily: 'Outfit, sans-serif' }}>{t('policy.chooseTier', 'Choose Coverage Tier')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'end' }}>
                  {TIERS.map((tier) => {
                    const selected = selectedTier === tier.key;
                    const isPopular = tier.popular;
                    return (
                      <div key={tier.key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {isPopular && (
                          <div style={{
                            position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
                            background: '#0B3D91', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
                            padding: '5px 18px', borderRadius: 20, whiteSpace: 'nowrap',
                          }}>POPULAR</div>
                        )}
                        <div
                          onClick={() => handleTierChange(tier.key)}
                          style={{
                            width: '100%', padding: isPopular ? '32px 18px 24px' : '22px 18px 20px',
                            borderRadius: 20, cursor: 'pointer', textAlign: 'center',
                            border: `2.5px solid ${selected ? '#0B3D91' : '#E5E7EB'}`,
                            background: selected ? 'linear-gradient(180deg, #F0F4FF 0%, #fff 100%)' : '#fff',
                            boxShadow: isPopular ? '0 8px 32px rgba(11,61,145,0.12)' : selected ? '0 4px 16px rgba(11,61,145,0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
                            transition: 'all 0.25s ease',
                            transform: isPopular ? 'scale(1.04)' : 'none',
                          }}
                        >
                          <div style={{ fontSize: 48, marginBottom: 8, lineHeight: 1 }}>{tier.medal}</div>
                          <div style={{ fontSize: 36, fontWeight: 800, color: selected ? '#0B3D91' : '#1A1A2E', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>{tier.pct}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, color: '#1A1A2E' }}>{tier.label}</div>
                          <div style={{ fontSize: 13, color: '#7B8794', marginTop: 6 }}>{tier.desc}</div>
                          {tier.subDesc && <div style={{ marginTop: 6, fontSize: 16 }}>{tier.subDesc}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {quote && (
                <div className="card" style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('policy.premiumBreakdown', 'Premium Breakdown')}</div>
                  <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #F0F0F0' }}>
                    <div style={{ fontSize: 42, fontWeight: 800, color: '#00A86B', fontFamily: 'Outfit, sans-serif' }}>{RUPEE}{quote.finalAmount}</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>{t('policy.perWeek', 'per week · UPI AutoPay every Monday')}</div>
                    <div style={{ fontSize: 14, marginTop: 10 }}>{t('policy.maxPayout', 'Max payout')}: <strong style={{ color: '#0B3D91' }}>{RUPEE}{quote.maxPayout?.toLocaleString('en-IN')}</strong></div>
                  </div>

                  {[
                    [t('policy.baseRate', 'Base rate'), quote.breakdown?.baseRate],
                    [t('policy.zoneRisk', 'Zone risk factor'), `${quote.breakdown?.zoneRiskFactor}x`],
                    [t('policy.seasonMul', 'Season multiplier'), `${quote.breakdown?.seasonMultiplier}x`],
                    [t('policy.claimsFreeDisc', 'Claims-free discount'), `-${quote.breakdown?.claimsFreeDiscount}`],
                    [t('policy.surgeLoading', 'Surge loading'), `+${RUPEE}${quote.breakdown?.surgeLoading}`],
                    [t('policy.tierMul', 'Tier multiplier'), `${quote.breakdown?.tierMultiplier}x`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5', fontSize: 14 }}>
                      <span style={{ color: '#6B7280' }}>{label}</span>
                      <span style={{ fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, fontSize: 16, fontWeight: 800 }}>
                    <span>{t('policy.weeklyPremium', 'Weekly Premium')}</span>
                    <span style={{ color: '#00A86B' }}>{RUPEE}{quote.finalAmount}</span>
                  </div>
                </div>
              )}

              {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
              <button className="btn-primary" onClick={handleActivate} disabled={loading}>{loading ? t('policy.activating', 'Activating...') : `${t('policy.activate', 'Activate')} ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Policy →`}</button>
            </>
          )}

          {history.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('policy.history', 'Policy History')}</div>
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
