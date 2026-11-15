// Hearing a word in its sentence (SB4-WP4, for a child on Extra support): the word, then the example sentence
// in the device's voice, then the word again. The sentence is never shown on screen: it is heard only.
import { speak, sayLine } from './speech.js';

/** True when the entry has an example sentence to say. */
export const canSentence = (entry) => !!(entry && entry.meaning && typeof entry.meaning.example === 'string' && entry.meaning.example.trim());

/**
 * Says the word, its example sentence, then the word again; resolves when it has finished (or stopped: anything else
 * that speaks cancels it). A word with no example is just said.
 */
export async function hearInSentence(entry) {
  if (!entry || !entry.word) return false;
  if (!canSentence(entry)) return !!(await speak(entry.word));
  if (!(await speak(entry.word))) return false;
  if (!(await sayLine(entry.meaning.example))) return false;
  return !!(await speak(entry.word));
}
