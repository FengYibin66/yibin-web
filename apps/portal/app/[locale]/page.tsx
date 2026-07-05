import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { locales } from '@/i18n.config';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

function HomeContent() {
  const t = useTranslations();

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-6">
          <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            {t('hero.title')}
          </h1>
          <p className="text-xl sm:text-2xl text-slate-300">
            {t('hero.subtitle')}
          </p>
          <button className="mt-8 px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold transition-colors">
            {t('hero.cta')}
          </button>
        </div>
      </section>

      {/* Projects Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-center">{t('projects.title')}</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Resume Project Card */}
          <div className="p-6 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-500 transition-colors">
            <h3 className="text-2xl font-bold mb-3 text-cyan-400">
              {t('projects.resume.name')}
            </h3>
            <p className="text-slate-300 mb-4">
              {t('projects.resume.description')}
            </p>
            <Link
              href="https://resume.yibinfeng.com"
              target="_blank"
              className="inline-block px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
            >
              Visit →
            </Link>
          </div>

          {/* WeChat Project Card */}
          <div className="p-6 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-500 transition-colors">
            <h3 className="text-2xl font-bold mb-3 text-cyan-400">
              {t('projects.wechat.name')}
            </h3>
            <p className="text-slate-300 mb-4">
              {t('projects.wechat.description')}
            </p>
            <Link
              href="https://yibinfeng.com"
              target="_blank"
              className="inline-block px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
            >
              Visit →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-8 px-4 sm:px-6 lg:px-8 text-center text-slate-400">
        <p>{t('footer.copyright')}</p>
      </footer>
    </main>
  );
}

export default HomeContent;
