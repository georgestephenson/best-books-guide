import {
  RegExpMatcher,
  DataSet,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern,
  type MatchPayload,
} from 'obscenity';
import type { LanguageScreen, ScreenResult } from '../../app/ports/language-screen.js';
import { SEVERE_TERMS } from './severe-terms.data.js';

interface WordMeta {
  originalWord: string;
}

/** A DataSet of the curated severe terms, carrying each term as phrase metadata. */
function buildSevereDataset(): DataSet<WordMeta> {
  const dataset = new DataSet<WordMeta>();
  for (const word of SEVERE_TERMS) {
    dataset.addPhrase((phrase) =>
      phrase.setMetadata({ originalWord: word }).addPattern(parseRawPattern(word)),
    );
  }
  return dataset;
}

function matchedWords(matches: MatchPayload[], dataset: DataSet<WordMeta>): string[] {
  const words = new Set<string>();
  for (const match of matches) {
    const { phraseMetadata } = dataset.getPayloadWithPhraseMetadata(match);
    if (phraseMetadata?.originalWord) words.add(phraseMetadata.originalWord);
  }
  return [...words];
}

/**
 * The `obscenity` implementation of the F5 language screen (docs/01). Two matchers
 * share the recommended English transformers (leetspeak/confusables/duplicate
 * collapsing): a curated *severe* list that auto-hides, and the general English
 * dataset (with its Scunthorpe whitelist) that classifies remaining profanity as
 * *mild*. Severe wins when both hit.
 */
export class ObscenityLanguageScreen implements LanguageScreen {
  private readonly severeDataset = buildSevereDataset();

  private readonly general = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });

  private readonly severe = new RegExpMatcher({
    ...this.severeDataset.build(),
    ...englishRecommendedTransformers,
  });

  screen(text: string): ScreenResult {
    if (!text.trim()) return { severity: 'clean', matches: [] };

    const severeMatches = this.severe.getAllMatches(text);
    if (severeMatches.length > 0) {
      return { severity: 'severe', matches: matchedWords(severeMatches, this.severeDataset) };
    }

    const generalMatches = this.general.getAllMatches(text);
    if (generalMatches.length > 0) {
      return { severity: 'mild', matches: matchedWords(generalMatches, englishDataset) };
    }

    return { severity: 'clean', matches: [] };
  }
}
