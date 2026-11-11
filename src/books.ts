import { API_BASE } from './anticheat'

export interface Book { id: string; title: string; author: string }

// Public-domain books from Project Gutenberg. Ids must match functions/api/book.js.
export const BOOKS: Book[] = [
  { id: '1342', title: 'Pride and Prejudice', author: 'Jane Austen' },
  { id: '158', title: 'Emma', author: 'Jane Austen' },
  { id: '1260', title: 'Jane Eyre', author: 'Charlotte Brontë' },
  { id: '768', title: 'Wuthering Heights', author: 'Emily Brontë' },
  { id: '11', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: '84', title: 'Frankenstein', author: 'Mary Shelley' },
  { id: '345', title: 'Dracula', author: 'Bram Stoker' },
  { id: '2701', title: 'Moby Dick', author: 'Herman Melville' },
  { id: '1661', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: '244', title: 'A Study in Scarlet', author: 'Arthur Conan Doyle' },
  { id: '1400', title: 'Great Expectations', author: 'Charles Dickens' },
  { id: '98', title: 'A Tale of Two Cities', author: 'Charles Dickens' },
  { id: '120', title: 'Treasure Island', author: 'Robert Louis Stevenson' },
  { id: '43', title: 'Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson' },
  { id: '174', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: '74', title: 'The Adventures of Tom Sawyer', author: 'Mark Twain' },
  { id: '76', title: 'Adventures of Huckleberry Finn', author: 'Mark Twain' },
  { id: '16', title: 'Peter Pan', author: 'J. M. Barrie' },
  { id: '55', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum' },
  { id: '35', title: 'The Time Machine', author: 'H. G. Wells' },
  { id: '215', title: 'The Call of the Wild', author: 'Jack London' },
  { id: '5200', title: 'Metamorphosis', author: 'Franz Kafka' },
  { id: '132', title: 'The Art of War', author: 'Sun Tzu' },
]

export type Source = { kind: 'random' } | { kind: 'book'; id: string; title: string; custom: boolean }

export interface CustomText { id: string; title: string; text: string }

const CUSTOM_KEY = 'ape-type:texts'
const SOURCE_KEY = 'ape-type:source'
const posKey = (id: string) => `ape-type:pos:${id}`

// Turns any text into typeable ASCII words: fancy quotes/dashes flattened, accents stripped, junk dropped.
export function normalizeToWords(raw: string): string[] {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, ' ')
    .replace(/\u2026/g, '...')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/_/g, '')
    .replace(/[^\x21-\x7e\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length <= 24 && /[A-Za-z0-9]/.test(word))
}

export function loadCustomTexts(): CustomText[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]')
    if (!Array.isArray(data)) return []
    return data.filter((item): item is CustomText => Boolean(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.text === 'string')
  } catch {
    return []
  }
}

export function saveCustomTexts(list: CustomText[]): boolean {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function readPos(id: string): number {
  try {
    const value = Number(localStorage.getItem(posKey(id)))
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  } catch {
    return 0
  }
}

export function writePos(id: string, pos: number): void {
  try { localStorage.setItem(posKey(id), String(Math.max(0, Math.floor(pos)))) } catch { /* storage unavailable */ }
}

export function clearPos(id: string): void {
  try { localStorage.removeItem(posKey(id)) } catch { /* storage unavailable */ }
}

export function saveSource(source: Source): void {
  try { localStorage.setItem(SOURCE_KEY, JSON.stringify(source)) } catch { /* storage unavailable */ }
}

export function loadSavedSource(): Source | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SOURCE_KEY) || 'null')
    if (data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'book') {
      const { id, title, custom } = data as { id?: unknown; title?: unknown; custom?: unknown }
      if (typeof id === 'string' && typeof title === 'string') return { kind: 'book', id, title, custom: custom === true }
    }
  } catch { /* ignore */ }
  return null
}

const bookCache = new Map<string, string[]>()

export async function fetchBookWords(id: string): Promise<string[]> {
  const cached = bookCache.get(id)
  if (cached) return cached
  const response = await fetch(`${API_BASE}/api/book?id=${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error('Could not load book')
  const data: { text?: unknown } = await response.json()
  if (typeof data.text !== 'string') throw new Error('Could not load book')
  const words = normalizeToWords(data.text)
  if (words.length < 50) throw new Error('Book text looked empty')
  bookCache.set(id, words)
  return words
}

export function customWords(id: string): string[] | null {
  const item = loadCustomTexts().find(entry => entry.id === id)
  return item ? item.text.split(' ').filter(Boolean) : null
}
