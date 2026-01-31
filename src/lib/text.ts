type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};

const graphemeSegmenter: GraphemeSegmenter | null = (() => {
  if (typeof Intl === 'undefined') return null;
  const Segmenter = (Intl as { Segmenter?: new (...args: any[]) => GraphemeSegmenter }).Segmenter;
  return Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;
})();

export function getCharCount(value: string) {
  if (!value) return 0;
  if (!graphemeSegmenter) return Array.from(value).length;
  let count = 0;
  for (const _ of graphemeSegmenter.segment(value)) {
    count += 1;
  }
  return count;
}

export function clampTextByChars(value: string, maxChars: number) {
  if (!value) return value;
  if (!graphemeSegmenter) {
    const chars = Array.from(value);
    return chars.length <= maxChars ? value : chars.slice(0, maxChars).join('');
  }

  let count = 0;
  let result = '';
  for (const part of graphemeSegmenter.segment(value)) {
    if (count >= maxChars) break;
    result += part.segment;
    count += 1;
  }
  return result;
}
