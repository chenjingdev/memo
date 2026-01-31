import type { ThemeClasses } from '../types';

type Props = {
  theme: string;
  onThemeChange: (value: string) => void;
  themeClasses: ThemeClasses;
};

export default function Header({ theme, onThemeChange, themeClasses }: Props) {
  return (
    <header className="flex items-center justify-between py-2 font-ui">
      <div className={`text-lg font-semibold tracking-tight ${themeClasses.brand}`}>Memo Relay</div>
      <div className="flex items-center gap-3">
        <select
          id="theme-select"
          className={`rounded border border-black/10 bg-transparent px-2 py-1 text-sm ${themeClasses.text}`}
          value={theme}
          onChange={(e) => onThemeChange(e.target.value)}
        >
          <option value="classic">Classic Yellow</option>
          <option value="plain">Plain White</option>
          <option value="dark">Blueprint Dark</option>
        </select>
      </div>
    </header>
  );
}
