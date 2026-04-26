import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar/common.json';
import en from './locales/en/common.json';

const savedLang = (typeof localStorage !== 'undefined' && localStorage.getItem('pos.lang')) || 'ar';

i18n.use(initReactI18next).init({
  resources: {
    ar: { common: ar },
    en: { common: en },
  },
  lng: savedLang,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyDir(lng: string) {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('lang', lng);
  document.documentElement.setAttribute('dir', dir);
}

applyDir(i18n.language);
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('pos.lang', lng);
  applyDir(lng);
});

export default i18n;
