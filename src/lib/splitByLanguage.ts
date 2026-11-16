import { Language } from '@/types';

/**
 * RestIQ keeps one description for all languages, e.g.
 *   "Копченая курица, ... лук криспи.შებოლილი ქათამი, ... ხახვი.Smoked chicken, ... onions."
 * The three parts use different alphabets, so we split the text into sentences,
 * tell each one's language by its letters and keep only the parts for one language.
 */

const CYRILLIC = /[Ѐ-ӿ]/g;
const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/g;
const LATIN = /[A-Za-zÀ-ɏ]/g;

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

/** Language of a piece by its most common alphabet; null when it has no letters */
function detect(text: string): Language | null {
  const ru = count(text, CYRILLIC);
  const ka = count(text, GEORGIAN);
  const en = count(text, LATIN);
  if (ru + ka + en === 0) return null;
  // Latin words inside a Russian or Georgian sentence (e.g. "сыр Philadelphia") don't make it English
  if (ka >= ru && ka >= en) return 'ka';
  if (ru >= en || (ru > 0 && ru * 2 >= en)) return 'ru';
  return 'en';
}

/**
 * Sentences, also cut where Russian and Georgian meet without punctuation
 * (those alphabets never mix inside one sentence).
 */
function pieces(text: string): string[] {
  const out: string[] = [];
  // Sentence ends, but not the dot inside a number like "0.5"
  for (const sentence of text.split(/(?<=[.!?;])(?!\d)\s*/)) {
    let current = '';
    let currentScript: 'ru' | 'ka' | null = null;
    for (const ch of sentence) {
      const script = /[Ѐ-ӿ]/.test(ch) ? 'ru' : /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/.test(ch) ? 'ka' : null;
      if (script && currentScript && script !== currentScript) {
        out.push(current);
        current = '';
      }
      if (script) currentScript = script;
      current += ch;
    }
    if (current.trim()) out.push(current);
  }
  return out.flatMap(splitTrailingLatin);
}

/**
 * "Копченый лосось, рис, нори  Smoked salmon, rice, nori" has no dot between the languages:
 * cut before an all-Latin tail of 3+ words. A single Latin word inside Russian
 * ("сыр Philadelphia, огурец") is left alone because Cyrillic follows it.
 */
function splitTrailingLatin(piece: string): string[] {
  const lastCyrillic = Math.max(piece.search(/[Ѐ-ӿ][^Ѐ-ӿ]*$/), -1);
  if (lastCyrillic === -1) return [piece];
  const tail = piece.slice(lastCyrillic + 1);
  const start = tail.search(/[A-Za-z]/);
  if (start === -1) return [piece];
  const latin = tail.slice(start);
  if ((latin.match(/[A-Za-z]+/g) || []).length < 3) return [piece];
  const cut = lastCyrillic + 1 + start;
  return [piece.slice(0, cut), piece.slice(cut)];
}

/** The description split per language; a language missing from the text gets the whole text */
export function splitByLanguage(text: string): Record<Language, string> {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const parts: Record<Language, string[]> = { ru: [], ka: [], en: [] };

  let last: Language | null = null;
  for (const piece of pieces(clean)) {
    // Pieces without letters (numbers, "200 г") stay with the language before them
    const lang: Language | null = detect(piece) ?? last;
    if (!lang) continue;
    // Some descriptions repeat the same sentence twice
    if (!parts[lang].includes(piece.trim())) parts[lang].push(piece.trim());
    last = lang;
  }

  const join = (lang: Language) => parts[lang].join(' ').replace(/\s+([,.;!?])/g, '$1').trim();
  const found = { ru: join('ru'), ka: join('ka'), en: join('en') };

  // Only one language (or none) in the text: show it everywhere rather than nothing
  const fallback = found.ru || found.en || found.ka || clean;
  return {
    ru: found.ru || fallback,
    ka: found.ka || found.en || fallback,
    en: found.en || fallback,
  };
}
