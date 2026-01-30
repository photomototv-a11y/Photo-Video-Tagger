import React from 'react';

export const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M9 3.75H6.375c-1.036 0-1.875.84-1.875 1.875v11.25c0 1.036.84 1.875 1.875 1.875h11.25c1.036 0 1.875-.84 1.875-1.875V9.375l-3.75-3.75M9 3.75V9h6"
    />
  </svg>
);