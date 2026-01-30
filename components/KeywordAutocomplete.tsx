import React, { useEffect, useRef } from 'react';

interface KeywordAutocompleteProps {
  suggestions: { keyword: string; frequency: number }[];
  onSelect: (suggestion: string) => void;
  activeIndex: number;
  onHover: (index: number) => void;
  currentWord: string;
}

const KeywordAutocomplete: React.FC<KeywordAutocompleteProps> = ({ suggestions, onSelect, activeIndex, onHover, currentWord }) => {
  const dropdownRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (activeIndex > -1 && dropdownRef.current) {
      const activeNode = dropdownRef.current.children[activeIndex] as HTMLLIElement;
      if (activeNode) {
        activeNode.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [activeIndex]);
  
  return (
    <ul ref={dropdownRef} className="no-scrollbar absolute z-20 w-full bg-dark-card border border-dark-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
      {suggestions.map(({ keyword, frequency }, index) => {
        const match = keyword.substring(0, currentWord.length);
        const rest = keyword.substring(currentWord.length);
        
        return (
          <li
            key={keyword}
            className={`flex justify-between items-center px-3 py-2 cursor-pointer text-light-text text-sm ${
              activeIndex === index ? 'bg-brand-blue' : 'hover:bg-brand-blue/80'
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(keyword);
            }}
            onMouseEnter={() => onHover(index)}
          >
            <div>
              <span className="font-bold">{match}</span>
              <span>{rest}</span>
            </div>
             <span className={`ml-2 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${
                activeIndex === index ? 'bg-white text-brand-blue' : 'bg-gray-600 text-gray-200'
            }`}>
                {frequency}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default KeywordAutocomplete;