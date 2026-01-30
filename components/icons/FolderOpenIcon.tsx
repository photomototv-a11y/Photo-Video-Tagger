import React from 'react';

export const FolderOpenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
        d="M3.75 9.75h16.5m-16.5 0A2.25 2.25 0 015.25 7.5h13.5a2.25 2.25 0 012.25 2.25m-18 0v6.75a2.25 2.25 0 002.25 2.25h13.5a2.25 2.25 0 002.25-2.25V9.75M6 13.5h12m-8.25-4.5v-1.5a2.25 2.25 0 012.25-2.25h3.75a2.25 2.25 0 012.25 2.25v1.5" 
    />
  </svg>
);