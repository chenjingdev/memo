import { ShieldCheck } from 'lucide-react';
import type { ThemeClasses } from '../types';

type Props = {
  theme: string;
  onThemeChange: (value: string) => void;
  themeClasses: ThemeClasses;
};

export default function Header({ theme, onThemeChange, themeClasses }: Props) {
  return (
    <header className="flex items-center justify-between py-2 font-ui">
      <div className="flex items-center gap-2">
        <div className={`text-lg font-semibold tracking-tight ${themeClasses.brand}`}>
          Memo Relay
        </div>
        <div
          className={`group relative flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold uppercase tracking-wider ${themeClasses.badgeStrong}`}
        >
          <ShieldCheck size={12} />
          <span>E2EE</span>
          <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-max max-w-[200px] origin-top-left scale-95 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
            <div className={`rounded-md border border-black/5 bg-white px-3 py-2 text-sm font-normal normal-case leading-relaxed shadow-xl ${themeClasses.text}`}>
              <p className="font-semibold">End-to-End Encrypted</p>
              <p className="text-neutral-500">
                The key is in the URL and never sent to the server.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <select
          id="theme-select"
          className={`cursor-pointer rounded border border-black/10 bg-transparent px-2 py-1 text-sm ${themeClasses.text}`}
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
