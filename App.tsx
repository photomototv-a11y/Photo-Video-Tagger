
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import type { ImageFile, MetadataHistoryState } from './types';
import { ProcessingState } from './types';
import { generateMediaMetadata, generateTitle, generateDescription, generateKeywords, analyzeImageForKeywords, generateAltText, getFriendlyErrorMessage, CATEGORY_TRANSLATIONS } from './services/geminiService';
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
import { ArrowUpIcon } from './components/icons/ArrowUpIcon'; // Reusing as Export icon
import { ArrowDownIcon } from './components/icons/ArrowDownIcon'; // Reusing as Import icon

// Helper to generate a small thumbnail base64 string for portable sessions
const generateThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Use low quality JPEG for thumbnails to keep JSON size small
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
      img.onerror = () => resolve(''); // Fail silently for non-images
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

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
  const abortProcessingRef = useRef<boolean>(false);

  const { addToast } = useToast();
  // Fixed: Cannot find namespace 'NodeJS'. Using ReturnType<typeof setTimeout> for browser environments.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize: Load usage and check for existing local session (IndexedDB)
  useEffect(() => {
    const init = async () => {
      setTotalTokensUsed(quotaService.getTodaysTokenUsage());
      
      const exists = await sessionService.hasSession();
      setIsSessionSaved(exists);
      
      if (exists) {
        try {
          const files = await sessionService.loadSession();
          if (files.length > 0) {
            // Ensure compatibility
            const migratedFiles = files.map(f => ({ 
                ...f, 
                editedCategory: f.editedCategory || '',
                editedIsEditorial: f.editedIsEditorial ?? false,
                editedEditorialCity: f.editedEditorialCity || '',
                editedEditorialRegion: f.editedEditorialRegion || '',
                editedEditorialDate: f.editedEditorialDate || '',
                editedEditorialFact: f.editedEditorialFact || '',
                isRestored: false // Local DB has real files
            }));
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

  // Debounced Auto-save to IndexedDB (Local)
  useEffect(() => {
    if (isInitialLoad) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (imageFiles.length > 0) {
          // Only save files that have actual File objects (not restored from JSON without blob)
          // The sessionService currently handles this by trying to store file objects.
          // For restored files (dummy files), it might store them as 0 byte files or text files, which is fine for structure.
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
    abortProcessingRef.current = false;
    setIsProcessing(true);
    
    // Initialize context from existing successful images
    const processedTitles: string[] = [];
    const processedKeywords = new Set<string>();

    imageFiles.forEach(f => {
        if (f.state === ProcessingState.SUCCESS) {
            if (f.editedTitle) processedTitles.push(f.editedTitle);
            if (f.editedKeywords) {
                f.editedKeywords.split(',').forEach(k => processedKeywords.add(k.trim().toLowerCase()));
            }
        }
    });

    // Process sequentially to allow batch context awareness
    for (const img of files) {
        // Yield to main thread to prevent UI freezing and Vite disconnection
        await new Promise(resolve => setTimeout(resolve, 100));

        if (abortProcessingRef.current) {
            break;
        }

        // Skip if already processed or is restored (no real file)
        if (img.state === ProcessingState.SUCCESS) continue;
        if (img.isRestored) {
             // Silently skip restoring AI for dummy files
             continue;
        }

        try {
            setImageFiles(current => current.map(f => f.id === img.id ? { ...f, state: ProcessingState.PROCESSING } : f));
            
            // Prepare context for batch processing
            const batchContext = {
                previousTitles: processedTitles,
                previousKeywords: Array.from(processedKeywords)
            };

            const { metadata, tokensUsed } = await generateMediaMetadata(img.file, img.mediaType === 'video', batchContext);
            addTokenUsage(tokensUsed);

            // Update context with new results
            if (metadata.title) processedTitles.push(metadata.title);
            if (metadata.keywords) {
                metadata.keywords.forEach(k => processedKeywords.add(k.toLowerCase()));
            }

            // Enforce 'editorial' keyword if metadata isEditorial is true
            const rawKeywords = Array.isArray(metadata.keywords) ? metadata.keywords : [];
            let finalKeywords = [...rawKeywords];
            if (metadata.isEditorial) {
                const hasEditorial = finalKeywords.some(k => k.toLowerCase() === 'editorial');
                if (!hasEditorial) {
                    finalKeywords = ['editorial', ...finalKeywords];
                }
            }

            const state: MetadataHistoryState = {
                editedTitle: metadata.title,
                editedDescription: metadata.description,
                editedKeywords: finalKeywords.join(', '),
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
    }
    setIsProcessing(false);
  }, [imageFiles, addTokenUsage, addToast]);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    // 1. Create initial state objects immediately
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
      isRestored: false
    }));

    setImageFiles(prev => [...prev, ...newFiles]);

    // 2. Generate Thumbnails asynchronously
    // We do this to ensure we can export sessions later.
    // We don't block the UI or AI processing for this.
    for (const imgFile of newFiles) {
        if (imgFile.mediaType === 'image') {
            generateThumbnail(imgFile.file).then(thumbData => {
                setImageFiles(current => current.map(f => f.id === imgFile.id ? { ...f, thumbnailData: thumbData } : f));
            });
        }
    }

    // 3. Start AI Processing
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

  // --- Export Session Logic (ZIP) ---
  const handleExportSession = async () => {
    if (imageFiles.length === 0) return;
    setIsZipping(true);
    try {
        const blob = await sessionService.exportSessionToZip(imageFiles);
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Format date for filename: YYYY-MM-DD-HHmm
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
        link.download = `stock-tagger-session-${dateStr}-${timeStr}.zip`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast("Session exported successfully", "success");
    } catch (err) {
        console.error(err);
        addToast("Failed to export session", "error");
    } finally {
        setIsZipping(false);
    }
  };

  // --- Import Session Logic (ZIP) ---
  const triggerImport = () => {
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Reset input
          fileInputRef.current.click();
      }
  };

  const handleImportSession = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsZipping(true);
      try {
          // Detect simple JSON vs ZIP by extension or basic check?
          // For now assume ZIP as per button logic.
          const restoredFiles = await sessionService.importSessionFromZip(file);
          setImageFiles(prev => [...prev, ...restoredFiles]);
          addToast(`Imported ${restoredFiles.length} items from session`, "success");

      } catch (err) {
          console.error(err);
          addToast("Failed to import session. Invalid ZIP file.", "error");
      } finally {
          setIsZipping(false);
      }
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
      
      const rawCategory = f.editedCategory || '';
      const englishCategory = CATEGORY_TRANSLATIONS[rawCategory] || rawCategory;
      const categories = `"${englishCategory}"`;
      
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
    
    const text = success.map(f => {
        const rawCategory = f.editedCategory || '';
        const englishCategory = CATEGORY_TRANSLATIONS[rawCategory] || rawCategory;
        return `File: ${f.file.name}\nTitle: ${f.editedTitle}\nDescription: ${f.editedDescription}\nKeywords: ${f.editedKeywords}\nCategory: ${englishCategory}`;
    }).join('\n\n---\n\n');
    
    await navigator.clipboard.writeText(text);
    setIsCopying(true);
    addToast("All metadata copied to clipboard", "success");
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handleGenerateField = async (id: string, field: 'title' | 'description' | 'altText' | 'keywords') => {
    const f = imageFiles.find(item => item.id === id);
    if (!f) return;

    if (f.isRestored) {
        addToast("Cannot regenerate AI content for restored sessions without original files.", "error");
        return;
    }
    
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
        
        if (field === 'keywords') {
            result = await generateKeywords(f.file, { title: f.editedTitle, description: f.editedDescription });
            
            // Ensure result.keywords is an array
            let generatedKeywords = Array.isArray(result.keywords) ? result.keywords : [];
            
            // Enforce editorial keyword if flag is set during regeneration
            if (f.editedIsEditorial) {
                 const hasEditorial = generatedKeywords.some((k: string) => k.toLowerCase() === 'editorial');
                 if (!hasEditorial) {
                     generatedKeywords = ['editorial', ...generatedKeywords];
                 }
            }
            result.keywords = generatedKeywords;
        }
        
        addTokenUsage(result.tokensUsed);
        const update: any = {};
        if (field === 'title') update.editedTitle = result.title;
        if (field === 'description') update.editedDescription = result.description;
        if (field === 'altText') update.editedAltText = result.altText;
        if (field === 'keywords') update.editedKeywords = Array.isArray(result.keywords) ? result.keywords.join(', ') : result.keywords;
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

    if (f.isRestored) {
        addToast("Cannot analyze restored files.", "error");
        return;
    }
    
    setImageFiles(curr => curr.map(item => item.id === id ? { ...item, isAnalyzing: true } : item));
    
    try {
        const { analysis, tokensUsed } = await analyzeImageForKeywords(f.file);
        addTokenUsage(tokensUsed);
        setImageFiles(curr => curr.map(item => item.id === id ? { ...item, analysis, isAnalyzing: false } : item));
    } catch (err) {
        addToast(getFriendlyErrorMessage(err), 'error');
        setImageFiles(curr => curr.map(item => item.id === id ? { ...item, isAnalyzing: false } : item));
    }
  };

  const handleEditorialUpdate = useCallback((fileId: string, updates: Partial<MetadataHistoryState>) => {
    recordEdit(fileId, updates);
  }, [recordEdit]);

  // Derived state for sorting and filtering
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...imageFiles];

    if (activeFilter !== 'all') {
      result = result.filter(f => f.state === activeFilter);
    }
    
    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof ImageFile];
      let valB: any = b[sortKey as keyof ImageFile];

      if (sortKey === 'date') {
        valA = a.dateAdded;
        valB = b.dateAdded;
      } else if (sortKey === 'filename') {
        valA = a.file.name;
        valB = b.file.name;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [imageFiles, activeFilter, sortKey, sortDirection]);

  const counts = useMemo(() => {
    const c: { [key in ProcessingState | 'all']?: number } = { all: imageFiles.length };
    Object.values(ProcessingState).forEach(s => c[s] = 0);
    imageFiles.forEach(f => {
      if (c[f.state] !== undefined) c[f.state]!++;
    });
    return c;
  }, [imageFiles]);

  const processingCount = counts[ProcessingState.PROCESSING] || 0;

  return (
    <div className="min-h-screen pb-20 font-sans">
      <Header 
        totalImages={imageFiles.length}
        processingImagesCount={processingCount}
        tokensUsed={totalTokensUsed}
        quotaLimit={quotaService.QUOTA_LIMIT}
      />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hidden Input for Session Import */}
        <input 
            type="file" 
            accept=".zip" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImportSession}
        />

        <ImageUploader 
            onFilesSelected={handleFilesSelected} 
            isProcessing={isProcessing} 
            onLoadSession={triggerImport} 
        />

        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mt-8 gap-4 border-b border-dark-border pb-6">
           <FilterControls activeFilter={activeFilter} onFilterChange={setActiveFilter} counts={counts} />
           
           <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <SortControls sortKey={sortKey} sortDirection={sortDirection} onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }} />
              
              <div className="h-8 w-px bg-dark-border hidden sm:block"></div>
              
              <button onClick={handleExportSession} disabled={isZipping || imageFiles.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-dark-card border border-dark-border rounded-md text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Download portable session as ZIP">
                 {isZipping ? <SpinnerIcon className="w-4 h-4"/> : <SaveIcon className="w-4 h-4" />}
                 {isZipping ? 'Zipping...' : 'Save Session'}
              </button>
              
               <button onClick={triggerImport} disabled={isZipping} className="flex items-center gap-2 px-3 py-1.5 bg-dark-card border border-dark-border rounded-md text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50" title="Load portable session from ZIP">
                 <FolderOpenIcon className="w-4 h-4" />
                 Load Session
              </button>

              <div className="h-8 w-px bg-dark-border hidden sm:block"></div>

               <button onClick={handleCopyAll} className="flex items-center gap-2 px-3 py-1.5 bg-dark-card border border-dark-border rounded-md text-sm font-semibold hover:bg-gray-700 transition-colors">
                 {isCopying ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                 Copy All
              </button>

               <button onClick={handleExportCsv} className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue hover:bg-indigo-600 text-white border border-transparent rounded-md text-sm font-semibold transition-colors shadow-lg">
                 <DocumentTextIcon className="w-4 h-4" />
                 CSV
              </button>
               <button onClick={handleExportKeywords} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white border border-transparent rounded-md text-sm font-semibold transition-colors">
                 <HashtagIcon className="w-4 h-4" />
                 Keywords
              </button>
              
              {imageFiles.length > 0 && (
                <button onClick={handleClear} className="ml-auto xl:ml-2 text-red-400 hover:text-red-300 text-sm font-semibold underline decoration-red-400/30 hover:decoration-red-300">
                    Clear All
                </button>
              )}
           </div>
        </div>

        <ImageGrid 
            imageFiles={filteredAndSortedFiles}
            totalImageCount={imageFiles.length}
            selectedImageIds={selectedImageIds}
            allKeywords={[]} 
            keywordFrequencies={new Map()}
            maxFrequency={0}
            onImageSelect={(id) => setSelectedImageIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            })}
            onTitleChange={(id, v) => recordEdit(id, { editedTitle: v })}
            onDescriptionChange={(id, v) => recordEdit(id, { editedDescription: v })}
            onKeywordsChange={(id, v) => recordEdit(id, { editedKeywords: v })}
            onAltTextChange={(id, v) => recordEdit(id, { editedAltText: v })}
            onCategoryChange={(id, v) => recordEdit(id, { editedCategory: v })}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onRetry={(id) => {
                const f = imageFiles.find(i => i.id === id);
                if(f) processImages([f]);
            }}
            onGenerateTitle={(id) => handleGenerateField(id, 'title')}
            onGenerateDescription={(id) => handleGenerateField(id, 'description')}
            onGenerateAltText={(id) => handleGenerateField(id, 'altText')}
            onGenerateKeywords={(id) => handleGenerateField(id, 'keywords')}
            onAnalyzeImage={handleAnalyze}
            onTokensUsed={addTokenUsage}
            onEditorialUpdate={handleEditorialUpdate}
        />
      </main>
      <ToastContainer />
    </div>
  );
}

export default App;
