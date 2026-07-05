import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from '../i18n.config';

export default getRequestConfig(async ({ locale }) => {
  // Ensure that the incoming `locale` is valid
  if (!locales.includes(locale as any)) {
    return null;
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
