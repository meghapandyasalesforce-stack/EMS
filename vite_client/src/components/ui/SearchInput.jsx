import React from 'react';

export function SearchInput({
  value,
  onChange,
  onKeyDown,
  placeholder = 'Search...',
  className = '',
  inputClassName = '',
  id,
  ...props
}) {
  return (
    <div className={`ui-search ${className}`.trim()}>
      <svg className="ui-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        className={`ui-search__input ${inputClassName}`.trim()}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        {...props}
      />
    </div>
  );
}

export default SearchInput;
