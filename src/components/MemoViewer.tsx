import type { ThemeClasses } from '../types';

type Props = {
  themeClasses: ThemeClasses;
  readContent: string;
  readError: boolean;
  readErrorTitle: string;
  readErrorMessage: string;
  readPlaceholder: string;
  onWriteNew: () => void;
};

export default function MemoViewer({
  themeClasses,
  readContent,
  readError,
  readErrorTitle,
  readErrorMessage,
  readPlaceholder,
  onWriteNew,
}: Props) {
  return (
    <section
      id="view-read"
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div
        className={`relative overflow-hidden rounded-sm border border-black/5 shadow-lg ${themeClasses.paperBg} ${themeClasses.line} bg-[length:100%_2.4rem] bg-local ${themeClasses.marginLine} before:absolute before:inset-y-0 before:left-12 before:w-px before:content-['']`}
      >
        {!readError && readContent && (
          <div
            id="read-content"
            className={`w-full min-h-56 whitespace-pre-wrap bg-transparent px-8 py-2 pl-16 font-body text-lg leading-10 ${themeClasses.text}`}
          >
            {readContent}
          </div>
        )}
        {!readError && !readContent && (
          <div
            id="read-placeholder"
            className="flex min-h-56 items-center justify-center px-8 py-2 text-center text-sm italic text-neutral-400"
          >
            <p>{readPlaceholder}</p>
          </div>
        )}
        {readError && (
          <div
            id="read-error"
            className="flex min-h-56 flex-col items-center justify-center gap-2 px-8 py-2 text-center text-sm text-orange-400"
          >
            <h3 className="text-base font-semibold">{readErrorTitle}</h3>
            <p>{readErrorMessage}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pr-8 pb-6">
        <button
          id="btn-new"
          className={`rounded border border-black/10 px-4 py-2 text-sm font-ui ${themeClasses.text}`}
          onClick={onWriteNew}
        >
          Write New Memo
        </button>
      </div>
    </section>
  );
}
