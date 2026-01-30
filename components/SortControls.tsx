import React from 'react';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';

export type SortKey = 'filename' | 'state' | 'date';
export type SortDirection = 'asc' | 'desc';

interface SortControlsProps {
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey, direction: SortDirection) => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date Added' },
  { key: 'filename', label: 'Filename' },
  { key: 'state', label: 'Status' },
];

const SortControls: React.FC<SortControlsProps> = ({ sortKey, sortDirection, onSortChange }) => {
  const handleKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value as SortKey, sortDirection);
  };

  const handleDirectionToggle = () => {
    onSortChange(sortKey, sortDirection === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="flex items-center gap-2 bg-dark-card p-2 rounded-full" role="toolbar" aria-label="Sort images">
      <label htmlFor="sort-select" className="sr-only">Sort by</label>
      <select
        id="sort-select"
        value={sortKey}
        onChange={handleKeyChange}
        className="bg-gray-700 border-gray-600 text-light-text text-sm rounded-full focus:ring-brand-blue focus:border-brand-blue block pl-3 pr-8 py-1.5 border-0"
        aria-label="Sort criteria"
      >
        {SORT_OPTIONS.map(option => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        onClick={handleDirectionToggle}
        className="p-2 bg-gray-700 text-light-text rounded-full hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-brand-blue transition-colors"
        aria-label={`Sort direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
      >
        {sortDirection === 'asc' ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default SortControls;