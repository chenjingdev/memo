import { RefreshCcw, Save, Share2 } from 'lucide-react';
import type { IdOptions } from '../lib/id';
import { KEY_MAX_LEN, KEY_MIN_LEN, MEMO_MAX_CHARS, TTL_MINUTES } from '../lib/constants';
import type { ShareStatus, ThemeClasses } from '../types';

type Props = {
  themeClasses: ThemeClasses;
  shareLink: string;
  isDirty: boolean;
  isSharing: boolean;
  shareStatus: ShareStatus;
  lastSharedId: string | null;
  remainingText: string | null;
  idLength: number;
  keyLength: number;
  options: IdOptions;
  onSave: () => void;
  onShare: () => void;
  onRefresh: () => void;
  onIdLengthChange: (value: number) => void;
  onKeyLengthChange: (value: number) => void;
  onOptionToggle: (key: keyof IdOptions, value: boolean) => void;
};

export default function SharePanel({
  themeClasses,
  shareLink,
  isDirty,
  isSharing,
  shareStatus,
  lastSharedId,
  remainingText,
  idLength,
  keyLength,
  options,
  onSave,
  onShare,
  onRefresh,
  onIdLengthChange,
  onKeyLengthChange,
  onOptionToggle,
}: Props) {
  const statusPillClass =
    shareStatus === 'active'
      ? themeClasses.statusActive
      : shareStatus === 'expired'
        ? themeClasses.statusExpired
        : shareStatus === 'error'
          ? themeClasses.statusError
          : themeClasses.statusIdle;

  return (
    <div
      className={`rounded-xl border border-black/5 p-5 shadow-sm transition ${themeClasses.panelBg} ${themeClasses.panelText}`}
    >
      <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-neutral-500">
        <label>Share Link (Link ID)</label>
        <div className="flex items-center gap-3">
          <button
            id="btn-save"
            className={`inline-flex items-center justify-center transition ${themeClasses.accent} disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
            title="Save"
            onClick={onSave}
            disabled={!isDirty}
          >
            <Save size={18} />
          </button>
          <button
            id="btn-share"
            className={`inline-flex items-center justify-center transition ${themeClasses.accent} disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
            title="Share"
            onClick={onShare}
            disabled={isSharing || isDirty}
          >
            <Share2 size={18} />
          </button>
          <button
            id="btn-refresh"
            className={`inline-flex cursor-pointer items-center justify-center transition ${themeClasses.accent} hover:rotate-180`}
            title="Regenerate"
            onClick={onRefresh}
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-lg border border-black/10 bg-black/5 px-4 py-2">
        <input
          type="text"
          id="id-input"
          className={`flex-1 bg-transparent font-mono text-sm tracking-wide outline-none ${themeClasses.text}`}
          spellCheck={false}
          value={shareLink}
          readOnly
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-ui text-neutral-500">
        <span>Status:</span>
        {lastSharedId ? (
          <span className={`rounded-full px-2 py-0.5 text-sm uppercase ${statusPillClass}`}>
            {shareStatus}
          </span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-sm uppercase ${themeClasses.statusIdle}`}>
            Not shared
          </span>
        )}
        <span className="text-neutral-400">•</span>
        {shareStatus === 'active' && remainingText ? (
          <span>Expires in {remainingText}</span>
        ) : (
          <span>TTL: {TTL_MINUTES} min</span>
        )}
      </div>



      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-20 text-sm text-neutral-500">
            Length: <span className={themeClasses.accent}>{idLength}</span>
          </span>
          <input
            type="range"
            id="opt-len"
            min={KEY_MIN_LEN}
            max={KEY_MAX_LEN}
            value={idLength}
            className={`w-32 cursor-pointer ${themeClasses.accentInput}`}
            onChange={(e) => onIdLengthChange(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 text-sm text-neutral-500">
            Key: <span className={themeClasses.accent}>{keyLength}</span>
          </span>
          <input
            type="range"
            id="opt-key-len"
            min={KEY_MIN_LEN}
            max={KEY_MAX_LEN}
            value={keyLength}
            className={`w-32 cursor-pointer ${themeClasses.accentInput}`}
            onChange={(e) => onKeyLengthChange(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              id="opt-num"
              checked={options.useNum}
              onChange={(e) => onOptionToggle('useNum', e.target.checked)}
              className="sr-only"
            />
            <span
              className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${options.useNum
                ? `${themeClasses.accentBg} text-white border-transparent`
                : 'border-black/10 text-neutral-500'
                }`}
            >
              123
            </span>
          </label>
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              id="opt-low"
              checked={options.useLow}
              onChange={(e) => onOptionToggle('useLow', e.target.checked)}
              className="sr-only"
            />
            <span
              className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${options.useLow
                ? `${themeClasses.accentBg} text-white border-transparent`
                : 'border-black/10 text-neutral-500'
                }`}
            >
              abc
            </span>
          </label>
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              id="opt-up"
              checked={options.useUp}
              onChange={(e) => onOptionToggle('useUp', e.target.checked)}
              className="sr-only"
            />
            <span
              className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${options.useUp
                ? `${themeClasses.accentBg} text-white border-transparent`
                : 'border-black/10 text-neutral-500'
                }`}
            >
              ABC
            </span>
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end text-sm font-ui text-neutral-500">
        Limit: {MEMO_MAX_CHARS} chars
      </div>
    </div>
  );
}
