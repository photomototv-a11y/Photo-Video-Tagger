import React, { useState } from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTranslating: boolean;
  originalText: string;
  translatedText: string | null;
  error: string | null;
  fieldName: string;
}

const TranslationModal: React.FC<TranslationModalProps> = ({ isOpen, onClose, isTranslating, originalText, translatedText, error, fieldName }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border rounded-xl shadow-2xl max-w-2xl w-full transform transition-all duration-300 scale-100 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-light-text">
            Translate {fieldName}
          </h2>
          <button onClick={onClose} className="p-1 text-medium-text hover:text-light-text" aria-label="Close modal">
             <XCircleIcon className="w-8 h-8"/>
          </button>
        </div>
        
        {isTranslating ? (
          <div className="flex flex-col items-center justify-center h-48">
            <SpinnerIcon className="w-12 h-12 text-brand-purple" />
            <p className="mt-4 text-medium-text">Translating to Russian...</p>
          </div>
        ) : error ? (
            <div className="text-center h-48 flex items-center justify-center text-red-400 bg-red-900/50 p-4 rounded-lg">
                <p>{error}</p>
            </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-medium-text mb-2">Original (English)</h3>
              <p className="no-scrollbar p-3 bg-gray-900 rounded-md text-sm text-light-text max-h-28 overflow-auto">
                {originalText}
              </p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-medium-text">Translation (Russian)</h3>
                {translatedText && (
                  <button onClick={handleCopy} className="flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md">
                    {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <p className="no-scrollbar p-3 bg-gray-900 rounded-md text-sm text-light-text max-h-28 overflow-auto font-mono">
                {translatedText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationModal;