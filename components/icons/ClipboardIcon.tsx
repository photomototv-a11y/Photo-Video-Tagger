
import React from 'react';

export const ClipboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.042A2.25 2.25 0 0113.5 9h-3a2.25 2.25 0 01-2.25-2.25V4.5A2.25 2.25 0 019 2.25h3a2.25 2.25 0 012.25 2.25v.75m-6 5.25h.008v.008H9.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75h6m-6 3h6m-6-10.5h6m-6 3a.75.75 0 00-.75.75v10.5a.75.75 0 00.75.75h6a.75.75 0 00.75-.75V6.75a.75.75 0 00-.75-.75m-6 3h6"
    />
  </svg>
);
