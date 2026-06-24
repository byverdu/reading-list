/**
 * A single entry in the reading list.
 *
 * Mirrors the schema documented in the README and the shape of the
 * objects stored in `reading-list.json`.
 */
export interface ReadingListEntry {
  /** Unique string identifier (a number or slug). */
  id: string;
  /** Article title. */
  title: string;
  /** Full URL to the article. */
  url: string;
  /** Array of lowercase tags. */
  tags: string[];
  /** Date string in `DD-MM-YYYY` format, e.g. `16-06-2025`. */
  date: string;
  /** Optional personal note, shown under the title. */
  notes?: string;
}

/** The reading list is an array of entries. */
export type ReadingList = ReadingListEntry[];
