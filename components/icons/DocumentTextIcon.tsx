import React from 'react';

export const DocumentTextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}>
    <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25h-4.5A3.375 3.375 0 002.25 5.625v12.75c0 1.859 1.516 3.375 3.375 3.375h9.75" />
    <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M8.25 7.5h7.5m-7.5 3h7.5m-7.5 3h7.5" />
  </svg>
);
