import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { languages, translations } from '../translations';

const LanguageContext = createContext(null);
const LANGUAGE_STORAGE_KEY = 'kavach-language';

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en');

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    languages,
    t: (key, fallback = key) => translations[lang]?.[key] || translations.en?.[key] || fallback,
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
