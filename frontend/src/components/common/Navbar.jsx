import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelector from './LanguageSelector';

export default function Navbar() {
  const { worker, logout, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { path: '/dashboard', label: t('nav.dashboard', 'Dashboard') },
    { path: '/policy', label: t('nav.policy', 'My Policy') },
    { path: '/claims', label: t('nav.claims', 'Claims') },
  ];

  if (isAdmin) {
    links.push({ path: '/admin', label: t('nav.admin', 'Admin') });
  }

  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid #E5E7EB',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 64,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      gap: 20,
    }}>
      <div
        onClick={() => navigate('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minWidth: 220 }}
      >
        <img
          src="/kavach-logo.jpg"
          alt="KAVACH Logo"
          style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain' }}
        />
        <div>
          <div style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: 18,
            fontWeight: 800,
            color: '#0B3D91',
            letterSpacing: '-0.3px',
            lineHeight: 1,
          }}>
            KAVACH
          </div>
          <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.5px', marginTop: 1 }}>
            {t('app.tagline', 'Income protection for delivery partners')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, height: '100%', flex: '1 1 auto', justifyContent: 'center' }}>
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              style={{
                background: 'transparent',
                color: isActive ? '#0B3D91' : '#5A6478',
                border: 'none',
                padding: '0 16px',
                borderRadius: 0,
                fontWeight: isActive ? 600 : 500,
                fontSize: 14,
                height: '100%',
                borderBottom: isActive ? '3px solid #0B3D91' : '3px solid transparent',
              }}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 250, justifyContent: 'flex-end' }}>
        <LanguageSelector />
        <div style={{ width: 1, height: 32, background: '#E5E7EB' }} />
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.2 }}>{worker?.name || 'Partner'}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'capitalize' }}>{worker?.city || 'City'}</div>
        </div>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0B3D91, #2E7DD6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Outfit, sans-serif',
        }}>
          {worker?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <button
          onClick={() => { logout(); navigate('/'); }}
          style={{
            background: '#F5F7FA',
            color: '#5A6478',
            border: '1px solid #E5E7EB',
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 8,
          }}
        >
          {t('common.logout', 'Logout')}
        </button>
      </div>
    </nav>
  );
}
