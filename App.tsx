
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import type { ImageFile, MetadataHistoryState } from './types';
import { ProcessingState } from './types';
import { generateMediaMetadata, generateTitle, generateDescription, generateKeywords, analyzeImageForKeywords, generateAltText, getFriendlyErrorMessage } from './services/geminiService';
import * as sessionService from './services/sessionService';
import * as quotaService from './services/quotaService';
import { useToast } from './contexts/ToastContext';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import ImageGrid from './components/ImageGrid';
import FilterControls from './components/FilterControls';
import SortControls from './components/SortControls';
import type { SortKey, SortDirection } from './components/SortControls';
import ToastContainer from './components/ToastContainer';
import { FolderDownloadIcon } from './components/icons/FolderDownloadIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { ClipboardIcon } from './components/icons/ClipboardIcon';
import { CheckIcon } from './components/icons/CheckIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import { SaveIcon } from './components/icons/SaveIcon';
import { FolderOpenIcon } from './components/icons/FolderOpenIcon';
import { HashtagIcon } from './components/icons/HashtagIcon';

function App() {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [isSessionSaved, setIsSessionSaved] = useState<boolean>(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<ProcessingState | 'all'>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const { addToast } = useToast();
  // Fixed: Cannot find namespace 'NodeJS'. Using ReturnType<typeof setTimeout> for browser environments.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize: Load usage and check for existing session
  useEffect(() => {
    const init = async () => {
      setTotalTokensUsed(quotaService.getTodaysTokenUsage());
      
      const exists = await sessionService.hasSession();
      setIsSessionSaved(exists);
      
      if (exists) {
        try {
          const files = await sessionService.loadSession();
          if (files.length > 0) {
            // Ensure compatibility with old sessions by providing default empty string for new fields
            const migratedFiles = files.map(f => ({ ...f, editedCategory: f.editedCategory || '' }));
            setImageFiles(migratedFiles);
            addToast("Session resumed automatically", "info");
          }
        } catch (e) {
          console.error("Failed to auto-resume session", e);
        }
      }
      setIsInitialLoad(false);
    };
    init();
  }, []);

  // Debounced Auto-save
  useEffect(() => {
    if (isInitialLoad) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (imageFiles.length > 0) {
          await sessionService.saveSession(imageFiles);
          setIsSessionSaved(true);
        } else {
          await sessionService.clearSession();
          setIsSessionSaved(false);
        }
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [imageFiles, isInitialLoad]);

  const addTokenUsage = useCallback((tokens: number) => {
    setTotalTokensUsed(prev => {
      const newTotal = prev + tokens;
      quotaService.saveTodaysTokenUsage(newTotal);
      return newTotal;
    });
  }, []);

  const recordEdit = useCallback((fileId: string, updates: Partial<MetadataHistoryState>) => {
    setImageFiles(current => current.map(f => {
      if (f.id !== fileId) return f;
      const latestState = f.history[f.historyIndex] || {};
      const newState = { ...latestState, ...updates };
      const newHistory = f.history.slice(0, f.historyIndex + 1);
      newHistory.push(newState as MetadataHistoryState);
      return { 
        ...f, 
        ...updates, 
        history: newHistory, 
        historyIndex: newHistory.length - 1 
      };
    }));
  }, []);

  const handleUndo = useCallback((fileId: string) => {
    setImageFiles(current => current.map(f => {
      if (f.id === fileId && f.historyIndex > 0) {
        const prevIndex = f.historyIndex - 1;
        return { ...f, ...f.history[prevIndex], historyIndex: prevIndex };
      }
      return f;
    }));
  }, []);

  const handleRedo = useCallback((fileId: string) => {
    setImageFiles(current => current.map(f => {
      if (f.id === fileId && f.historyIndex < f.history.length - 1) {
        const nextIndex = f.historyIndex + 1;
        return { ...f, ...f.history[nextIndex], historyIndex: nextIndex };
      }
      return f;
    }));
  }, []);

  const processImages = useCallback(async (files: ImageFile[]) => {
    setIsProcessing(true);
    const promises = files.map(async (img) => {
      try {
        setImageFiles(current => current.map(f => f.id === img.id ? { ...f, state: ProcessingState.PROCESSING } : f));
        const { metadata, tokensUsed } = await generateMediaMetadata(img.file, img.mediaType === 'video');
        addTokenUsage(tokensUsed);

        const state: MetadataHistoryState = {
            editedTitle: metadata.title,
            editedDescription: metadata.description,
            editedKeywords: metadata.keywords.join(', '),
            editedCategory: metadata.category || '',
            editedAltText: '',
            editedIsEditorial: metadata.isEditorial || false,
            editedEditorialCity: metadata.editorialCity || '',
            editedEditorialRegion: metadata.editorialRegion || '',
            editedEditorialDate: metadata.editorialDate || '',
            editedEditorialFact: metadata.editorialFact || '',
        };

        setImageFiles(current => current.map(f => f.id === img.id ? { 
          ...f, state: ProcessingState.SUCCESS, metadata, ...state, history: [state], historyIndex: 0 
        } : f));
      } catch (err) {
        const msg = getFriendlyErrorMessage(err);
        addToast(`${img.file.name}: ${msg}`, 'error');
        setImageFiles(current => current.map(f => f.id === img.id ? { ...f, state: ProcessingState.ERROR, error: msg } : f));
      }
    });
    await Promise.all(promises);
    setIsProcessing(false);
  }, [addTokenUsage, addToast]);

  const handleFilesSelected = (selectedFiles: File[]) => {
    const newFiles: ImageFile[] = selectedFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      previewUrl: URL.createObjectURL(file),
      state: ProcessingState.IDLE,
      dateAdded: Date.now(),
      editedTitle: '', editedDescription: '', editedKeywords: '', editedAltText: '', editedCategory: '',
      history: [], historyIndex: -1,
      editedIsEditorial: false, editedEditorialCity: '', editedEditorialRegion: '',
      editedEditorialDate: '', editedEditorialFact: '',
    }));
    setImageFiles(prev => [...prev, ...newFiles]);
    processImages(newFiles);
  };

  const handleClear = async () => {
    imageFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setImageFiles([]);
    setSelectedImageIds(new Set());
    await sessionService.clearSession();
    setIsSessionSaved(false);
    addToast("All items cleared", "info");
  };

  const saveSessionManual = async () => {
    try {
      await sessionService.saveSession(imageFiles);
      setIsSessionSaved(true);
      addToast("Session saved manually", "success");
    } catch (e) { addToast("Failed to save session", "error"); }
  };

  const loadSessionManual = async () => {
    try {
      const files = await sessionService.loadSession();
      if (files.length > 0) {
        const migratedFiles = files.map(f => ({ ...f, editedCategory: f.editedCategory || '' }));
        setImageFiles(migratedFiles);
        addToast("Session loaded", "success");
      } else {
        addToast("No saved session found", "info");
      }
    } catch (e) { addToast("Failed to load session", "error"); }
  };

  const handleExportCsv = () => {
    const success = imageFiles.filter(f => f.state === ProcessingState.SUCCESS);
    if (!success.length) return;
    
    // Header format: Filename,Description,Keywords,Categories,Editorial,Mature content,illustration
    const headers = ['Filename', 'Description', 'Keywords', 'Categories', 'Editorial', 'Mature content', 'illustration'];
    
    const rows = success.map(f => {
      const filename = `"${f.file.name}"`;
      const description = `"${f.editedDescription.replace(/"/g, '""')}"`;
      const keywords = `"${f.editedKeywords.replace(/"/g, '""')}"`;
      const categories = `"${f.editedCategory || ''}"`;
      const editorial = f.editedIsEditorial ? `"Yes"` : `"No"`;
      const matureContent = `"No"`;
      const illustration = `"No"`;

      return [
        filename,
        description,
        keywords,
        categories,
        editorial,
        matureContent,
        illustration
      ].join(',');
    });

    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'metadata.csv'; link.click();
    addToast("CSV exported successfully", "success");
  };

  const handleExportKeywords = () => {
    const success = imageFiles.filter(f => f.state === ProcessingState.SUCCESS && f.editedKeywords);
    if (!success.length) return;
    const blob = new Blob([success.map(f => f.editedKeywords).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'keywords.txt'; link.click();
    addToast("Keywords exported successfully", "success");
  };

  const handleCopyAll = async () => {
    const success = imageFiles.filter(f => f.state === ProcessingState.SUCCESS);
    if (!success.length) return;
    const text = success.map(f => `File: ${f.file.name}\nTitle: ${f.editedTitle}\nDesc: ${f.editedDescription}\nKeys: ${f.editedKeywords}\nCategory: ${f.editedCategory}`).join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    setIsCopying(true);
    addToast("All metadata copied to clipboard", "success");
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handleGenerateField = async (id: string, field: 'title' | 'description' | 'altText' | 'keywords') => {
    const f = imageFiles.find(item => item.id === id);
    if (!f) return;
    
    setImageFiles(curr => curr.map(item => {
        if (item.id === id) {
            if (field === 'title') return { ...item, isGeneratingTitle: true };
            if (field === 'description') return { ...item, isGeneratingDescription: true };
            if (field === 'altText') return { ...item, isGeneratingAltText: true };
            if (field === 'keywords') return { ...item, isGeneratingKeywords: true };
        }
        return item;
    }));

    try {
        let result: any;
        if (field === 'title') result = await generateTitle(f.file, { description: f.editedDescription, keywords: f.editedKeywords });
        if (field === 'description') result = await generateDescription(f.file, { title: f.editedTitle, keywords: f.editedKeywords });
        if (field === 'altText') result = await generateAltText(f.file, {});
        if (field === 'keywords') result = await generateKeywords(f.file, { title: f.editedTitle, description: f.editedDescription });
        
        addTokenUsage(result.tokensUsed);
        const update: any = {};
        if (field === 'title') update.editedTitle = result.title;
        if (field === 'description') update.editedDescription = result.description;
        if (field === 'altText') update.editedAltText = result.altText;
        if (field === 'keywords') update.editedKeywords = result.keywords.join(', ');
        recordEdit(id, update);
    } catch (err) {
        addToast(getFriendlyErrorMessage(err), 'error');
    } finally {
        setImageFiles(curr => curr.map(item => {
            if (item.id === id) {
                if (field === 'title') return { ...item, isGeneratingTitle: false };
                if (field === 'description') return { ...item, isGeneratingDescription: false };
                if (field === 'altText') return { ...item, isGeneratingAltText: false };
                if (field === 'keywords') return { ...item, isGeneratingKeywords: false };
            }
            return item;
        }));
    }
  };

  const handleAnalyze = async (id: string) => {
    const f = imageFiles.find(item => item.id === id);
    if (!f) return;
    setImageFiles(curr => curr.map(item => item.id === id ? { ...item, isAnalyzing: true } : item));
    try {
        const { analysis, tokensUsed } = await analyzeImageForKeywords(f.file);
        addTokenUsage(tokensUsed);
        setImageFiles(curr => curr.map(item => item.id === id ? { ...item, analysis, isAnalyzing: false } : item));
        addToast("AI Analysis complete", "success");
    } catch (err) {
        addToast(getFriendlyErrorMessage(err), "error");
        setImageFiles(curr => curr.map(item => item.id === id ? { ...item, isAnalyzing: false } : item));
    }
  };

  const sortedAndFiltered = useMemo(() => {
    let filtered = activeFilter === 'all' ? imageFiles : imageFiles.filter(f => f.state === activeFilter);
    if (mediaTypeFilter !== 'all') filtered = filtered.filter(f => f.mediaType === mediaTypeFilter);
    return [...filtered].sort((a, b) => {
      let res = a.dateAdded - b.dateAdded;
      if (sortKey === 'filename') res = a.file.name.localeCompare(b.file.name);
      return sortDirection === 'asc' ? res : -res;
    });
  }, [imageFiles, activeFilter, mediaTypeFilter, sortKey, sortDirection]);

  const counts = useMemo(() => {
    const c = imageFiles.reduce((a, f) => { a[f.state] = (a[f.state] || 0) + 1; return a; }, {} as any);
    return { ...c, all: imageFiles.length };
  }, [imageFiles]);

  return (
    <div className="min-h-screen bg-dark-bg font-sans pb-12">
      <ToastContainer />
      <Header totalImages={imageFiles.length} processingImagesCount={counts[ProcessingState.PROCESSING] || 0} tokensUsed={totalTokensUsed} quotaLimit={quotaService.QUOTA_LIMIT} />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <ImageUploader onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />
        
        {imageFiles.length > 0 && (
          <div className="flex flex-col items-center gap-6 mt-8 animate-fade-in-up">
            <div className="flex flex-wrap justify-center gap-3">
               {imageFiles.some(f => f.state === ProcessingState.SUCCESS) && (
                 <>
                  <button onClick={handleExportCsv} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 border border-dark-border transition-colors">
                    <DocumentTextIcon className="w-5 h-5 text-brand-blue"/> Export CSV
                  </button>
                  <button onClick={handleExportKeywords} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 border border-dark-border transition-colors">
                    <HashtagIcon className="w-5 h-5 text-brand-purple"/> Export Keywords
                  </button>
                  <button onClick={handleCopyAll} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 border border-dark-border transition-colors">
                    {isCopying ? <CheckIcon className="w-5 h-5 text-green-400"/> : <ClipboardIcon className="w-5 h-5"/>} Copy All
                  </button>
                 </>
               )}
               <button onClick={handleClear} className="bg-red-900/40 hover:bg-red-800/60 text-red-200 px-4 py-2 rounded-lg transition-colors border border-red-900/50">Clear All</button>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
                <button onClick={saveSessionManual} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 border border-dark-border transition-colors text-xs">
                  <SaveIcon className="w-4 h-4"/> Save Now
                </button>
                <button onClick={loadSessionManual} disabled={!isSessionSaved} className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 px-4 py-2 rounded-lg flex items-center gap-2 border border-dark-border transition-colors text-xs">
                  <FolderOpenIcon className="w-4 h-4"/> Reload Session
                </button>
            </div>

            <div className="flex gap-2 bg-dark-card p-1 rounded-full border border-dark-border">
              {['all', 'image', 'video'].map(t => (
                <button key={t} onClick={() => setMediaTypeFilter(t as any)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mediaTypeFilter === t ? 'bg-brand-blue text-white' : 'text-medium-text hover:text-light-text'}`}>
                  {t === 'all' ? 'All' : t === 'image' ? 'Photos' : 'Videos'}
                </button>
              ))}
            </div>

            <FilterControls activeFilter={activeFilter} onFilterChange={setActiveFilter} counts={counts} />
            <SortControls sortKey={sortKey} sortDirection={sortDirection} onSortChange={(k, d) => {setSortKey(k); setSortDirection(d);}} />
          </div>
        )}

        <ImageGrid 
          imageFiles={sortedAndFiltered} 
          totalImageCount={imageFiles.length} 
          selectedImageIds={selectedImageIds} 
          onImageSelect={id => setSelectedImageIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
          onTitleChange={(id, v) => recordEdit(id, { editedTitle: v })}
          onDescriptionChange={(id, v) => recordEdit(id, { editedDescription: v })}
          onKeywordsChange={(id, v) => recordEdit(id, { editedKeywords: v })}
          onAltTextChange={(id, v) => recordEdit(id, { editedAltText: v })}
          onCategoryChange={(id, v) => recordEdit(id, { editedCategory: v })}
          onUndo={handleUndo} onRedo={handleRedo}
          onRetry={(id) => { const f = imageFiles.find(item => item.id === id); if (f) processImages([f]); }}
          onGenerateTitle={(id) => handleGenerateField(id, 'title')} 
          onGenerateDescription={(id) => handleGenerateField(id, 'description')} 
          onGenerateAltText={(id) => handleGenerateField(id, 'altText')} 
          onGenerateKeywords={(id) => handleGenerateField(id, 'keywords')}
          onAnalyzeImage={handleAnalyze}
          onTokensUsed={addTokenUsage} 
          onEditorialUpdate={recordEdit}
          allKeywords={[]} keywordFrequencies={new Map()} maxFrequency={0} 
        />
      </main>
    </div>
  );
}

export default App;