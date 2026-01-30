import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onFilesSelected, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
    }
  };
  
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  }, [onFilesSelected]);

  return (
    <div className="w-full p-4">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dark-border border-dashed rounded-lg cursor-pointer bg-dark-card hover:bg-gray-800 transition-all duration-300 ${isDragging ? 'border-brand-blue scale-[1.01]' : ''}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isProcessing ? (
             <SpinnerIcon className="w-10 h-10 mb-3 text-brand-purple" />
          ) : (
            <UploadIcon className="w-10 h-10 mb-3 text-medium-text" />
          )}
          <p className="mb-2 text-sm text-medium-text">
            <span className="font-semibold text-brand-blue">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Images & Videos</p>
        </div>
        <input 
          id="dropzone-file" 
          type="file" 
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" 
          multiple 
          accept="image/*,video/*"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </div>
    </div>
  );
};

export default ImageUploader;