import { Search, X } from 'lucide-react'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** Поиск (DESIGN.md → «Поиск»): лупа слева, крестик справа, когда есть текст. */
export function SearchField({ value, onChange, placeholder = 'Поиск' }: SearchFieldProps) {
  return (
    <div className="relative">
      <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-[52px] w-full appearance-none rounded-card border-2 border-border bg-surface pr-11 pl-11 text-body font-bold text-text outline-none transition-colors duration-200 placeholder:font-semibold placeholder:text-muted focus:border-info [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Очистить"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center text-muted"
        >
          <X size={20} />
        </button>
      )}
    </div>
  )
}
