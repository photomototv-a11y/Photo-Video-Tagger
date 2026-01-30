import React from 'react';
import { ChipIcon } from './icons/ChipIcon';

interface QuotaDisplayProps {
  tokensUsed: number;
  quotaLimit: number;
}

const QuotaDisplay: React.FC<QuotaDisplayProps> = ({ tokensUsed, quotaLimit }) => {
  const percentage = Math.min((tokensUsed / quotaLimit) * 100, 100);

  let barColor = 'bg-brand-blue';
  if (percentage > 90) {
    barColor = 'bg-red-500';
  } else if (percentage > 75) {
    barColor = 'bg-yellow-500';
  }

  const formattedTokensUsed = new Intl.NumberFormat().format(tokensUsed);
  const formattedQuotaLimit = new Intl.NumberFormat().format(quotaLimit);

  return (
    <div className="mt-6" aria-label={`Token usage: ${formattedTokensUsed} of ${formattedQuotaLimit}`}>
      <div className="flex justify-between items-center mb-1 text-sm">
        <div className="flex items-center gap-2 font-semibold text-medium-text">
          <ChipIcon className="w-5 h-5" />
          <span>Daily Token Usage</span>
        </div>
        <div className="font-mono text-light-text">
          {formattedTokensUsed} / {formattedQuotaLimit}
        </div>
      </div>
      <div className="w-full bg-dark-card rounded-full h-2.5">
        <div 
          className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={tokensUsed}
          aria-valuemin={0}
          aria-valuemax={quotaLimit}
        ></div>
      </div>
    </div>
  );
};

export default QuotaDisplay;
