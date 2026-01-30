
import React from 'react';
import type { ImageFile, MetadataHistoryState } from '../types';
import ImageCard from './ImageCard';

interface ImageGridProps {
  imageFiles: ImageFile[];
  totalImageCount: number;
  selectedImageIds: Set<string>;
  allKeywords: string[];
  keywordFrequencies: Map<string, number>;
  maxFrequency: number;
  onImageSelect: (fileId: string) => void;
  onTitleChange: (fileId: string, newTitle: string) => void;
  onDescriptionChange: (fileId: string, newDescription: string) => void;
  onKeywordsChange: (fileId:string, newKeywords: string) => void;
  onAltTextChange: (fileId: string, newAltText: string) => void;
  onCategoryChange: (fileId: string, newCategory: string) => void;
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

const ImageGrid: React.FC<ImageGridProps> = ({ 
  imageFiles, 
  totalImageCount,
  selectedImageIds,
  allKeywords,
  keywordFrequencies,
  maxFrequency,
  onImageSelect,
  onTitleChange,
  onDescriptionChange,
  onKeywordsChange, 
  onAltTextChange,
  onCategoryChange,
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
  if (totalImageCount === 0) {
    return (
        <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-light-text">Ready to Tag Your Photos</h2>
            <p className="mt-2 text-medium-text">Upload one or more images to get started.</p>
        </div>
    );
  }
  
  if (imageFiles.length === 0) {
    return (
        <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-light-text">No Images Found</h2>
            <p className="mt-2 text-medium-text">No images match your current filter selection.</p>
        </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 mt-8">
      {imageFiles.map(file => (
        <ImageCard 
          key={file.id} 
          imageFile={file} 
          isSelected={selectedImageIds.has(file.id)}
          allKeywords={allKeywords}
          keywordFrequencies={keywordFrequencies}
          maxFrequency={maxFrequency}
          onSelect={onImageSelect}
          onTitleChange={onTitleChange}
          onDescriptionChange={onDescriptionChange}
          onKeywordsChange={onKeywordsChange}
          onAltTextChange={onAltTextChange}
          onCategoryChange={onCategoryChange}
          onUndo={onUndo}
          onRedo={onRedo}
          onRetry={onRetry}
          onGenerateTitle={onGenerateTitle}
          onGenerateDescription={onGenerateDescription}
          onGenerateAltText={onGenerateAltText}
          onGenerateKeywords={onGenerateKeywords}
          onAnalyzeImage={onAnalyzeImage}
          onTokensUsed={onTokensUsed}
          onEditorialUpdate={onEditorialUpdate}
        />
      ))}
    </div>
  );
};

export default ImageGrid;