import { useEffect, useState, type ChangeEvent } from 'react'
import { BOOKS, clearPos, loadCustomTexts, normalizeToWords, saveCustomTexts, type CustomText, type Source } from '../books'

interface BookPickerProps {
  activeId: string | null
  onPick: (source: Source) => void
  onRandom: () => void
  onRemoved: (id: string) => void
  onClose: () => void
}

const MAX_IMPORT_CHARS = 1_500_000

export function BookPicker({ activeId, onPick, onRandom, onRemoved, onClose }: BookPickerProps) {
  const [custom, setCustom] = useState<CustomText[]>(() => loadCustomTexts())
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const addText = () => {
    if (text.length > MAX_IMPORT_CHARS) { setMessage('Text too long. Max about 1.5 MB.'); return }
    const words = normalizeToWords(text)
    if (words.length < 20) { setMessage('Need at least 20 words of typeable text.'); return }
    const item: CustomText = { id: `c-${Date.now()}`, title: title.trim().slice(0, 40) || 'My text', text: words.join(' ') }
    const next = [...custom, item]
    if (!saveCustomTexts(next)) { setMessage('Browser storage is full. Try a shorter text or delete one.'); return }
    setCustom(next)
    setTitle('')
    setText('')
    setMessage(null)
    onPick({ kind: 'book', id: item.id, title: item.title, custom: true })
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_IMPORT_CHARS * 2) { setMessage('File too big. Max about 1.5 MB of text.'); return }
    setText(await file.text())
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    setMessage(null)
  }

  const remove = (id: string) => {
    const next = custom.filter(item => item.id !== id)
    saveCustomTexts(next)
    clearPos(id)
    setCustom(next)
    onRemoved(id)
  }

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-panel book-picker" role="dialog" aria-label="Books" onClick={event => event.stopPropagation()}>
        <header className="leaderboard-header">
          <h2>Type a book</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </header>

        <button className={`book-item${activeId === null ? ' active' : ''}`} onClick={onRandom}>
          <span>Random words</span>
          <span className="book-author">default</span>
        </button>

        <h3>Classics</h3>
        <div className="book-list">
          {BOOKS.map(book => (
            <button
              key={book.id}
              className={`book-item${activeId === book.id ? ' active' : ''}`}
              onClick={() => onPick({ kind: 'book', id: book.id, title: book.title, custom: false })}
            >
              <span>{book.title}</span>
              <span className="book-author">{book.author}</span>
            </button>
          ))}
        </div>

        {custom.length > 0 && (
          <>
            <h3>Your texts</h3>
            <div className="book-list">
              {custom.map(item => (
                <div key={item.id} className="book-row">
                  <button
                    className={`book-item${activeId === item.id ? ' active' : ''}`}
                    onClick={() => onPick({ kind: 'book', id: item.id, title: item.title, custom: true })}
                  >
                    <span>{item.title}</span>
                  </button>
                  <button className="book-delete" onClick={() => remove(item.id)} aria-label={`Delete ${item.title}`}>×</button>
                </div>
              ))}
            </div>
          </>
        )}

        <h3>Import text</h3>
        <div className="book-import">
          <input type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder="Title (optional)" maxLength={40} />
          <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Paste any text here, or load a .txt file" />
          <div className="book-actions">
            <label className="btn-secondary book-file">
              Load .txt file
              <input type="file" accept=".txt,text/plain" onChange={event => void onFile(event)} hidden />
            </label>
            <button className="btn-primary" onClick={addText} disabled={!text.trim()}>Add and type</button>
          </div>
          {message && <p className="book-error" role="alert">{message}</p>}
        </div>

        <p className="book-note">
          Classics come from Project Gutenberg. Imported texts stay in your browser. Your place in each text is saved.
          Book and imported-text tests are not ranked on the leaderboard.
        </p>
      </div>
    </div>
  )
}
