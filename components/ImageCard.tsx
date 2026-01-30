
import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { ImageFile, MetadataHistoryState } from '../types';
import { ProcessingState } from '../types';
import { useToast } from '../contexts/ToastContext';
import { translateText, getFriendlyErrorMessage } from '../services/geminiService';
import TranslationModal from './TranslationModal';
import useAutosizeTextArea from '../hooks/useAutosizeTextArea';

import { SpinnerIcon } from './icons/SpinnerIcon';
import { RetryIcon } from './icons/RetryIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { ArrowUturnRightIcon } from './icons/ArrowUturnRightIcon';
import { GlobeAltIcon } from './icons/GlobeAltIcon';
import { NewspaperIcon } from './icons/NewspaperIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface ImageCardProps {
  imageFile: ImageFile;
  isSelected: boolean;
  onSelect: (fileId: string) => void;
  onTitleChange: (fileId: string, newTitle: string) => void;
  onDescriptionChange: (fileId:string, newDescription: string) => void;
  onKeywordsChange: (fileId: string, newKeywords: string) => void;
  onAltTextChange: (fileId: string, newAltText: string) => void;
  onUndo: (fileId: string) => void;
  onRedo: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onGenerateTitle: (fileId: string, manualContext?: string) => void;
  onGenerateDescription: (fileId: string, manualContext?: string) => void;
  onGenerateAltText: (fileId: string) => void;
  onGenerateKeywords: (fileId: string) => void;
  onAnalyzeImage: (fileId: string) => void;
  onTokensUsed: (tokens: number) => void;
  onEditorialUpdate: (fileId: string, updates: Partial<MetadataHistoryState>) => void;
}

const getCounterColorClass = (length: number, limit: number): string => {
  if (length > limit) return 'text-red-400';
  return 'text-green-400';
};

const ActionButton: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
  className?: string;
}> = ({ onClick, disabled, children, title, className = "" }) => (
    <button 
        onClick={onClick} 
        disabled={disabled} 
        title={title}
        className={`p-1.5 bg-gray-600 hover:bg-gray-500 rounded-md disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors ${className}`}
    >
        {children}
    </button>
);

const SuggestionChip: React.FC<{
    keyword: string;
    isAdded: boolean;
    onSelect: (keyword: string) => void;
}> = ({ keyword, isAdded, onSelect }) => (
    <button
        onClick={() => onSelect(keyword)}
        disabled={isAdded}
        className={`flex items-center text-xs px-2.5 py-1 rounded-full transition-colors duration-200 ${
            isAdded ? 'bg-green-900 text-gray-400 cursor-default' : 'bg-gray-700 text-light-text hover:bg-gray-600'
        }`}
    >
        {isAdded ? <CheckIcon className="w-3 h-3" /> : '+'}
        <span className="ml-1.5">{keyword}</span>
    </button>
);

const createEditorialPrefix = (data: { city: string; region: string; date: string; fact: string }): string => {
  const { city, region, date, fact } = data;
  if (!city && !region && !date && !fact) return '';
  const cityPart = city ? city.toUpperCase() : '';
  const regionPart = region ? region.toUpperCase() : '';
  const locationPart = [cityPart, regionPart].filter(Boolean).join(', ');
  let datePart = '';
  if (date) {
    const d = new Date(date + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      datePart = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    }
  }
  const prefixParts = [locationPart, datePart].filter(Boolean);
  let prefix = prefixParts.join(' ― ');
  if (fact) {
    prefix += `${prefix ? ': ' : ''}${fact}`;
  }
  return prefix;
};

const ImageCard: React.FC<ImageCardProps> = ({
  imageFile,
  isSelected,
  onSelect,
  onTitleChange,
  onDescriptionChange,
  onKeywordsChange,
  onAltTextChange,
  onUndo,
  onRedo,
  onRetry,
  onGenerateTitle,
  onGenerateDescription,
  onGenerateAltText,
  onGenerateKeywords,
  onAnalyzeImage,
  onTokensUsed,
  onEditorialUpdate,
}) => {
  const { addToast } = useToast();
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [translationData, setTranslationData] = useState<any>({});
  const [isHovered, setIsHovered] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const altTextRef = useRef<HTMLTextAreaElement>(null);
  const keywordsRef = useRef<HTMLTextAreaElement>(null);
  const editorialFactRef = useRef<HTMLTextAreaElement>(null);

  useAutosizeTextArea(titleRef, imageFile.editedTitle);
  useAutosizeTextArea(descriptionRef, imageFile.editedDescription);
  useAutosizeTextArea(altTextRef, imageFile.editedAltText);
  useAutosizeTextArea(keywordsRef, imageFile.editedKeywords);
  useAutosizeTextArea(editorialFactRef, imageFile.editedEditorialFact);

  const handleCopy = (field: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    addToast(`${field} скопировано!`, 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleTranslate = async (fieldName: string, text: string) => {
    if (!text) return;
    setIsTranslationModalOpen(true);
    setTranslationData({ fieldName, originalText: text, isTranslating: true });
    try {
      const { translation, tokensUsed } = await translateText(text, 'Russian');
      onTokensUsed(tokensUsed);
      setTranslationData((p: any) => ({ ...p, translatedText: translation, isTranslating: false }));
    } catch (e) {
      setTranslationData((p: any) => ({ ...p, error: getFriendlyErrorMessage(e), isTranslating: false }));
    }
  };

  const handleEditorialChange = useCallback((updates: Partial<MetadataHistoryState>) => {
    const oldPrefix = createEditorialPrefix({ city: imageFile.editedEditorialCity, region: imageFile.editedEditorialRegion, date: imageFile.editedEditorialDate, fact: imageFile.editedEditorialFact });
    const newPrefixData = { 
        city: updates.hasOwnProperty('editedEditorialCity') ? updates.editedEditorialCity as string : imageFile.editedEditorialCity, 
        region: updates.hasOwnProperty('editedEditorialRegion') ? updates.editedEditorialRegion as string : imageFile.editedEditorialRegion, 
        date: updates.hasOwnProperty('editedEditorialDate') ? updates.editedEditorialDate as string : imageFile.editedEditorialDate, 
        fact: updates.hasOwnProperty('editedEditorialFact') ? updates.editedEditorialFact as string : imageFile.editedEditorialFact 
    };
    const newPrefix = createEditorialPrefix(newPrefixData);
    let baseDescription = imageFile.editedDescription;
    if (oldPrefix.length > 0 && baseDescription.startsWith(oldPrefix)) {
      baseDescription = baseDescription.substring(oldPrefix.length).trim();
    }
    const newDescription = newPrefix ? `${newPrefix}${baseDescription ? ` ${baseDescription}` : ''}` : baseDescription;
    onEditorialUpdate(imageFile.id, { ...updates, editedDescription: newDescription });
  }, [imageFile, onEditorialUpdate]);

  const handleToggleEditorial = (isEditorial: boolean) => {
    let keywords = imageFile.editedKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const editorialIndex = keywords.findIndex(k => k.toLowerCase() === 'editorial');
    
    if (isEditorial) {
      if (editorialIndex === -1) {
        // Automatically prepend 'editorial' to the keywords if it's not already present
        keywords = ['editorial', ...keywords];
      }
      onEditorialUpdate(imageFile.id, { 
        editedIsEditorial: true, 
        editedKeywords: keywords.join(', ') 
      });
    } else {
      if (editorialIndex !== -1) {
        // When switched off, remove 'editorial' from the keywords
        keywords.splice(editorialIndex, 1);
      }
      
      // When turning off, also strip editorial prefix from description and clear metadata fields
      const prefix = createEditorialPrefix({ 
        city: imageFile.editedEditorialCity, 
        region: imageFile.editedEditorialRegion, 
        date: imageFile.editedEditorialDate, 
        fact: imageFile.editedEditorialFact 
      });
      
      let baseDescription = imageFile.editedDescription;
      if (prefix && baseDescription.startsWith(prefix)) {
        baseDescription = baseDescription.substring(prefix.length).trim();
      }

      onEditorialUpdate(imageFile.id, { 
        editedIsEditorial: false, 
        editedKeywords: keywords.join(', '),
        editedDescription: baseDescription,
        editedEditorialCity: '',
        editedEditorialRegion: '',
        editedEditorialDate: '',
        editedEditorialFact: ''
      });
    }
  };

  const currentKeywordsSet = useMemo(() => new Set(imageFile.editedKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)), [imageFile.editedKeywords]);

  const handleSuggestionSelect = (keyword: string) => {
    const lowerKeyword = keyword.toLowerCase().trim();
    if (currentKeywordsSet.has(lowerKeyword)) return;
    const newKeywords = Array.from(new Set([...Array.from(currentKeywordsSet), lowerKeyword])).sort().join(', ');
    onKeywordsChange(imageFile.id, newKeywords);
  };

  return (
    <div 
        className={`bg-dark-card border rounded-lg shadow-xl flex flex-col md:flex-row gap-6 p-6 relative transition-all duration-300 ${isSelected ? 'border-brand-blue ring-2 ring-brand-blue' : 'border-dark-border'} ${imageFile.editedIsEditorial ? 'bg-indigo-900/10' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
    >
      {imageFile.state === ProcessingState.PROCESSING && (
        <div className="absolute inset-0 bg-dark-card/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
            <SpinnerIcon className="w-12 h-12 text-brand-purple" />
            <p className="mt-4 text-lg font-semibold">Processing Media...</p>
        </div>
      )}
      
      {imageFile.state === ProcessingState.ERROR && (
        <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10 p-4 text-center">
            <h4 className="text-xl font-bold text-red-100">Processing Failed</h4>
            <p className="mt-2 text-sm text-red-100/80 mb-4">{imageFile.error}</p>
            <button onClick={() => onRetry(imageFile.id)} className="flex items-center gap-2 bg-dark-card px-6 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors">
                <RetryIcon className="w-5 h-5"/> Retry
            </button>
        </div>
      )}

      <div className="w-full md:w-1/3 flex-shrink-0 relative">
        <div className="overflow-hidden rounded-lg bg-black aspect-square flex items-center justify-center border border-dark-border">
            {imageFile.mediaType === 'video' ? (
                <video src={imageFile.previewUrl} className="w-full h-full object-contain" autoPlay={isHovered} muted loop playsInline />
            ) : (
                <img src={imageFile.previewUrl} className="w-full h-full object-cover" />
            )}
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(imageFile.id)} className="h-6 w-6 rounded text-brand-blue bg-dark-bg border-dark-border focus:ring-brand-blue" />
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${imageFile.mediaType === 'video' ? 'bg-orange-600' : 'bg-brand-blue'}`}>
                {imageFile.mediaType}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-light-text truncate max-w-[70%]" title={imageFile.file.name}>{imageFile.file.name}</h3>
            <div className="flex items-center gap-2">
                <button onClick={() => onUndo(imageFile.id)} disabled={imageFile.historyIndex <= 0} className="p-1.5 text-medium-text hover:text-light-text disabled:opacity-30"><ArrowUturnLeftIcon className="w-5 h-5" /></button>
                <button onClick={() => onRedo(imageFile.id)} disabled={imageFile.historyIndex >= imageFile.history.length - 1} className="p-1.5 text-medium-text hover:text-light-text disabled:opacity-30"><ArrowUturnRightIcon className="w-5 h-5" /></button>
            </div>
        </div>

        <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg border border-dark-border shadow-inner">
            <label className="flex items-center cursor-pointer text-sm font-bold text-light-text select-none">
                <NewspaperIcon className="w-5 h-5 mr-2 text-brand-blue" />
                Editorial Metadata
            </label>
            <input type="checkbox" className="h-5 w-5 rounded border-dark-border text-brand-blue focus:ring-brand-blue bg-dark-bg" checked={imageFile.editedIsEditorial} onChange={(e) => handleToggleEditorial(e.target.checked)} />
        </div>

        {imageFile.editedIsEditorial && (
            <div className="p-4 bg-brand-blue/10 border border-brand-blue/30 rounded-lg space-y-4 border-l-4 border-l-brand-blue animate-fade-in-up">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-medium-text mb-1 uppercase">City</label>
                        <input type="text" value={imageFile.editedEditorialCity} onChange={(e) => handleEditorialChange({ editedEditorialCity: e.target.value })} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-xs focus:ring-1 focus:ring-brand-blue" placeholder="NEW YORK"/>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-medium-text mb-1 uppercase">Region/Country</label>
                        <input type="text" value={imageFile.editedEditorialRegion} onChange={(e) => handleEditorialChange({ editedEditorialRegion: e.target.value })} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-xs focus:ring-1 focus:ring-brand-blue" placeholder="USA"/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-medium-text mb-1 uppercase">Date</label>
                        <input type="date" value={imageFile.editedEditorialDate} onChange={(e) => handleEditorialChange({ editedEditorialDate: e.target.value })} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-xs focus:ring-1 focus:ring-brand-blue"/>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-medium-text mb-1 uppercase">Fact Description</label>
                        <textarea ref={editorialFactRef} value={imageFile.editedEditorialFact} onChange={(e) => handleEditorialChange({ editedEditorialFact: e.target.value })} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-xs resize-none focus:ring-1 focus:ring-brand-blue" placeholder="Neutral event description..."/>
                    </div>
                </div>
            </div>
        )}

        {imageFile.state === ProcessingState.SUCCESS && (
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-medium-text">Title</label>
                        <div className="flex items-center gap-2">
                            <ActionButton onClick={() => onGenerateTitle(imageFile.id)} disabled={imageFile.isGeneratingTitle} title="Regenerate Title">{imageFile.isGeneratingTitle ? <SpinnerIcon className="w-4 h-4"/> : <SparklesIcon className="w-4 h-4 text-brand-purple"/>}</ActionButton>
                            <ActionButton onClick={() => handleTranslate('Title', imageFile.editedTitle)} title="Translate"><GlobeAltIcon className="w-4 h-4"/></ActionButton>
                            <ActionButton onClick={() => handleCopy('Title', imageFile.editedTitle)} title="Copy">{copiedField === 'Title' ? <CheckIcon className="w-4 h-4 text-green-400"/> : <ClipboardIcon className="w-4 h-4"/>}</ActionButton>
                            <span className={`text-[10px] font-mono font-bold ml-2 ${getCounterColorClass(imageFile.editedTitle.length, 200)}`}>{imageFile.editedTitle.length}/200</span>
                        </div>
                    </div>
                    <textarea ref={titleRef} value={imageFile.editedTitle} onChange={(e) => onTitleChange(imageFile.id, e.target.value)} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-sm resize-none focus:ring-1 focus:ring-brand-blue shadow-inner" />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-medium-text">Description</label>
                        <div className="flex items-center gap-2">
                            <ActionButton onClick={() => onGenerateDescription(imageFile.id)} disabled={imageFile.isGeneratingDescription} title="Regenerate Description">{imageFile.isGeneratingDescription ? <SpinnerIcon className="w-4 h-4"/> : <SparklesIcon className="w-4 h-4 text-brand-purple"/>}</ActionButton>
                            <ActionButton onClick={() => handleTranslate('Description', imageFile.editedDescription)} title="Translate"><GlobeAltIcon className="w-4 h-4"/></ActionButton>
                            <ActionButton onClick={() => handleCopy('Description', imageFile.editedDescription)} title="Copy">{copiedField === 'Description' ? <CheckIcon className="w-4 h-4 text-green-400"/> : <ClipboardIcon className="w-4 h-4"/>}</ActionButton>
                            <span className={`text-[10px] font-mono font-bold ml-2 ${getCounterColorClass(imageFile.editedDescription.length, 200)}`}>{imageFile.editedDescription.length}/200</span>
                        </div>
                    </div>
                    <textarea ref={descriptionRef} value={imageFile.editedDescription} onChange={(e) => onDescriptionChange(imageFile.id, e.target.value)} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-sm resize-none focus:ring-1 focus:ring-brand-blue shadow-inner" />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-medium-text">Alt Text (Accessibility)</label>
                        <div className="flex items-center gap-2">
                            <ActionButton onClick={() => onGenerateAltText(imageFile.id)} disabled={imageFile.isGeneratingAltText} title="Generate Alt Text">{imageFile.isGeneratingAltText ? <SpinnerIcon className="w-4 h-4"/> : <SparklesIcon className="w-4 h-4 text-brand-purple"/>}</ActionButton>
                            <ActionButton onClick={() => handleCopy('AltText', imageFile.editedAltText)} title="Copy">{copiedField === 'AltText' ? <CheckIcon className="w-4 h-4 text-green-400"/> : <ClipboardIcon className="w-4 h-4"/>}</ActionButton>
                            <span className={`text-[10px] font-mono font-bold ml-2 ${getCounterColorClass(imageFile.editedAltText.length, 125)}`}>{imageFile.editedAltText.length}/125</span>
                        </div>
                    </div>
                    <textarea ref={altTextRef} value={imageFile.editedAltText} onChange={(e) => onAltTextChange(imageFile.id, e.target.value)} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-sm resize-none focus:ring-1 focus:ring-brand-blue shadow-inner" placeholder="Describe for screen readers..." />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-medium-text">Keywords</label>
                        <div className="flex items-center gap-2">
                            <ActionButton onClick={() => onGenerateKeywords(imageFile.id)} disabled={imageFile.isGeneratingKeywords} title="Regenerate Keywords">{imageFile.isGeneratingKeywords ? <SpinnerIcon className="w-4 h-4"/> : <SparklesIcon className="w-4 h-4 text-brand-purple"/>}</ActionButton>
                            <ActionButton onClick={() => handleTranslate('Keywords', imageFile.editedKeywords)} title="Translate"><GlobeAltIcon className="w-4 h-4"/></ActionButton>
                            <ActionButton onClick={() => handleCopy('Keywords', imageFile.editedKeywords)} title="Copy">{copiedField === 'Keywords' ? <CheckIcon className="w-4 h-4 text-green-400"/> : <ClipboardIcon className="w-4 h-4"/>}</ActionButton>
                            <span className={`text-[10px] font-mono font-bold ml-2 ${getCounterColorClass(currentKeywordsSet.size, 50)}`}>{currentKeywordsSet.size}/50</span>
                        </div>
                    </div>
                    <textarea ref={keywordsRef} value={imageFile.editedKeywords} onChange={(e) => onKeywordsChange(imageFile.id, e.target.value)} className="w-full p-2 bg-dark-bg border border-dark-border rounded text-sm resize-none focus:ring-1 focus:ring-brand-blue shadow-inner" />
                    
                    <div className="mt-4 space-y-3">
                        {!imageFile.analysis && !imageFile.isAnalyzing && (
                            <button onClick={() => onAnalyzeImage(imageFile.id)} className="text-xs bg-gray-700 hover:bg-gray-600 text-light-text font-bold py-2 px-4 rounded-full flex items-center gap-2 mx-auto transition-all shadow-md active:scale-95">
                                <SparklesIcon className="w-4 h-4 text-brand-purple" />
                                <span>Deep AI Content Analysis</span>
                            </button>
                        )}
                        {imageFile.isAnalyzing && <div className="flex flex-col items-center gap-2 py-2"><SpinnerIcon className="w-6 h-6 text-brand-purple" /><span className="text-[10px] text-medium-text">Extracting visual details...</span></div>}
                        {imageFile.analysis && (
                            <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-dark-bg/50 rounded-lg border border-dark-border shadow-inner custom-scrollbar">
                                {[{ label: 'Objects', list: imageFile.analysis.objects, color: 'text-blue-400' },
                                  { label: 'Concepts', list: imageFile.analysis.concepts, color: 'text-teal-400' },
                                  { label: 'Colors', list: imageFile.analysis.colors, color: 'text-purple-400' },
                                  { label: 'Style & Lighting', list: [...(imageFile.analysis.style || []), ...(imageFile.analysis.lighting || [])], color: 'text-orange-400' }
                                ].map(cat => cat.list && cat.list.length > 0 && (
                                    <div key={cat.label}>
                                        <p className={`text-[9px] font-bold ${cat.color} uppercase mb-1.5`}>{cat.label}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {cat.list.map(kw => <SuggestionChip key={kw} keyword={kw} isAdded={currentKeywordsSet.has(kw.toLowerCase())} onSelect={handleSuggestionSelect} />)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
      <TranslationModal isOpen={isTranslationModalOpen} onClose={() => setIsTranslationModalOpen(false)} {...translationData} />
    </div>
  );
};

export default ImageCard;
