import React from 'react';
import type { BulkEditSummary, KeywordAnalysis, BulkKeywordAction, BulkTextAction } from '../types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  summary: BulkEditSummary;
}

const getActionDescription = (label: string, action: BulkKeywordAction | BulkTextAction): string => {
  const field = label.toLowerCase();
  switch (action) {
    case 'replace': return `Replace ${field} with:`;
    case 'append':  return `Append to ${field}:`;
    case 'prepend': return `Prepend to ${field}:`;
    case 'add':     return 'Add keywords:';
    case 'remove':  return 'Remove keywords:';
    default:        return 'Apply change:';
  }
};

const FieldSummary: React.FC<{ label: string; action: BulkKeywordAction | BulkTextAction; value: string; }> = ({ label, action, value }) => (
  <div className="border-t border-dark-border pt-4 mt-4">
    <p className="font-bold text-light-text text-lg capitalize">
      {getActionDescription(label, action)}
    </p>
    <p className="no-scrollbar mt-2 p-2 bg-gray-900 rounded-md text-sm text-light-text font-mono break-words max-h-24 overflow-auto">
      {value}
    </p>
  </div>
);

const KeywordTag: React.FC<{ keyword: string; count?: number; color: 'blue' | 'green' | 'red' | 'gray' }> = ({ keyword, count, color }) => {
  const colors = {
    blue: 'bg-blue-900/50 text-blue-300',
    green: 'bg-green-900/50 text-green-300',
    red: 'bg-red-900/50 text-red-300',
    gray: 'bg-gray-700/80 text-gray-300'
  };
  const countColors = {
    blue: 'bg-blue-700 text-blue-100',
    green: 'bg-green-700 text-green-100',
    red: 'bg-red-700 text-red-100',
    gray: 'bg-gray-600 text-gray-200'
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors duration-200 ${colors[color]}`}>
      <span>{keyword}</span>
      {count && (
        <span className={`ml-1 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${countColors[color]}`}>
          {count}
        </span>
      )}
    </div>
  );
};

const KeywordAnalysisView: React.FC<{ analysis: KeywordAnalysis }> = ({ analysis }) => {
  const { action, duplicates, foundToRemove, notFound, commonAdded, commonRemoved, commonKept } = analysis;

  const hasAnalysisData = 
    (duplicates && duplicates.length > 0) ||
    (foundToRemove && foundToRemove.length > 0) ||
    (notFound && notFound.length > 0) ||
    (commonAdded && commonAdded.length > 0) ||
    (commonRemoved && commonRemoved.length > 0) ||
    (commonKept && commonKept.length > 0);
  
  if (!hasAnalysisData) {
    return null;
  }

  return (
    <div className="border-t border-dark-border pt-4 mt-4">
      <p className="font-bold text-light-text text-lg">Keyword Analysis</p>
      <div className="mt-2 p-3 bg-gray-900 rounded-md space-y-3">
        {action === 'add' && duplicates && duplicates.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-medium-text mb-2">Duplicate Keywords</h4>
            <p className="text-xs text-gray-400 mb-2">These keywords already exist in some images and will not be added again:</p>
            <div className="flex flex-wrap gap-2">
              {duplicates.map(({ keyword, count }) => (
                <KeywordTag key={keyword} keyword={keyword} count={count} color="red" />
              ))}
            </div>
          </div>
        )}
        {action === 'remove' && (
          <>
            {foundToRemove && foundToRemove.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-medium-text mb-2">Keywords to Remove</h4>
                <p className="text-xs text-gray-400 mb-2">These keywords will be removed from images where they are found:</p>
                <div className="flex flex-wrap gap-2">
                  {foundToRemove.map(({ keyword, count }) => (
                    <KeywordTag key={keyword} keyword={keyword} count={count} color="red" />
                  ))}
                </div>
              </div>
            )}
            {notFound && notFound.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-medium-text mb-2">Keywords Not Found</h4>
                <p className="text-xs text-gray-400 mb-2">These keywords were not found in any selected image:</p>
                <div className="flex flex-wrap gap-2">
                  {notFound.map(keyword => (
                    <KeywordTag key={keyword} keyword={keyword} color="gray" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {action === 'replace' && (
          <div className="space-y-3">
             <p className="text-xs text-gray-400">This analysis compares your new keywords against all keywords present in the selected images.</p>
            {commonKept && commonKept.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-400 mb-2">Kept Keywords ({commonKept.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {commonKept.map(keyword => <KeywordTag key={keyword} keyword={keyword} color="green" />)}
                </div>
              </div>
            )}
            {commonRemoved && commonRemoved.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-400 mb-2">Removed Keywords ({commonRemoved.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {commonRemoved.map(keyword => <KeywordTag key={keyword} keyword={keyword} color="red" />)}
                </div>
              </div>
            )}
            {commonAdded && commonAdded.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-2">Newly Added Keywords ({commonAdded.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {commonAdded.map(keyword => <KeywordTag key={keyword} keyword={keyword} color="blue" />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


const BulkEditConfirmationModal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, summary }) => {
  if (!isOpen) return null;

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
        <h2 className="text-3xl font-bold text-light-text">Confirm Bulk Edit</h2>
        <p className="mt-2 text-medium-text">
          You are about to apply changes to <span className="font-bold text-brand-blue">{summary.itemCount}</span> item{summary.itemCount !== 1 ? 's' : ''}. Please review carefully.
        </p>

        <div className="no-scrollbar mt-6 max-h-[50vh] overflow-y-auto pr-4 -mr-4">
          {summary.title && <FieldSummary label="Title" action={summary.title.action} value={summary.title.value} />}
          {summary.description && <FieldSummary label="Description" action={summary.description.action} value={summary.description.value} />}
          {summary.keywords && (
            <>
              <FieldSummary label="Keywords" action={summary.keywords.action} value={summary.keywords.value} />
              <KeywordAnalysisView analysis={summary.keywords.analysis} />
            </>
          )}
        </div>
        
        <div className="mt-8 flex justify-end items-center gap-4">
          <button
            onClick={onClose}
            className="py-2 px-6 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="py-2 px-6 bg-brand-blue hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditConfirmationModal;