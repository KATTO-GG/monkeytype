import { useEffect } from 'react'

export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy - MonkeyType'
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="logo">MonkeyType</div>
        <nav className="header-controls">
          <a href="/" className="mode-btn">← Back</a>
        </nav>
      </header>
      <main className="main">
        <div className="privacy-container">
          <h1>Privacy Policy</h1>
          <p className="last-updated">Last updated: November 2026</p>

          <section>
            <h2>1. Data We Collect</h2>
            <p>
              MonkeyType collects minimal data to provide the typing test service:
            </p>
            <ul>
              <li><strong>Typing statistics:</strong> WPM, accuracy, raw WPM, consistency, and error count — stored locally in your browser (localStorage) for leaderboard functionality.</li>
              <li><strong>Leaderboard entries:</strong> When you submit a score, we store your display name, WPM, accuracy, and timestamp on our backend.</li>
              <li><strong>Technical data:</strong> IP address (for rate limiting), user agent, and request timestamps — standard web server logs.</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Data</h2>
            <ul>
              <li>Display your personal bests and progress</li>
              <li>Power the global leaderboard</li>
              <li>Prevent abuse (rate limiting, bot detection)</li>
              <li>Improve the service (anonymous aggregated analytics)</li>
            </ul>
          </section>

          <section>
            <h2>3. Data Storage & Retention</h2>
            <ul>
              <li><strong>Local data:</strong> Typing stats persist in your browser until you clear them</li>
              <li><strong>Leaderboard:</strong> Top 1000 entries retained; older entries purged periodically</li>
              <li><strong>Server logs:</strong> Retained for 30 days, then deleted</li>
            </ul>
          </section>

          <section>
            <h2>4. Third Parties</h2>
            <p>
              We use Cloudflare for hosting and DDoS protection. Cloudflare may process your IP address and connection metadata.
              No analytics trackers, advertising networks, or third-party scripts are embedded.
            </p>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <ul>
              <li>Request deletion of your leaderboard entries: contact us with your display name</li>
              <li>Clear local data anytime: browser settings → clear site data</li>
              <li>Opt out of leaderboard: simply don't submit a score</li>
            </ul>
          </section>

          <section>
            <h2>6. Contact</h2>
            <p>Questions about this policy? Open an issue on <a href="https://github.com/spenc/ape-type" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}