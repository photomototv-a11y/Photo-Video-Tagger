
export enum ProcessingState {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface StockMetadata {
  title: string;
  description: string;
  keywords: string[];
  category?: string;
  suggestions?: string[];
  isEditorial?: boolean;
  editorialCity?: string;
  editorialRegion?: string;
  editorialDate?: string; // YYYY-MM-DD
  editorialFact?: string;
}

export interface MetadataHistoryState {
  editedTitle: string;
  editedDescription: string;
  editedKeywords: string;
  editedCategory: string;
  editedAltText: string;
  editedIsEditorial: boolean;
  editedEditorialCity: string;
  editedEditorialRegion: string;
  editedEditorialDate: string; // YYYY-MM-DD
  editedEditorialFact: string;
}

export interface ImageAnalysis {
  colors: string[];
  objects: string[];
  concepts: string[];
  style?: string[];
  composition?: string[];
  lighting?: string[];
}

export interface ImageFile {
  id: string;
  file: File;
  mediaType: 'image' | 'video';
  previewUrl: string;
  state: ProcessingState;
  metadata?: StockMetadata;
  error?: string;
  errorCode?: string;
  editedKeywords: string;
  editedTitle: string;
  editedDescription: string;
  editedAltText: string;
  editedCategory: string;
  dateAdded: number;
  history: MetadataHistoryState[];
  historyIndex: number;
  isGeneratingTitle?: boolean;
  isGeneratingDescription?: boolean;
  isGeneratingAltText?: boolean;
  isGeneratingKeywords?: boolean;
  analysis?: ImageAnalysis;
  isAnalyzing?: boolean;
  // Editorial Fields
  editedIsEditorial: boolean;
  editedEditorialCity: string;
  editedEditorialRegion: string;
  editedEditorialDate: string; // YYYY-MM-DD
  editedEditorialFact: string;
  duration?: number;
}

// --- Bulk Editing Types ---

export type BulkKeywordAction = 'add' | 'replace' | 'remove';
export type BulkTextAction = 'replace' | 'append' | 'prepend';

export interface KeywordAnalysis {
  action: BulkKeywordAction;
  // For 'add' action
  duplicates?: { keyword: string; count: number }[];
  // For 'remove' action
  foundToRemove?: { keyword: string; count: number }[];
  notFound?: string[];
  // For 'replace' action
  commonAdded?: string[];
  commonRemoved?: string[];
  commonKept?: string[];
}

export interface BulkEditSummary {
  itemCount: number;
  title?: { action: BulkTextAction; value: string };
  description?: { action: BulkTextAction; value: string };
  keywords?: { 
    action: BulkKeywordAction; 
    value: string;
    analysis: KeywordAnalysis;
  };
}

export interface BulkEditRecord {
  id: string;
  timestamp: number;
  summary: BulkEditSummary;
  affectedImageIds: string[];
}