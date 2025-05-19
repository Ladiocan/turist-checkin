import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import translationRO from './locales/ro/translation.json';
import translationEN from './locales/en/translation.json';
import translationDE from './locales/de/translation.json';
import translationHU from './locales/hu/translation.json';
import translationPL from './locales/pl/translation.json';

// the translations
const resources = {
  ro: {
    translation: translationRO
  },
  en: {
    translation: translationEN
  },
  de: {
    translation: translationDE
  },
  hu: {
    translation: translationHU
  },
  pl: {
    translation: translationPL
  }
};

i18n
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next
  .use(initReactI18next)
  // init i18next
  .init({
    resources,
    fallbackLng: 'ro',
    lng: 'ro', // Setează limba română ca limbă implicită
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    
    // detection options
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      // Salvează limba selectată în localStorage
      storeLocalStorage: true
    }
  });

export default i18n;
