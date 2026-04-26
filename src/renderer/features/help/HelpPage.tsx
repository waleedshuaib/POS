import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Fuse from 'fuse.js';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { ARTICLES, getArticle, type HelpArticle } from './articles';

export function HelpPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ar' | 'en';
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const [q, setQ] = useState('');

  const current = slug ? getArticle(slug) ?? ARTICLES[0] : ARTICLES[0];

  const fuse = useMemo(
    () =>
      new Fuse(ARTICLES, {
        keys: lang === 'ar' ? ['titleAr', 'bodyAr'] : ['titleEn', 'bodyEn'],
        threshold: 0.35,
        includeMatches: true,
        minMatchCharLength: 2,
      }),
    [lang],
  );

  const results: HelpArticle[] = useMemo(() => {
    if (!q.trim()) return ARTICLES;
    return fuse.search(q).map((r) => r.item);
  }, [q, fuse]);

  const info = useQuery({
    queryKey: ['backup.info'],
    queryFn: () => api<{ dbPath: string; imagesDir: string; version: string; platform: string }>('backup.info', {}),
  });

  const diag = info.data
    ? `POS Diagnostics
Version: ${info.data.version}
Platform: ${info.data.platform}
Database: ${info.data.dbPath}
Images: ${info.data.imagesDir}
User agent: ${navigator.userAgent}
Language: ${i18n.language}`
    : '';

  return (
    <div>
      <PageHeader title={t('help.title')} />
      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-4 card p-3">
          <input
            className="input mb-3"
            placeholder={t('help.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <nav className="space-y-1 max-h-[60vh] overflow-auto">
            {results.length === 0 && <div className="text-sm text-slate-400 p-2">{t('help.noResults')}</div>}
            {results.map((a) => (
              <button
                key={a.slug}
                className={`w-full text-start rounded-md px-3 py-2 text-sm ${
                  a.slug === current.slug ? 'bg-brand-100 text-brand-800 font-semibold' : 'hover:bg-slate-100'
                }`}
                onClick={() => navigate(`/help/${a.slug}`)}
              >
                {lang === 'ar' ? a.titleAr : a.titleEn}
              </button>
            ))}
          </nav>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold mb-2">{t('help.diagnostics')}</h3>
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-medium">{t('help.version')}:</span> {info.data?.version ?? '-'}
              </div>
              <div className="truncate" title={info.data?.dbPath}>
                <span className="font-medium">{t('help.dbPath')}:</span> {info.data?.dbPath ?? '-'}
              </div>
            </div>
            <button
              className="btn-secondary w-full mt-2 text-xs"
              onClick={() => navigator.clipboard.writeText(diag)}
              disabled={!diag}
            >
              {t('help.copyDiagnostics')}
            </button>
          </div>
        </aside>

        <article className="col-span-8 card p-6 help-article">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {lang === 'ar' ? current.bodyAr : current.bodyEn}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
