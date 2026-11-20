import React from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface AppleSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isDarkTheme?: boolean;
  inputBg?: string;
  inputBorder?: string;
  inputTextColor?: string;
  inputIconColor?: string;
  onDone?: () => void;
  className?: string;
}

export const AppleSearchInput: React.FC<AppleSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  isDarkTheme,
  inputBg,
  inputBorder,
  inputTextColor,
  inputIconColor,
  onDone,
  className,
}) => {
  const bg = inputBg ?? (isDarkTheme === undefined ? 'var(--card)' : isDarkTheme ? '#2A2A2C' : '#FFFFFF');
  const border = inputBorder ?? 'var(--border)';
  const textColor =
    inputTextColor ?? (isDarkTheme === undefined ? 'var(--text)' : isDarkTheme ? '#FFFFFF' : '#1D1D1F');
  const iconColor =
    inputIconColor ?? (isDarkTheme === undefined ? 'var(--text-secondary)' : isDarkTheme ? '#CCCCCC' : '#86868B');

  return (
    <div
      className={clsx(
        'h-[44px] w-full rounded-full px-4 border flex items-center gap-[10px] transition-colors',
        className,
      )}
      style={{
        backgroundColor: bg,
        borderColor: border,
      }}
    >
      <Search size={17} style={{ color: iconColor }} className="shrink-0" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onDone?.();
          }
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-s-15 leading-[1.33] tracking-[-0.3px]"
        style={{ color: textColor }}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Очистить поиск"
          className="p-1 rounded-full opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          style={{ color: iconColor }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
