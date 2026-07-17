import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import changelogRaw from '../../CHANGELOG.md?raw';
import { TopNav } from '../components/TopNav';
import { Button } from '../components/ui/Button';
import { AboutModal } from '../components/AboutModal';

export const Changelog: React.FC = () => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const itemsPerPage = 10;

  const releases = useMemo(() => {
    // Split by `## ` at the start of a line
    const chunks = changelogRaw.split(/(?=^##\s+)/m);
    // Filter out the main title or empty chunks
    return chunks.filter(chunk => chunk.trim().startsWith('##'));
  }, []);

  const totalPages = Math.ceil(releases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentReleases = releases.slice(startIndex, startIndex + itemsPerPage);

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  };

  return (
    <>
      <TopNav onOpenAbout={() => setIsAboutOpen(true)} />
      
      <main className="flex-1 overflow-y-auto p-6 md:p-12 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-8 text-gray-900 tracking-tight">{t('changelog.title')}</h1>
          
          <div className="space-y-12">
            {currentReleases.map((release, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 prose prose-slate max-w-none hover:shadow-md transition-shadow">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {release}
                </ReactMarkdown>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={handlePrevious} 
              disabled={currentPage === 1}
            >
              &larr; {t('changelog.previous')}
            </Button>
            <span className="text-sm font-medium text-gray-500">
              {currentPage} / {totalPages}
            </span>
            <Button 
              variant="outline" 
              onClick={handleNext} 
              disabled={currentPage === totalPages}
            >
              {t('changelog.next')} &rarr;
            </Button>
          </div>
          {currentPage === totalPages && (
            <p className="text-center text-sm text-gray-400 mt-8">
              {t('changelog.noMoreReleases')}
            </p>
          )}
        </div>
      </main>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
};
