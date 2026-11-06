import bn from './bn.json';
import en from './en.json';

type Locale = 'bn' | 'en';
let currentLocale: Locale = 'bn';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = currentLocale === 'bn' ? bn : en;
  const fallbackDict = en;

  let text =
    (dict as Record<string, string>)[key] || (fallbackDict as Record<string, string>)[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}
