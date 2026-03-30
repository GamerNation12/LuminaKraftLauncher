import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import language files
import en from '../locales/en/common.json';

const resources = {
  en: {
    common: en
  }
};

// Custom language detector (defaulting to English)
const customLanguageDetector = {
  name: 'customDetector',
  lookup() {
    return 'en';
  },
  cacheUserLanguage(lng: string) {
    localStorage.setItem('NebulaLauncher-language', 'en');
  }
};

i18n
  .use({
    type: 'languageDetector',
    async: false,
    init: () => {},
    detect: customLanguageDetector.lookup,
    cacheUserLanguage: customLanguageDetector.cacheUserLanguage
  })
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    
    detection: {
      order: ['customDetector'],
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false
    },

    react: {
      useSuspense: false
    }
  });

export default i18n; 
