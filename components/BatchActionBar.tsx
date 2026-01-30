import React, { useState } from 'react';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TagIcon } from './icons/TagIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XCircleIcon } from './icons/XCircleIcon';

export type BatchAction = 
  | { type: 'replaceTitle'; value: string }
  | { type: 'addKeywords'; value: string };

interface BatchActionBarProps {
  selectedCount: number;
  onApply: (action: BatchAction) => void;
  onClearSelection: () => void;
}

const BatchActionBar: React.FC<BatchActionBarProps> = ({ selectedCount, onApply, onClearSelection }) => {
    const [title, setTitle] = useState('');
    const [keywords, setKeywords] = useState('');

    const handleApply = (action: BatchAction) => {
        onApply(action);
        switch(action.type) {
            case 'replaceTitle': setTitle(''); break;
            case 'addKeywords': setKeywords(''); break;
        }
    };

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-5xl z-40 px-4 pointer-events-none">
            <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl p-4 flex flex-col lg:flex-row items-center gap-4 animate-fade-in-up pointer-events-auto">
                <div className="flex-shrink-0 text-center lg:text-left">
                    <p className="font-bold text-light-text">{selectedCount} item{selectedCount > 1 ? 's' : ''} selected</p>
                    <button onClick={onClearSelection} className="text-sm text-brand-blue hover:text-indigo-400 font-semibold flex items-center gap-1 mx-auto lg:mx-0">
                        <XCircleIcon className="w-4 h-4" />
                        Clear Selection
                    </button>
                </div>
                
                <div className="w-full h-px lg:w-px lg:h-12 bg-dark-border"></div>

                <div className="w-full flex-grow flex flex-col md:flex-row items-center gap-4">
                    <div className="w-full flex-grow flex items-center gap-2">
                        <label htmlFor="batch-keywords" className="sr-only">Add Keywords</label>
                        <TagIcon className="w-5 h-5 text-medium-text flex-shrink-0" title="Keywords" />
                        <input
                            id="batch-keywords"
                            type="text"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="Add keywords (comma-separated)..."
                            className="w-full p-2 bg-dark-bg border border-dark-border rounded-md text-sm focus:ring-2 focus:ring-brand-blue"
                        />
                        <button 
                            onClick={() => handleApply({ type: 'addKeywords', value: keywords })} 
                            disabled={!keywords.trim()}
                            className="p-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-md text-white flex-shrink-0"
                            title="Add Keywords"
                        >
                            <PlusIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="w-full flex-grow flex items-center gap-2">
                         <label htmlFor="batch-title" className="sr-only">Replace Title</label>
                         <PencilSquareIcon className="w-5 h-5 text-medium-text flex-shrink-0" title="Title" />
                        <input
                            id="batch-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Replace title..."
                            className="w-full p-2 bg-dark-bg border border-dark-border rounded-md text-sm focus:ring-2 focus:ring-brand-blue"
                        />
                         <button 
                            onClick={() => handleApply({ type: 'replaceTitle', value: title })} 
                            disabled={!title.trim()}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-md text-white text-sm font-semibold flex-shrink-0"
                            title="Replace Title"
                        >
                            Replace
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchActionBar;
