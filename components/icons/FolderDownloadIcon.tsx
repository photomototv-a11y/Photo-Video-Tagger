import React from 'react';

export const FolderDownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25h-4.5A3.375 3.375 0 0 0 2.25 5.625v12.75c0 1.859 1.516 3.375 3.375 3.375h9.75" 
    />
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="m16.5 12-4.5 4.5m0 0-4.5-4.5m4.5 4.5V9" 
    />
  </svg>
);