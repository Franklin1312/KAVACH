import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/common/Navbar';
import { getActivePolicty, getAllClaims, getTriggerStatus, autoProcessClaim, updateMe } from '../../services/api';

const RUPEE = '\u20B9';
const WEEK_DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

function getShiftPreset(workingHours) {
  if (workingHours === 'part') return { usualShiftStart: '17:00', usualShiftEnd: '22:00' };
  if (workingHours === 'extended') return { usualShiftStart: '08:00', usualShiftEnd: '22:00' };
  return { usualShiftStart: '10:00', usualShiftEnd: '20:00' };
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default function Dashboard() {
  const { worker, setWorker } = useAuth();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [claims, setClaims] = useState([]);
  const [triggers, setTriggers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    workingHours: worker?.workingHours || 'full',
    usualShiftStart: worker?.usualShiftStart || '10:00',
    usualShiftEnd: worker?.usualShiftEnd || '20:00',
    workingDays: worker?.workingDays || [1, 2, 3, 4, 5, 6],
  });

  const triggerEntries = Object.entries(triggers?.allResults || triggers?.results || {});

  useEffect(() => {
    setScheduleForm({
      workingHours: worker?.workingHours || 'full',
      usualShiftStart: worker?.usualShiftStart || '10:00',
      usualShiftEnd: worker?.usualShiftEnd || '20:00',
      workingDays: worker?.workingDays || [1, 2, 3, 4, 5, 6],
    });
  }, [worker]);

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
        triggerType: 'rain',
        triggerLevel: 3,
        triggerSources: [{ source: 'IMD (simulated)', value: '45mm/hr', confirmedAt: new Date() }],
        actualEarned: 0,
      });
      alert(`Claim processed. Payout: ${RUPEE}${data.breakdown.payoutAmount}\nDecision: ${data.decision.message}`);
      getAllClaims().then(({ data: claimsData }) => setClaims(claimsData.claims?.slice(0, 3) || []));
    } catch (err) {
      alert(err.response?.data?.error || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const applyWorkingHoursPreset = (workingHours) => {
    const preset = getShiftPreset(workingHours);
    setScheduleForm((current) => ({ ...current, workingHours, ...preset }));
  };

  const toggleWorkingDay = (day) => {
    setScheduleForm((current) => {
      const exists = current.workingDays.includes(day);
      return {
        ...current,
        workingDays: exists ? current.workingDays.filter((value) => value !== day) : [...current.workingDays, day].sort((a, b) => a - b),
      };
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.usualShiftStart || !scheduleForm.usualShiftEnd || !scheduleForm.workingDays.length) {
      setProfileMessage('Select shift times and at least one working day.');
      return;
    }

    setSavingProfile(true);
    setProfileMessage('');
    try {
      const { data } = await updateMe(scheduleForm);
      setWorker(data.worker);
      setProfileMessage('Shift preferences updated.');
    } catch (err) {
      setProfileMessage(err.response?.data?.error || 'Could not update shift preferences');
    } finally {
      setSavingProfile(false);
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
          <div style={{ marginBottom: 28 }}>
            <h1 className="page-title">Good {getTimeGreeting()}, {worker?.name?.split(' ')[0]}</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>{worker?.city} · {worker?.zone}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 0.7fr 0.7fr', gap: 14, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #0B3D91 0%, #1A5BC4 100%)', color: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(11,61,145,0.18)' }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Weekly Coverage</div>
              {policy ? (
                <>
                  <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{RUPEE}{policy.maxPayout?.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 13, opacity: 0.86, marginTop: 8 }}>{policy.tier?.toUpperCase()} · {(policy.coveragePct * 100)}% coverage</div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>Expires {new Date(policy.weekEnd).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>No active policy</div>
                  <button className="btn-primary" style={{ width: 'auto', marginTop: 16 }} onClick={() => navigate('/policy')}>Activate Weekly Policy -&gt;</button>
                </>
              )}
            </div>

            <div className="stat-card"><div className="stat-value" style={{ color: '#0B3D91' }}>{policy?.premium?.finalAmount ? `${RUPEE}${policy.premium.finalAmount}` : '—'}</div><div className="stat-label">Weekly Premium</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#1A1A2E' }}>{claims.length}</div><div className="stat-label">Recent Claims</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#00A86B' }}>{worker?.claimsFreeWeeks || 0}w</div><div className="stat-label">Claims-Free</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 16 }}>
              {triggers && (
                <div className="card">
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Live Disruption Monitor</div>
                  {triggerEntries.length === 0 ? (
                    <div style={{ color: '#9CA3AF', fontSize: 13 }}>No live disruption data available right now.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {triggerEntries.map(([key, value]) => (
                        <div key={key} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: value.triggered ? '#FDEAEA' : '#E5F7EF', color: value.triggered ? '#E53935' : '#007A4D', border: `1px solid ${value.triggered ? '#E53935' : '#00A86B'}` }}>
                          {key.replace('_', ' ')} {value.triggered ? `L${value.level}` : 'OK'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #FF6B35, #FFB347)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Simulate Disruption</div>
                    <div style={{ fontSize: 13, color: '#5A6478' }}>Run the full automated claim pipeline with the current backend logic.</div>
                  </div>
                </div>
                <button className="btn-blue" onClick={handleSimulate} disabled={simulating || !policy} style={{ width: 'auto' }}>
                  {simulating ? 'Processing...' : 'Simulate Rain Claim'}
                </button>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Recent Claims</div>
                  <button style={{ background: 'none', color: '#0B3D91', padding: 0, fontSize: 13 }} onClick={() => navigate('/claims')}>View all -&gt;</button>
                </div>
                {claims.length === 0 ? (
                  <div style={{ color: '#9CA3AF', fontSize: 13 }}>No claims yet.</div>
                ) : claims.map((claim) => (
                  <div key={claim._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F0F0F0' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{claim.triggerType.replace('_', ' ').toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{new Date(claim.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#00A86B', fontFamily: 'Outfit, sans-serif' }}>{RUPEE}{claim.payoutAmount}</div>
                      <span className={`badge ${claim.payoutStatus === 'paid' || claim.payoutStatus === 'approved' ? 'badge-green' : claim.payoutStatus === 'rejected' ? 'badge-red' : 'badge-amber'}`}>{claim.payoutStatus.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Work Schedule</div>
              <div className="field">
                <label className="label">Working Hours</label>
                <select value={scheduleForm.workingHours} onChange={(e) => applyWorkingHoursPreset(e.target.value)}>
                  <option value="part">Part-time (4-6 hrs/day)</option>
                  <option value="full">Full-time (8-12 hrs/day)</option>
                  <option value="extended">Extended (12-16 hrs/day)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label className="label">Shift Start</label><input type="time" value={scheduleForm.usualShiftStart} onChange={(e) => setScheduleForm((current) => ({ ...current, usualShiftStart: e.target.value }))} /></div>
                <div className="field"><label className="label">Shift End</label><input type="time" value={scheduleForm.usualShiftEnd} onChange={(e) => setScheduleForm((current) => ({ ...current, usualShiftEnd: e.target.value }))} /></div>
              </div>
              <div className="field">
                <label className="label">Working Days</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {WEEK_DAYS.map((day) => {
                    const selected = scheduleForm.workingDays.includes(day.value);
                    return (
                      <div key={day.value} onClick={() => toggleWorkingDay(day.value)} style={{ minWidth: 48, padding: '8px 10px', textAlign: 'center', borderRadius: 999, border: `1.5px solid ${selected ? '#0B3D91' : '#E5E7EB'}`, background: selected ? '#EBF0FA' : '#fff', color: selected ? '#0B3D91' : '#5A6478', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{day.label}</div>
                    );
                  })}
                </div>
              </div>
              {profileMessage && <div style={{ fontSize: 12, color: profileMessage.includes('updated') ? '#00A86B' : '#E53935', marginBottom: 10 }}>{profileMessage}</div>}
              <button className="btn-primary" onClick={handleSaveSchedule} disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Schedule'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
