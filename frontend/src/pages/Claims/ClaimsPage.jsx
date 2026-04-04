import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import { useLanguage } from '../../context/LanguageContext';
import { getAllClaims, simulateTrigger, autoProcessClaim, getActivePolicty } from '../../services/api';

const RUPEE = '\u20B9';
const TRIGGER_TYPES = [
  { key: 'rain', label: 'Heavy Rain', level: 3 },
  { key: 'aqi', label: 'Severe AQI', level: 4 },
  { key: 'flood', label: 'Flash Flood', level: 3 },
  { key: 'curfew', label: 'Curfew', level: 4 },
  { key: 'platform_outage', label: 'Platform Outage', level: 3 },
];

const STATUS_COLORS = {
  paid: { bg: '#E5F7EF', color: '#007A4D' },
  approved: { bg: '#E5F7EF', color: '#007A4D' },
  pending: { bg: '#FFF8EB', color: '#B7791F' },
  manual_review: { bg: '#E3F2FD', color: '#0B3D91' },
  rejected: { bg: '#FDEAEA', color: '#E53935' },
};

function formatCurrency(value) {
  return typeof value === 'number' ? `${RUPEE}${value}` : '-';
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 60) return `${minutes} min`;
  const hours = (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
  return `${hours} hr`;
}

function WindowDetails({ summary, methodology }) {
  if (!summary) return null;
  const sections = [
    ['Verified disruption', summary.verifiedDisruptionWindow],
    ['Shift overlap', summary.eligibleWorkWindow],
    ['Payable loss window', summary.finalLossWindow],
  ].filter(([, value]) => value);
  if (!sections.length) return null;

  return (
    <div style={{ marginTop: 10, padding: '12px 14px', background: '#F8FAFD', borderRadius: 12, border: '1px solid #E5E7EB' }}>
      {sections.map(([label, value]) => (
        <div key={label} style={{ fontSize: 12, color: '#5A6478', marginBottom: 6 }}>
          <span style={{ color: '#1A1A2E', fontWeight: 700 }}>{label}:</span>{' '}
          {formatDateTime(value.start)} to {formatDateTime(value.end)}
          {typeof value.durationMinutes === 'number' && ` (${formatMinutes(value.durationMinutes)})`}
          {typeof value.totalEligibleMinutes === 'number' && ` (${formatMinutes(value.totalEligibleMinutes)})`}
        </div>
      ))}
      {methodology && <div style={{ fontSize: 11, color: '#7B8794', marginTop: 4 }}>{methodology}</div>}
    </div>
  );
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selected, setSelected] = useState('rain');
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
    const trigger = TRIGGER_TYPES.find((item) => item.key === selected);
    setSimulating(true);
    setLastResult(null);
    try {
      const { data: simData } = await simulateTrigger(trigger.key, trigger.level);
      const { data } = await autoProcessClaim(simData.triggerData);
      setLastResult(data);
      setClaims((prev) => [data.claim, ...prev]);
    } catch (err) {
      alert(err.response?.data?.error || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ padding: 60, textAlign: 'center', color: '#5A6478' }}>Loading...</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={{ background: '#F5F7FA', minHeight: 'calc(100vh - 64px)' }}>
        <div className="page-container">
          <h1 className="page-title">{t('claims.title', 'Claims')}</h1>
          <p className="page-subtitle">{t('claims.subtitle', 'Automated income protection payouts')}</p>

          <div className="card" style={{ marginBottom: 24, border: '1px solid #D0DCEF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0B3D91, #2E7DD6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>T</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('claims.simulator', 'Disruption Simulator')}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {TRIGGER_TYPES.map((trigger) => {
                const isSelected = selected === trigger.key;
                return (
                  <div key={trigger.key} onClick={() => setSelected(trigger.key)} style={{ padding: '8px 16px', borderRadius: 50, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `1.5px solid ${isSelected ? '#0B3D91' : '#E5E7EB'}`, background: isSelected ? '#EBF0FA' : '#F9FAFB', color: isSelected ? '#0B3D91' : '#5A6478' }}>{trigger.label}</div>
                );
              })}
            </div>
            <button className="btn-blue" onClick={handleSimulate} disabled={simulating} style={{ width: 'auto' }}>{simulating ? t('claims.processingPipeline', 'Processing pipeline...') : t('claims.fireTrigger', 'Fire Trigger →')}</button>
          </div>

          {lastResult && (
            <div className="card" style={{ marginBottom: 24, border: '2px solid #00A86B' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#00A86B' }}>{t('claims.processed', 'Claim Processed')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  ['Predicted loss', formatCurrency(lastResult.breakdown?.predictedLoss)],
                  ['Actual earned', formatCurrency(lastResult.breakdown?.actualEarned)],
                  ['Net loss', formatCurrency(lastResult.breakdown?.netLoss)],
                  ['Coverage', `${lastResult.breakdown?.coveragePct * 100}%`],
                  ['Payout', formatCurrency(lastResult.breakdown?.payoutAmount)],
                  ['Fraud score', `${lastResult.breakdown?.fraudScore}/100`],
                  ['PPCS', `${lastResult.breakdown?.ppcs}/100`],
                  ['Decision', lastResult.decision?.action?.replace('_', ' ').toUpperCase()],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '10px 14px', background: '#F5F7FA', borderRadius: 10 }}>
                    <div style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              <WindowDetails summary={{ verifiedDisruptionWindow: lastResult.breakdown?.verifiedDisruptionWindow, eligibleWorkWindow: lastResult.breakdown?.eligibleWorkWindow, finalLossWindow: lastResult.breakdown?.finalLossWindow }} methodology={lastResult.breakdown?.verifiedDisruptionWindow?.methodology} />
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#EBF0FA', borderRadius: 10, fontSize: 13, color: '#0B3D91' }}>{lastResult.decision?.message}</div>
            </div>
          )}

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{t('claims.history', 'Claims History')}</div>
            {claims.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '32px 0', fontSize: 14 }}>{t('claims.noClaims', 'No claims yet. Simulate a disruption above to see the pipeline in action.')}</div>
            ) : claims.map((claim) => {
              const statusColor = STATUS_COLORS[claim.payoutStatus] || STATUS_COLORS.pending;
              return (
                <div key={claim._id} style={{ padding: '16px 0', borderBottom: '1px solid #F0F0F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{claim.triggerType.replace('_', ' ').toUpperCase()} - Level {claim.triggerLevel}</div>
                      <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>{new Date(claim.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ fontSize: 13, color: '#5A6478', marginTop: 3 }}>Predicted {formatCurrency(claim.predictedLoss)} · Earned {formatCurrency(claim.actualEarned)} · Net loss {formatCurrency(claim.netLoss)}</div>
                      <WindowDetails summary={claim.windowSummary} methodology={claim.windowSummary?.verifiedDisruptionWindow?.methodology} />
                      {claim.fraudFlags?.length > 0 && <div style={{ fontSize: 12, color: '#F5A623', marginTop: 4 }}>Flags: {claim.fraudFlags.join(', ')}</div>}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 110 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#00A86B', fontFamily: 'Outfit, sans-serif' }}>{formatCurrency(claim.payoutAmount)}</div>
                      <div style={{ marginTop: 6, padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: statusColor.bg, color: statusColor.color, display: 'inline-block' }}>{claim.payoutStatus.replace('_', ' ').toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
