import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSelector() {
  const { lang, setLang, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const globeIcon = '\u25CE';

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', zIndex: 9999 }}>
      <button
        onClick={() => setOpen((current) => !current)}
        style={{
          background: '#F5F7FA',
          border: '1px solid #E5E7EB',
          color: '#1A1A2E',
          padding: '6px 12px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>{globeIcon}</span>
        {languages[lang]?.nativeName || 'English'}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
          border: '1px solid #E5E7EB',
          padding: 10,
          zIndex: 9999,
          width: 'max-content',
          maxWidth: 360,
        }}>
          <div className="language-slider" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px' }}>
            {Object.entries(languages).map(([code, language]) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  onClick={() => {
                    setLang(code);
                    setOpen(false);
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    borderRadius: 20,
                    border: active ? '2px solid #0B3D91' : '1.5px solid #E5E7EB',
                    background: active ? '#EBF0FA' : '#fff',
                    color: active ? '#0B3D91' : '#5A6478',
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {language.nativeName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
