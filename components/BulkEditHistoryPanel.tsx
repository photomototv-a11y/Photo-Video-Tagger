import React from 'react';
import type { BulkEditRecord, BulkEditSummary } from '../types';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { CheckIcon } from './icons/CheckIcon';

interface BulkEditHistoryPanelProps {
  history: BulkEditRecord[];
  onUndo: (recordId: string) => void;
  onDismiss: (recordId: string) => void;
}

const generateSummaryText = (summary: BulkEditSummary): string => {
  const parts: string[] = [];
  if (summary.title) {
    parts.push(`'${summary.title.action}' title`);
  }
  if (summary.description) {
    parts.push(`'${summary.description.action}' description`);
  }
  if (summary.keywords) {
    parts.push(`'${summary.keywords.action}' keywords`);
  }
  
  if (parts.length === 0) return `Updated ${summary.itemCount} item${summary.itemCount !== 1 ? 's' : ''}`;

  let fieldsText;
  if (parts.length === 1) {
    fieldsText = parts[0];
  } else if (parts.length === 2) {
    fieldsText = parts.join(' and ');
  } else {
    fieldsText = `${parts.slice(0, -1).join(', ')}, and ${parts.slice(-1)}`;
  }

  const capitalizedFields = fieldsText.charAt(0).toUpperCase() + fieldsText.slice(1);

  return `${capitalizedFields} on ${summary.itemCount} item${summary.itemCount !== 1 ? 's' : ''}.`;
};

const BulkEditHistoryPanel: React.FC<BulkEditHistoryPanelProps> = ({ history, onUndo, onDismiss }) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {history.map(record => (
        <div 
          key={record.id} 
          className="bg-green-900/60 border border-green-700/80 text-green-200 text-sm px-4 py-3 rounded-lg flex justify-between items-center animate-fade-in-up"
        >
          <div className="flex items-center gap-3">
            <CheckIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span className="font-semibold">{generateSummaryText(record.summary)}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button 
              onClick={() => onUndo(record.id)} 
              className="flex items-center gap-1.5 text-green-100 hover:text-white font-bold bg-green-800/50 hover:bg-green-700/50 px-3 py-1 rounded-md transition-colors"
              aria-label={`Undo action: ${generateSummaryText(record.summary)}`}
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              Undo
            </button>
            <button 
                onClick={() => onDismiss(record.id)} 
                className="p-1.5 text-green-300/70 hover:text-white hover:bg-green-800/50 rounded-full transition-colors"
                title="Dismiss"
                aria-label="Dismiss notification"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BulkEditHistoryPanel;
