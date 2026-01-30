
import React from 'react';
import { ProcessingState } from '../types';

type FilterType = ProcessingState | 'all';

interface FilterControlsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: { [key in FilterType]?: number };
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: ProcessingState.SUCCESS, label: 'Success' },
  { id: ProcessingState.ERROR, label: 'Error' },
  { id: ProcessingState.PROCESSING, label: 'Processing' },
  { id: ProcessingState.IDLE, label: 'Queued' },
];

const FilterControls: React.FC<FilterControlsProps> = ({ activeFilter, onFilterChange, counts }) => {
    return (
        <div className="my-6 flex justify-center items-center gap-2 flex-wrap" role="toolbar" aria-label="Filter images by status">
            {FILTERS.map(({ id, label }) => {
                const count = (id === 'all') ? counts.all : (counts[id] || 0);

                if (count === 0 && id !== 'all' && activeFilter !== id) {
                    return null;
                }

                const isActive = activeFilter === id;
                return (
                    <button
                        key={id}
                        onClick={() => onFilterChange(id)}
                        className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 flex items-center gap-2 ${
                            isActive
                                ? 'bg-brand-blue text-white shadow-md'
                                : 'bg-dark-card text-medium-text hover:bg-gray-700 hover:text-light-text'
                        }`}
                        aria-pressed={isActive}
                    >
                        <span>{label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            isActive ? 'bg-white text-brand-blue' : 'bg-gray-700 text-gray-300'
                        }`}>
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default FilterControls;
