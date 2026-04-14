import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelector from '../../components/common/LanguageSelector';
import { sendOTP, verifyOTP, registerWorker, loginAdmin } from '../../services/api';

// ─── Admin credentials (hard-coded) ───────────────────────────────────────────
// Change these values to update admin access credentials.
const ADMIN_PHONE = process.env.REACT_APP_ADMIN_PHONE || '9999900000';
// ──────────────────────────────────────────────────────────────────────────────

const CITIES = [
  'chennai', 'mumbai', 'delhi', 'bengaluru',
  'hyderabad', 'pune', 'kolkata', 'ahmedabad',
  'jaipur', 'lucknow', 'surat', 'kochi',
  'chandigarh', 'indore', 'nagpur', 'coimbatore',
];

const ZONES = {
  chennai: ['Anna Nagar', 'T. Nagar', 'Adyar', 'Marina', 'Tambaram', 'Velachery', 'Sholinganallur', 'Porur', 'Ambattur', 'Perungudi'],
  mumbai: ['Bandra', 'Andheri', 'Dharavi', 'Kurla', 'Dadar', 'Borivali', 'Worli', 'Colaba', 'Powai', 'Vikhroli'],
  delhi: ['Connaught Place', 'Lajpat Nagar', 'Dwarka', 'Rohini', 'Saket', 'Noida Sec 62', 'Karol Bagh', 'Janakpuri', 'Pitampura', 'Vasant Kunj'],
  bengaluru: ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Electronic City', 'MG Road', 'Jayanagar', 'Marathahalli', 'Hebbal', 'Yelahanka'],
  hyderabad: ['Gachibowli', 'HITEC City', 'Banjara Hills', 'Jubilee Hills', 'Uppal', 'Secunderabad', 'Kukatpally', 'Madhapur', 'Ameerpet', 'LB Nagar'],
  pune: ['Hinjewadi', 'Magarpatta', 'Koregaon Park', 'Viman Nagar', 'Kothrud', 'Wakad', 'Baner', 'Hadapsar', 'Pimpri', 'Chinchwad'],
  kolkata: ['Salt Lake', 'New Town', 'Park Street', 'Howrah', 'Dum Dum', 'Behala', 'Jadavpur', 'Garia', 'Rajarhat', 'Ballygunge'],
  ahmedabad: ['Navrangpura', 'Satellite', 'Bopal', 'Prahlad Nagar', 'Maninagar', 'Vastrapur', 'Gota', 'Chandkheda', 'Thaltej', 'Bodakdev'],
  jaipur: ['Malviya Nagar', 'Vaishali Nagar', 'C-Scheme', 'Mansarovar', 'Tonk Road', 'Sirsi Road', 'Sodala', 'Jagatpura', 'Sanganer', 'Pratap Nagar'],
  lucknow: ['Gomti Nagar', 'Hazratganj', 'Aliganj', 'Indira Nagar', 'Alambagh', 'Rajajipuram', 'Vikas Nagar', 'Chinhat', 'Sushant Golf City', 'Mahanagar'],
  surat: ['Vesu', 'Adajan', 'Piplod', 'Pal', 'Athwa', 'Varachha', 'Katargam', 'Udhna', 'Rander', 'Althan'],
  kochi: ['Kakkanad', 'Edapally', 'Aluva', 'Fort Kochi', 'Thrippunithura', 'Kalamassery', 'Perumbavoor', 'Angamaly', 'Vyttila', 'Palarivattom'],
  chandigarh: ['Sector 17', 'Sector 22', 'Sector 35', 'Mohali Phase 7', 'Panchkula Sec 20', 'Manimajra', 'IT Park', 'Sector 43', 'Zirakpur', 'Kharar'],
  indore: ['Vijay Nagar', 'Palasia', 'Rajwada', 'Super Corridor', 'AB Road', 'Bhawarkua', 'Scheme 54', 'Niranjanpur', 'Rau', 'Sanwer Road'],
  nagpur: ['Dharampeth', 'Sitabuldi', 'Sadar', 'Wardha Road', 'Amravati Road', 'Hingna', 'Manish Nagar', 'Pratap Nagar', 'Trimurti Nagar', 'Besa'],
  coimbatore: ['Gandhipuram', 'RS Puram', 'Saibaba Colony', 'Singanallur', 'Peelamedu', 'Kuniyamuthur', 'Vadavalli', 'Hopes College', 'Ukkadam', 'Podanur'],
};

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

export default function Onboarding() {
  const { login, adminLogin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const RUPEE = '\u20B9';

  // step -1 = admin password screen, 0 = phone entry, 1 = OTP, 2–3 = registration
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');

  const NAV_SECTIONS = {
    'About': 'about',
    'How It Works': 'how-it-works',
    'FAQs': 'faqs',
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const FAQ_ITEMS = [
    { q: t('faq.q1', 'What is KAVACH?'), a: t('faq.a1', 'KAVACH is an AI-powered income protection platform for gig delivery partners. It provides weekly coverage against weather disruptions, floods, AQI spikes, curfews, and platform outages.') },
    { q: t('faq.q2', 'How does the payout work?'), a: t('faq.a2', 'When a verified disruption is detected in your delivery zone during your shift hours, KAVACH automatically calculates your income loss using ML models and processes a payout directly to your UPI ID — often within 60 seconds.') },
    { q: t('faq.q3', 'What coverage tiers are available?'), a: t('faq.a3', 'KAVACH offers three tiers — Basic (50% coverage for occasional workers), Standard (70% coverage, recommended), and Premium (85% coverage for maximum protection). Premiums adjust based on your city, zone risk, and claims-free history.') },
    { q: t('faq.q4', 'How are claims verified?'), a: t('faq.a4', 'Claims are verified using server-side data from government weather APIs (IMD), air quality servers (CPCB), and platform status checks. No manual uploads or forms are needed — everything is automated and transparent.') },
    { q: t('faq.q5', 'Can I cancel my policy?'), a: t('faq.a5', 'Yes, you can cancel your active weekly policy at any time from the Policy tab. Coverage is weekly, so there are no long-term lock-ins. You can reactivate any time.') },
    { q: t('faq.q6', 'Which cities are supported?'), a: t('faq.a6', 'KAVACH currently operates across 16 major Indian cities including Mumbai, Delhi, Bengaluru, Chennai, Hyderabad, Pune, Kolkata, and more. We are rapidly expanding to cover additional cities.') },
  ];
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [form, setForm] = useState({
    name: '',
    aadhaarLast4: '',
    upiId: '',
    platforms: [],
    city: '',
    zone: '',
    declaredWeeklyIncome: '',
    workingHours: 'full',
    usualShiftStart: '10:00',
    usualShiftEnd: '20:00',
    workingDays: [1, 2, 3, 4, 5, 6],
  });

  const stepBars = useMemo(() => [0, 1, 2, 3], []);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const togglePlatform = (name) => {
    const exists = form.platforms.find((platform) => platform.name === name);
    if (exists) {
      set('platforms', form.platforms.filter((platform) => platform.name !== name));
      return;
    }
    set('platforms', [...form.platforms, { name, partnerId: `${name.toUpperCase()}-MOCK-${Date.now()}` }]);
  };

  const toggleWorkingDay = (day) => {
    setForm((current) => {
      const exists = current.workingDays.includes(day);
      return {
        ...current,
        workingDays: exists ? current.workingDays.filter((value) => value !== day) : [...current.workingDays, day].sort((a, b) => a - b),
      };
    });
  };

  const applyWorkingHoursPreset = (workingHours) => {
    const preset = getShiftPreset(workingHours);
    setForm((current) => ({ ...current, workingHours, ...preset }));
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length !== 10) return setError('Enter a valid 10-digit phone number');
    setError('');
    // If admin phone detected — go to password screen instead of OTP
    if (phone === ADMIN_PHONE) {
      setAdminPassword('');
      setStep(-1);
      return;
    }
    setLoading(true);
    try {
      const { data } = await sendOTP(phone);
      if (data.devOtp) setDevOtp(data.devOtp);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setError('');
    if (!adminPassword) return;

    setLoading(true);
    try {
      const { data } = await loginAdmin(phone, adminPassword);
      adminLogin(data.token, data.admin);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect admin credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) return setError('Enter the 6-digit OTP');
    setError('');
    setLoading(true);
    try {
      const { data } = await verifyOTP(phone, otp);
      if (data.isNewWorker) {
        setStep(2);
        return;
      }
      login(data.token, data.worker);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const payload = {
      phone,
      name: form.name,
      aadhaarLast4: form.aadhaarLast4,
      platforms: form.platforms,
      city: form.city,
      zone: form.zone,
      declaredWeeklyIncome: Number(form.declaredWeeklyIncome),
      workingHours: form.workingHours,
      upiId: form.upiId,
      usualShiftStart: form.usualShiftStart,
      usualShiftEnd: form.usualShiftEnd,
      workingDays: form.workingDays,
    };

    if (!payload.name || !payload.aadhaarLast4 || !payload.platforms.length || !payload.city || !payload.zone || !payload.declaredWeeklyIncome || !payload.usualShiftStart || !payload.usualShiftEnd || !payload.workingDays.length) {
      return setError(t('onboard.fillRequired', 'Please fill all required fields'));
    }

    setError('');
    setLoading(true);
    try {
      const { data } = await registerWorker(payload);
      login(data.token, data.worker);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t('onboard.fillRequired', 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const renderCardBody = () => {
    // ── Admin password screen ──────────────────────────────────────────────────
    if (step === -1) {
      return (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #0B3D91, #1A5BC4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 8px 24px rgba(11,61,145,0.25)' }}>
              <span style={{ fontSize: 28, color: '#fff', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>K</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0B3D91', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Admin Access</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Enter Admin Password</h2>
            <p style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>Restricted area — authorised personnel only.</p>
          </div>
          <div style={{ background: '#F5F7FA', borderRadius: 10, padding: '10px 14px', marginBottom: 18, border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#5A6478' }}>Phone</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>+91 {phone}</span>
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              id="admin-password-input"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Enter admin password"
              style={{ letterSpacing: 2 }}
              autoFocus
            />
          </div>
          {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
          <button
            id="admin-login-btn"
            className="btn-primary"
            onClick={handleAdminLogin}
            disabled={loading || !adminPassword}
            style={{ background: 'linear-gradient(135deg, #0B3D91, #1A5BC4)' }}
          >
            {loading ? 'Checking...' : 'Access Admin Dashboard →'}
          </button>
          <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => { setStep(0); setError(''); setAdminPassword(''); }}>
            ← Back
          </button>
        </>
      );
    }

    if (step === 0) {
      return (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>{stepBars.map((bar) => <div key={bar} style={{ flex: 1, height: 4, background: bar === 0 ? '#1A1A2E' : '#F3F4F6', borderRadius: 2 }} />)}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{t('onboard.getStarted', 'Get Started')}</h2>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28 }}>{t('onboard.enterPhone', 'Enter your phone number to begin with OTP verification.')}</p>
          <div className="field">
            <label className="label">{t('onboard.mobile', 'Mobile Number')}</label>
            <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', color: '#4B5563', fontWeight: 600 }}>+91</div>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" style={{ border: 'none', boxShadow: 'none', paddingLeft: 0 }} />
            </div>
          </div>
          {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
          <button className="btn-primary" onClick={handleSendOTP} disabled={loading || phone.length !== 10}>{loading ? t('onboard.sending', 'Sending...') : t('onboard.sendOtp', 'Send OTP →')}</button>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#9CA3AF' }}>{t('onboard.terms', 'By continuing, you agree to our Terms and Conditions.')}</div>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>{stepBars.map((bar) => <div key={bar} style={{ flex: 1, height: 4, background: bar <= 1 ? '#1A1A2E' : '#F3F4F6', borderRadius: 2 }} />)}</div>
          {devOtp && (
            <div style={{ background: 'linear-gradient(135deg, #E5F7EF 0%, #D1FAE5 100%)', border: '1px solid #34D399', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', marginBottom: 3 }}>{t('onboard.devOtp', 'Dev OTP')}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#047857', letterSpacing: 6 }}>{devOtp}</div>
            </div>
          )}
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{t('onboard.verifyOtp', 'Verify OTP')}</h2>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>{t('onboard.sentTo', 'Sent to +91')} {phone}</p>
          <div className="field">
            <label className="label">{t('onboard.otpLabel', '6-digit OTP')}</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" style={{ fontSize: 28, letterSpacing: 10, textAlign: 'center' }} />
          </div>
          {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
          <button className="btn-primary" onClick={handleVerifyOTP} disabled={loading || otp.length !== 6}>{loading ? t('onboard.verifying', 'Verifying...') : t('onboard.verifyBtn', 'Verify OTP →')}</button>
          <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => { setStep(0); setError(''); }}>{t('onboard.backPhone', 'Back to phone number')}</button>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>{stepBars.map((bar) => <div key={bar} style={{ flex: 1, height: 4, background: bar <= 2 ? '#1A1A2E' : '#F3F4F6', borderRadius: 2 }} />)}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{t('onboard.profile', 'Your Profile')}</h2>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 22 }}>{t('onboard.profileDesc', 'Tell us about yourself and your delivery work.')}</p>
          <div className="field"><label className="label">{t('onboard.fullName', 'Full Name')} *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ravi Kumar" /></div>
          <div className="field"><label className="label">{t('onboard.aadhaar', 'Aadhaar Last 4 Digits')} *</label><input value={form.aadhaarLast4} onChange={(e) => set('aadhaarLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" /></div>
          <div className="field"><label className="label">{t('onboard.upiId', 'UPI ID')}</label><input value={form.upiId} onChange={(e) => set('upiId', e.target.value)} placeholder="name@ybl" /></div>
          <div className="field">
            <label className="label">{t('onboard.platforms', 'Platforms')} *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
              {['zomato', 'swiggy', 'blinkit'].map((platformName) => {
                const selected = form.platforms.some((platform) => platform.name === platformName);
                return (
                  <div key={platformName} onClick={() => togglePlatform(platformName)} style={{ padding: '12px 10px', textAlign: 'center', borderRadius: 999, border: `1.5px solid ${selected ? '#0B3D91' : '#E5E7EB'}`, background: selected ? '#EBF0FA' : '#fff', color: selected ? '#0B3D91' : '#5A6478', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{platformName.charAt(0).toUpperCase() + platformName.slice(1)}</div>
                );
              })}
            </div>
          </div>
          {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
          <button className="btn-primary" onClick={() => {
            if (!form.name || !form.aadhaarLast4 || !form.platforms.length) return setError(t('onboard.fillRequired', 'Please fill all required fields'));
            setError('');
            setStep(3);
          }}>{ t('onboard.continue', 'Continue →')}</button>
        </>
      );
    }

    return (
      <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>{stepBars.map((bar) => <div key={bar} style={{ flex: 1, height: 4, background: '#1A1A2E', borderRadius: 2 }} />)}</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{t('onboard.workArea', 'Your Work Area')}</h2>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 22 }}>{t('onboard.workAreaDesc', 'Used to calculate premium, risk zone, and payout windows.')}</p>
        <div className="field">
          <label className="label">{t('onboard.city', 'City')} *</label>
          <select value={form.city} onChange={(e) => { set('city', e.target.value); set('zone', ''); }}>
            <option value="">{t('onboard.selectCity', 'Select city')}</option>
            {CITIES.map((city) => <option key={city} value={city}>{city.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</option>)}
          </select>
        </div>
        {form.city && ZONES[form.city] && (
          <div className="field">
            <label className="label">{t('onboard.zone', 'Zone')} *</label>
            <select value={form.zone} onChange={(e) => set('zone', e.target.value)}>
              <option value="">{t('onboard.selectZone', 'Select zone')}</option>
              {ZONES[form.city].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </div>
        )}
        <div className="field"><label className="label">{t('onboard.weeklyIncome', 'Weekly Income')} ({RUPEE}) *</label><input type="number" min={1000} max={20000} value={form.declaredWeeklyIncome} onChange={(e) => set('declaredWeeklyIncome', e.target.value)} placeholder="5000" /></div>
        <div className="field"><label className="label">{t('onboard.workingHours', 'Working Hours')}</label><select value={form.workingHours} onChange={(e) => applyWorkingHoursPreset(e.target.value)}><option value="part">{t('onboard.partTime', 'Part-time (4-6 hrs/day)')}</option><option value="full">{t('onboard.fullTime', 'Full-time (8-12 hrs/day)')}</option><option value="extended">{t('onboard.extended', 'Extended (12-16 hrs/day)')}</option></select></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label className="label">{t('onboard.shiftStart', 'Shift Start')} *</label><input type="time" value={form.usualShiftStart} onChange={(e) => set('usualShiftStart', e.target.value)} /></div>
          <div className="field"><label className="label">{t('onboard.shiftEnd', 'Shift End')} *</label><input type="time" value={form.usualShiftEnd} onChange={(e) => set('usualShiftEnd', e.target.value)} /></div>
        </div>
        <div className="field">
          <label className="label">{t('onboard.workingDays', 'Working Days')} *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WEEK_DAYS.map((day) => {
              const selected = form.workingDays.includes(day.value);
              return <div key={day.value} onClick={() => toggleWorkingDay(day.value)} style={{ minWidth: 48, padding: '8px 10px', textAlign: 'center', borderRadius: 999, border: `1.5px solid ${selected ? '#0B3D91' : '#E5E7EB'}`, background: selected ? '#EBF0FA' : '#fff', color: selected ? '#0B3D91' : '#5A6478', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{day.label}</div>;
            })}
          </div>
        </div>
        {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
        <button className="btn-primary" onClick={handleRegister} disabled={loading}>{loading ? t('onboard.creatingAccount', 'Creating account...') : t('onboard.activateKavach', 'Activate KAVACH →')}</button>
        <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => { setStep(2); setError(''); }}>{t('onboard.back', 'Back')}</button>
      </>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <div className="live-wallpaper-bg" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', backgroundImage: 'linear-gradient(to bottom, rgba(10,22,40,0.78), rgba(10,22,40,0.60)), url(/kavach-hero-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 40px', position: 'relative', zIndex: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/kavach-logo.jpg" alt="KAVACH Logo" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 800, color: '#fff' }}>KAVACH</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', letterSpacing: 1 }}>{t('app.tagline', 'Income protection for delivery partners')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <LanguageSelector />
            {['About', 'How It Works', 'FAQs'].map((item) => (
              <span
                key={item}
                onClick={() => scrollToSection(NAV_SECTIONS[item])}
                style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.82)'}
              >{t(`onboard.${item === 'About' ? 'about' : item === 'How It Works' ? 'howItWorks' : 'faqs'}`, item)}</span>
            ))}
          </div>
        </div>

        <div className="orb-1" style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,168,107,0.2) 0%, rgba(255,255,255,0) 70%)', filter: 'blur(50px)', zIndex: 1 }} />
        <div className="orb-2" style={{ position: 'absolute', bottom: -150, left: -150, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.2) 0%, rgba(255,255,255,0) 70%)', filter: 'blur(60px)', zIndex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2, padding: '60px 20px 100px' }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 20, marginBottom: 24, border: '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ display: 'inline-block', width: 8, height: 12, background: 'linear-gradient(135deg, #FF6B35, #E85A25)', borderRadius: '4px 4px 2px 2px' }} />
              <span style={{ display: 'inline-block', width: 8, height: 12, background: 'linear-gradient(135deg, #2196F3, #1976D2)', borderRadius: '4px 4px 2px 2px' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FFD166', letterSpacing: '0.5px' }}>{t('hero.badge', "INDIA'S FIRST AI INCOME SHIELD")}</span>
            </div>
            <h1 style={{ fontSize: 54, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>{t('hero.title1', 'The Policy That')}<br /><span style={{ color: '#FF6B35' }}>{t('hero.title2', 'Rides With You')}</span></h1>
            <p style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17, lineHeight: 1.65, marginBottom: 40 }}>{t('hero.desc', "AI-powered income protection for India's gig delivery partners. Get covered against rain, floods, AQI, and disruptions with server-verified claims and fast payouts.")}</p>
            <div style={{ display: 'flex', gap: 24, paddingBottom: 24, flexWrap: 'wrap' }}>
              {[[t('hero.stat1.value', '10,000+'), t('hero.stat1.label', 'Delivery Partners')], [`${RUPEE}2.5 Cr+`, t('hero.stat2.label', 'Claims Settled')], [t('hero.stat3.value', '<60s'), t('hero.stat3.label', 'Avg. Processing')], [t('hero.stat4.value', '16 Cities'), t('hero.stat4.label', 'Coverage Network')]].map(([value, label]) => (
                <div key={label}><div style={{ fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>{value}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{label}</div></div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', maxWidth: 520 }}>
              <img src="/delivery-hero.png" alt="Delivery Partner" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #00A86B' }} />
              <div>
                <div style={{ color: '#fff', fontSize: 13, fontStyle: 'italic', marginBottom: 4, fontWeight: 600 }}>{t('hero.testimonial', "'Finally, an income shield built for gig workers.'")}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 500 }}>{t('hero.testimonialSub', 'Server-verified triggers, ML-backed loss prediction, direct payout.')}</div>
              </div>
            </div>
          </div>

          <div style={{ width: 420, flexShrink: 0 }}>
            <div style={{ padding: 32, borderRadius: 16, background: '#fff', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}>
              {renderCardBody()}
            </div>
          </div>
        </div>
      </div>

      <div id="about" style={{ background: '#F8F9FA', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0A1628', marginBottom: 12 }}>{t('onboard.whyKavach', 'Why Delivery Partners Choose KAVACH')}</h2>
            <p style={{ fontSize: 16, color: '#5A6478' }}>{t('onboard.builtFor', "Built specifically for India's gig economy workers")}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {[
              { icon: 'Rain', title: t('feature.weather.title', 'Weather Protection'), desc: t('feature.weather.desc', 'Auto-payouts when rain or floods disrupt your deliveries') },
              { icon: 'Fast', title: t('feature.instant.title', 'Instant Claims'), desc: t('feature.instant.desc', 'AI verifies and processes claims in under a minute') },
              { icon: 'UPI', title: t('feature.upi.title', 'UPI Payouts'), desc: t('feature.upi.desc', 'Money directly to your payout rail with no paperwork') },
              { icon: 'Plan', title: t('feature.weekly.title', 'Weekly Plans'), desc: t('feature.weekly.desc', 'Flexible weekly coverage tailored for delivery work') },
            ].map((feature) => (
              <div key={feature.title} className="card" style={{ textAlign: 'center', border: 'none' }}>
                <div style={{ fontSize: 20, marginBottom: 16, fontWeight: 800, color: '#0B3D91', fontFamily: 'Outfit, sans-serif' }}>{feature.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{feature.title}</div>
                <div style={{ fontSize: 13, color: '#5A6478', lineHeight: 1.5 }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How KAVACH Works */}
      <div id="how-it-works" style={{ background: '#fff', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0A1628', marginBottom: 60 }}>{t('onboard.howTitle', 'How KAVACH Works')}</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap' }}>
            {[
              { num: '01', color: '#1A1A2E', title: t('step.register', 'Register'), desc: t('step.register.desc', 'Sign up with your phone number and delivery platform details') },
              { num: '02', color: '#0B3D91', title: t('step.plan', 'Choose a Plan'), desc: t('step.plan.desc', 'Pick Basic, Standard, or Premium weekly coverage tier') },
              { num: '03', color: '#00A86B', title: t('step.protected', 'Stay Protected'), desc: t('step.protected.desc', 'AI monitors weather, AQI & disruptions in your delivery zone') },
              { num: '04', color: '#FF6B35', title: t('step.paid', 'Get Paid'), desc: t('step.paid.desc', 'Automatic payout to your UPI when disruption is detected') },
            ].map((step) => (
              <div key={step.num} style={{ textAlign: 'center', maxWidth: 200 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: step.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: '0 auto 16px', boxShadow: `0 4px 20px ${step.color}44` }}>{step.num}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1A1A2E' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: '#5A6478', lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div id="faqs" style={{ background: '#F8F9FA', padding: '80px 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0A1628', marginBottom: 12, textAlign: 'center' }}>{t('onboard.faqTitle', 'Frequently Asked Questions')}</h2>
          <p style={{ fontSize: 16, color: '#5A6478', textAlign: 'center', marginBottom: 40 }}>{t('onboard.faqSubtitle', 'Everything you need to know about KAVACH')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ_ITEMS.map((faq, idx) => (
              <div key={idx} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', transition: 'box-shadow 0.2s', boxShadow: openFaq === idx ? '0 4px 16px rgba(0,0,0,0.08)' : 'none' }}>
                <div
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{ padding: '18px 24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A2E' }}>{faq.q}</span>
                  <span style={{ fontSize: 20, color: '#9CA3AF', fontWeight: 300, flexShrink: 0, transform: openFaq === idx ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
                </div>
                {openFaq === idx && (
                  <div style={{ padding: '0 24px 18px', fontSize: 14, color: '#5A6478', lineHeight: 1.7 }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#0A1628', padding: '48px 40px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 32, flexWrap: 'wrap', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/kavach-logo.jpg" alt="KAVACH" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain' }} />
              <div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 800, color: '#fff' }}>KAVACH</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>{t('footer.tagline', 'THE POLICY THAT RIDES WITH YOU')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              {[t('footer.privacy', 'Privacy Policy'), t('footer.terms', 'Terms of Service'), t('footer.contact', 'Contact Us')].map((link) => (
                <span key={link} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.7)'}
                >{link}</span>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t('footer.copyright', "© 2026 KAVACH Insurance. All rights reserved. | Powered by AI for India's delivery heroes ⚡")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
