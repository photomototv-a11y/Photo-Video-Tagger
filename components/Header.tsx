import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckIcon } from './icons/CheckIcon';
import QuotaDisplay from './QuotaDisplay';

interface HeaderProps {
  totalImages: number;
  processingImagesCount: number;
  tokensUsed: number;
  quotaLimit: number;
}

const Header: React.FC<HeaderProps> = ({ totalImages, processingImagesCount, tokensUsed, quotaLimit }) => {
  return (
    <header className="bg-dark-card shadow-md">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-brand-blue to-brand-purple text-transparent bg-clip-text">
            Nano Banana Stock Photo Tagger
            </h1>
            <div className="mt-2 text-lg text-medium-text flex flex-col sm:flex-row justify-center items-center gap-3">
            <p>
                Generate professional stock photo metadata in seconds with AI.
            </p>
            {totalImages > 0 && (
                <div className="flex flex-wrap justify-center items-center gap-3" role="status" aria-live="polite">
                    <span className="text-gray-600 hidden sm:inline" aria-hidden="true">•</span>
                    
                    <div className="font-semibold text-light-text bg-dark-bg px-3 py-1 rounded-full text-base border border-dark-border">
                        Total: {totalImages}
                    </div>

                    {processingImagesCount > 0 ? (
                    <div className="flex items-center gap-2 font-semibold text-brand-purple bg-purple-900/50 px-3 py-1 rounded-full text-base border border-brand-purple/50">
                        <SpinnerIcon className="w-4 h-4" />
                        <span>Processing: {processingImagesCount}</span>
                    </div>
                    ) : (
                    <div className="flex items-center gap-2 font-semibold text-green-400 bg-green-900/20 px-3 py-1 rounded-full text-base border border-green-900/50">
                        <CheckIcon className="w-4 h-4" />
                        <span>All Complete</span>
                    </div>
                    )}
                </div>
            )}
            </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <QuotaDisplay tokensUsed={tokensUsed} quotaLimit={quotaLimit} />
        </div>
      </div>
    </header>
  );
};

export default Header;