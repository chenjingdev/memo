import { useEffect, useMemo, useRef } from 'react';
import { MEMO_MAX_CHARS } from '../lib/constants';
import { clampTextByChars, getCharCount } from '../lib/text';
import type { ThemeClasses } from '../types';

type Props = {
  themeClasses: ThemeClasses;
  memoText: string;
  setMemoText: (value: string) => void;
  setIsDirty: (value: boolean) => void;
  lastSavedValue: string;
  view: 'write' | 'read';
};

export default function MemoEditor({
  themeClasses,
  memoText,
  setMemoText,
  setIsDirty,
  lastSavedValue,
  view,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const memoCharCount = useMemo(() => getCharCount(memoText), [memoText]);

  useEffect(() => {
    if (view !== 'write') return;
    const el = textareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const maxHeight = Number.parseFloat(style.maxHeight || '');
    el.style.height = 'auto';
    if (Number.isFinite(maxHeight)) {
      const nextHeight = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${nextHeight}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    } else {
      el.style.height = `${el.scrollHeight}px`;
      el.style.overflowY = 'hidden';
    }
  }, [memoText, view]);

  return (
    <>
      <div className='overflow-auto mt-4 first:mt-0'>
        <div
          className={`relative overflow-hidden rounded-sm border border-black/5 shadow-lg ${themeClasses.paperBg} ${themeClasses.line} bg-[length:100%_2.4rem] bg-local ${themeClasses.marginLine} before:absolute before:inset-y-0 before:left-12 before:w-px before:content-['']`}
        >
          <textarea
            id="memo-input"
            className={`w-full min-h-56 resize-none bg-transparent px-8 py-2 pl-16 font-body text-lg leading-10 outline-none ${themeClasses.text}`}
            placeholder="Start writing..."
            spellCheck={false}
            value={memoText}
            ref={textareaRef}
            onChange={(e) => {
              const nextValue = clampTextByChars(e.target.value, MEMO_MAX_CHARS);
              setMemoText(nextValue);
              setIsDirty(nextValue !== lastSavedValue);
            }}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end text-sm font-ui text-neutral-500">
        {memoCharCount}/{MEMO_MAX_CHARS} chars
      </div>
    </>
  );
}
