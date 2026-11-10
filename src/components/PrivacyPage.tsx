import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy - Ape Type'
    document.body.classList.add('scroll-page')
    return () => {
      document.title = 'Ape Type'
      document.body.classList.remove('scroll-page')
    }
  }, [])

  return (
    <div className="app scroll-page">
      <header className="header">
        <div className="logo">Ape Type</div>
        <nav className="header-controls">
          <Link to="/" className="mode-btn">← Back</Link>
        </nav>
      </header>
      <main className="main">
        <div className="privacy-container">
          <h1>Privacy Policy</h1>
          <p className="last-updated">Last updated: November 2026</p>

          <section>
            <h2>1. Data We Collect</h2>
            <p>
              Ape Type collects minimal data to provide the typing test service:
            </p>
            <ul>
              <li><strong>Local settings:</strong> your theme and the last leaderboard name you used are stored in your browser (localStorage). Nothing else is stored locally.</li>
              <li><strong>Leaderboard entries:</strong> when you submit a score, we store your display name, WPM, accuracy, raw WPM, consistency, and a timestamp on our backend.</li>
              <li><strong>Anti-cheat data:</strong> when you submit a score, your browser also sends the words used in that test, what you typed, and the time offset of each keystroke. This is used only to verify the score and is not stored after verification.</li>
              <li><strong>Technical data:</strong> IP address and request metadata, standard web server logs handled by Cloudflare.</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Data</h2>
            <ul>
              <li>Power the global leaderboard</li>
              <li>Verify scores and prevent cheating (see Anti-Cheat below)</li>
              <li>Prevent abuse (rate limiting)</li>
            </ul>
          </section>

          <section>
            <h2>3. Anti-Cheat</h2>
            <p>
              To keep the leaderboard fair, scores are checked before they are accepted:
            </p>
            <ul>
              <li>Each test is tied to a one-time signed session issued when you start typing. A score can only be submitted once, and only after the test could really have finished.</li>
              <li>The server recalculates your WPM and raw WPM from the submitted words, your typed text, and your keystroke timing, and rejects scores that do not match.</li>
              <li>Keystroke timing is checked for inhuman speed or machine-like regularity. Held-down keys and scripted (non-trusted) key events are ignored.</li>
              <li>Test words must come from the built-in word list.</li>
              <li>Submissions are rate limited per network address. We store only a one-way hash of your IP address for this, and it expires after one minute.</li>
            </ul>
            <p>
              No anti-cheat system is perfect. Entries that look fake may be removed.
            </p>
          </section>

          <section>
            <h2>4. Data Storage & Retention</h2>
            <ul>
              <li><strong>Local data:</strong> persists in your browser until you clear it</li>
              <li><strong>Leaderboard:</strong> the top 100 entries are retained; lower scores are dropped</li>
              <li><strong>Server logs:</strong> retained by Cloudflare according to its own policy</li>
            </ul>
          </section>

          <section>
            <h2>5. Third Parties</h2>
            <p>
              We use Cloudflare for hosting and DDoS protection. Cloudflare may process your IP address and connection metadata.
              Fonts are loaded from Google Fonts. No analytics trackers or advertising networks are embedded.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <ul>
              <li>Request deletion of your leaderboard entries: contact us with your display name</li>
              <li>Clear local data anytime: browser settings → clear site data</li>
              <li>Opt out of the leaderboard: simply don't submit a score</li>
            </ul>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>Questions about this policy? Open an issue on <a href="https://github.com/KATTO-GG/monkeytype" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
