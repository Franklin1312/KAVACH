import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendOTP, verifyOTP, registerWorker } from '../../services/api';

const CITIES = ['chennai', 'mumbai', 'delhi', 'bengaluru'];
const ZONES = {
  chennai:   ['Anna Nagar', 'T. Nagar', 'Adyar', 'Marina', 'Tambaram', 'Velachery'],
  mumbai:    ['Bandra', 'Andheri', 'Dharavi', 'Kurla', 'Dadar', 'Borivali'],
  delhi:     ['Connaught Place', 'Lajpat Nagar', 'Dwarka', 'Rohini', 'Saket', 'Noida'],
  bengaluru: ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Electronic City', 'MG Road'],
};

const STEPS = ['Phone', 'OTP', 'Profile', 'Zone & Income', 'Done'];

export default function Onboarding() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [devOtp, setDevOtp] = useState('');

  const [form, setForm] = useState({
    name: '', aadhaarLast4: '', upiId: '',
    platforms: [], city: '', zone: '',
    declaredWeeklyIncome: '', workingHours: 'full',
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const togglePlatform = (name) => {
    const exists = form.platforms.find((p) => p.name === name);
    if (exists) {
      set('platforms', form.platforms.filter((p) => p.name !== name));
    } else {
      set('platforms', [...form.platforms, { name, partnerId: `${name.toUpperCase()}-MOCK-${Date.now()}` }]);
    }
  };

  // Step 0 — Send OTP
  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) return setError('Enter a valid 10-digit phone number');
    setError(''); setLoading(true);
    try {
      const { data } = await sendOTP(phone);
      if (data.devOtp) setDevOtp(data.devOtp);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  // Step 1 — Verify OTP (just verify, don't login yet)
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) return setError('Enter the 6-digit OTP');
    setError(''); setLoading(true);
    try {
      const { data } = await verifyOTP(phone, otp);
      // Don't call login() here — worker profile is incomplete
      // Just move to next step
      if (data.isNewWorker) {
        setStep(2);
      } else {
        login(data.token, data.worker);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  // Step 3 — Full registration — login happens here
  const handleRegister = async () => {
    const { name, aadhaarLast4, platforms, city, zone, declaredWeeklyIncome, workingHours, upiId } = form;
    if (!name || !aadhaarLast4 || !platforms.length || !city || !zone || !declaredWeeklyIncome)
      return setError('Please fill all required fields');
    setError(''); setLoading(true);
    try {
      const { data } = await registerWorker({
        phone, name, aadhaarLast4, platforms, city, zone,
        declaredWeeklyIncome: Number(declaredWeeklyIncome),
        workingHours, upiId,
      });
      // Login with full worker data from registration response
      login(data.token, data.worker);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>⛨</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#39d353' }}>KAVACH</div>
        <div style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>AI Income Shield for Gig Workers</div>
      </div>

      {/* Step pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{
            width: 60, height: 4, borderRadius: 2,
            background: i < step ? '#39d353' : i === step ? '#388bfd' : '#21262d',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Card */}
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>

        {/* Step 0 — Phone */}
        {step === 0 && (
          <>
            <h2 style={{ marginBottom: 4 }}>Enter your phone</h2>
            <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>We'll send you a one-time password</p>
            <div className="field">
              <label className="label">Mobile Number</label>
              <input type="tel" placeholder="9876543210" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()} />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-primary" onClick={handleSendOTP} disabled={loading} style={{ marginTop: 8 }}>
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
          </>
        )}

        {/* Step 1 — OTP */}
        {step === 1 && (
          <>
            <h2 style={{ marginBottom: 4 }}>Verify OTP</h2>
            <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>
              Sent to +91 {phone}
              {devOtp && <span style={{ color: '#39d353' }}> — Dev OTP: <strong>{devOtp}</strong></span>}
            </p>
            <div className="field">
              <label className="label">6-digit OTP</label>
              <input type="text" placeholder="______" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }} />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-primary" onClick={handleVerifyOTP} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify →'}
            </button>
            <button className="btn-secondary" onClick={() => { setStep(0); setError(''); }}
              style={{ marginTop: 8, width: '100%' }}>← Back</button>
          </>
        )}

        {/* Step 2 — Profile */}
        {step === 2 && (
          <>
            <h2 style={{ marginBottom: 4 }}>Your profile</h2>
            <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>Tell us about yourself</p>
            <div className="field">
              <label className="label">Full Name *</label>
              <input placeholder="Ravi Kumar" value={form.name}
                onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Aadhaar Last 4 Digits *</label>
              <input placeholder="XXXX" maxLength={4} value={form.aadhaarLast4}
                onChange={(e) => set('aadhaarLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </div>
            <div className="field">
              <label className="label">UPI ID (for payouts)</label>
              <input placeholder="yourname@ybl" value={form.upiId}
                onChange={(e) => set('upiId', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Delivery Platform(s) *</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {['zomato', 'swiggy', 'blinkit'].map((p) => {
                  const selected = form.platforms.find((x) => x.name === p);
                  return (
                    <div key={p} onClick={() => togglePlatform(p)} style={{
                      flex: 1, padding: '10px 8px', textAlign: 'center', borderRadius: 8,
                      border: `1px solid ${selected ? '#39d353' : '#30363d'}`,
                      background: selected ? '#196c2e' : '#21262d',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      color: selected ? '#39d353' : '#8b949e',
                    }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </div>
                  );
                })}
              </div>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-primary" onClick={() => {
              if (!form.name || !form.aadhaarLast4 || !form.platforms.length)
                return setError('Fill all required fields');
              setError(''); setStep(3);
            }}>Continue →</button>
          </>
        )}

        {/* Step 3 — Zone + Income */}
        {step === 3 && (
          <>
            <h2 style={{ marginBottom: 4 }}>Your work area</h2>
            <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 20 }}>Used to calculate your premium and risk zone</p>
            <div className="field">
              <label className="label">City *</label>
              <select value={form.city} onChange={(e) => { set('city', e.target.value); set('zone', ''); }}>
                <option value="">Select city</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            {form.city && (
              <div className="field">
                <label className="label">Zone *</label>
                <select value={form.zone} onChange={(e) => set('zone', e.target.value)}>
                  <option value="">Select zone</option>
                  {ZONES[form.city].map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label className="label">Weekly Income (₹) *</label>
              <input type="number" placeholder="5000" min={1000} max={20000}
                value={form.declaredWeeklyIncome}
                onChange={(e) => set('declaredWeeklyIncome', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Working Hours</label>
              <select value={form.workingHours} onChange={(e) => set('workingHours', e.target.value)}>
                <option value="part">Part-time (4–6 hrs/day)</option>
                <option value="full">Full-time (8–12 hrs/day)</option>
                <option value="extended">Extended (12–16 hrs/day)</option>
              </select>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn-primary" onClick={handleRegister} disabled={loading}>
              {loading ? 'Creating account...' : 'Activate KAVACH →'}
            </button>
            <button className="btn-secondary" onClick={() => { setStep(2); setError(''); }}
              style={{ marginTop: 8, width: '100%' }}>← Back</button>
          </>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h2 style={{ color: '#39d353', marginBottom: 8 }}>You're protected!</h2>
            <p style={{ color: '#8b949e', marginBottom: 24, fontSize: 13 }}>
              Your KAVACH account is ready. Activate your weekly policy to start coverage.
            </p>
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
