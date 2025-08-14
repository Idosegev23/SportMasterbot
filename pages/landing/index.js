import Head from 'next/head';

const CTA_URL = process.env.NEXT_PUBLIC_LANDING_CTA_URL || '#';

export default function Landing() {
  return (
    <>
      <Head>
        <title>Your Smart Telegram Football Betting Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Live predictions, mid‑game insights, daily results, promo automation, and admin tools — all in one Telegram bot." />
        <meta property="og:title" content="Your Smart Telegram Football Betting Bot" />
        <meta property="og:description" content="Live predictions, mid‑game insights, daily results, promo automation, and admin tools — all in one Telegram bot." />
        <meta property="og:type" content="website" />
      </Head>

      <main className="page">
        <section className="hero">
          <div className="hero-inner">
            <span className="badge">All‑in‑One Automation</span>
            <h1>Your Smart Telegram Football Betting Assistant</h1>
            <p className="subtitle">
              Live predictions, hour‑into‑match status, daily results, smart scheduling, inline actions, and promo coupons — designed to grow engagement automatically.
            </p>
            <div className="cta-row">
              <a className={`cta ${CTA_URL === '#' ? 'cta-disabled' : ''}`} href={CTA_URL} target={CTA_URL.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                Try the Bot
              </a>
              <a className="link" href="#how-it-works">How it works →</a>
            </div>
          </div>
          <div className="glow" aria-hidden />
        </section>

        <section className="features" id="features">
          <h2>What the bot does</h2>
          <p className="lead">Built for reliability, speed, and engagement.</p>
          <div className="grid">
            <Feature title="Live Predictions" desc="In‑play predictions with concise insights and dynamic images." icon="🔮" />
            <Feature title="Mid‑Game Live Status" desc="Automated hype updates around the 60’ mark: what’s happening now and what’s next." icon="⏱️" />
            <Feature title="Daily Results Recap" desc="Clean results summary with highlights and a share‑ready image." icon="📊" />
            <Feature title="Smart Scheduling" desc="Cron + dynamic timing by kickoff — fully automated, no manual triggers needed." icon="🧠" />
            <Feature title="Inline Actions & Coupons" desc="Inline keyboards on every post and promo codes that actually convert." icon="🎯" />
            <Feature title="Admin & Analytics" desc="Admin endpoints, cooldowns, rate limits, and click tracking ready to go." icon="🛠️" />
          </div>
        </section>

        <section className="how" id="how-it-works">
          <h2>How it works</h2>
          <div className="steps">
            <Step n="01" title="Connect & Configure" desc="Provide your Telegram bot token, channel, and preferred schedule. Optional: custom buttons and coupons." />
            <Step n="02" title="Automated Flow" desc="The system fetches fixtures, posts predictions at the right time, shares live status mid‑game, and wraps the day with results." />
            <Step n="03" title="Grow Engagement" desc="Inline CTAs, promo codes, and live imagery boost clicks and conversions — with minimal effort." />
          </div>
        </section>

        <section className="social">
          <h2>Made to be shared</h2>
          <p className="lead">Short, visual, and action‑oriented posts — optimized for Telegram consumption.</p>
          <div className="cards">
            <Card title="Crisp visuals" desc="Auto‑generated images for predictions and results make your posts stand out." />
            <Card title="Live urgency" desc="Real‑time angle drives return visits during matchdays." />
            <Card title="Frictionless CTAs" desc="Inline buttons route users to exactly where they should act — no guesswork." />
          </div>
        </section>

        <section className="faq" id="faq">
          <h2>FAQ</h2>
          <div className="qa-grid">
            <QA q="Does it require manual posting?" a="No. Everything is automated: predictions, live status, results, and promos. Manual endpoints are available when needed." />
            <QA q="Can I customize buttons and promo codes?" a="Yes. Buttons and coupons are configurable and can be updated without code changes." />
            <QA q="What about reliability?" a="Retries, cooldowns, and rate limits are built‑in. The system is production‑ready." />
          </div>
          <div className="cta-row center">
            <a className={`cta ${CTA_URL === '#' ? 'cta-disabled' : ''}`} href={CTA_URL} target={CTA_URL.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              Get Started
            </a>
          </div>
        </section>

        <footer className="footer">
          <span>© {new Date().getFullYear()} Smart Telegram Betting Bot</span>
        </footer>
      </main>

      <style jsx>{`
        :global(html, body, #__next) {
          height: 100%;
          background: #0b0f1a;
          color: #e7ecf2;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }
        .page { display: flex; flex-direction: column; gap: 80px; }
        .hero {
          position: relative;
          padding: 120px 24px 80px;
          text-align: center;
          overflow: hidden;
          background: radial-gradient(1200px 600px at 50% -20%, rgba(64, 142, 255, 0.25), transparent 60%);
        }
        .glow {
          position: absolute; inset: -20%;
          background: radial-gradient(900px 500px at 70% 10%, rgba(255, 102, 153, 0.18), transparent 60%);
          pointer-events: none;
        }
        .hero-inner { max-width: 980px; margin: 0 auto; position: relative; z-index: 1; }
        .badge {
          display: inline-block; margin-bottom: 16px; padding: 6px 12px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
          color: #9fc6ff; background: rgba(64,142,255,.12); border: 1px solid rgba(64,142,255,.35); border-radius: 999px;
        }
        h1 { font-size: clamp(32px, 6vw, 56px); line-height: 1.1; margin: 0 0 16px; }
        .subtitle { font-size: clamp(16px, 2.4vw, 20px); opacity: .9; margin: 0 auto 28px; max-width: 820px; }
        .cta-row { display: flex; gap: 16px; justify-content: center; align-items: center; flex-wrap: wrap; }
        .cta { background: linear-gradient(135deg, #6aa6ff, #3c86ff); color: #0b0f1a; padding: 14px 22px; border-radius: 10px; font-weight: 700; text-decoration: none; }
        .cta:hover { filter: brightness(1.05); }
        .cta-disabled { opacity: .6; pointer-events: none; }
        .link { color: #9fc6ff; text-decoration: none; }
        .link:hover { text-decoration: underline; }

        .features { padding: 0 24px; }
        .features h2, .how h2, .social h2, .faq h2 { text-align: center; font-size: clamp(24px, 4.5vw, 36px); margin: 0 0 12px; }
        .lead { text-align: center; opacity: .85; margin: 0 auto 28px; max-width: 680px; }
        .grid { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 16px; max-width: 1100px; margin: 0 auto; }
        @media (min-width: 720px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        .feature {
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.04));
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px; padding: 20px; min-height: 150px;
        }
        .feature h3 { margin: 12px 0 8px; font-size: 18px; }
        .feature p { margin: 0; opacity: .9; }
        .icon { font-size: 22px; opacity: .95; }

        .how { padding: 0 24px; }
        .steps { display: grid; gap: 16px; max-width: 1100px; margin: 0 auto; grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 900px) { .steps { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .step { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 22px; }
        .step .n { font-weight: 800; color: #9fc6ff; letter-spacing: .1em; font-size: 12px; }
        .step h3 { margin: 8px 0 8px; }
        .step p { margin: 0; opacity: .9; }

        .social { padding: 0 24px; }
        .cards { display: grid; gap: 16px; max-width: 1100px; margin: 0 auto; grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 900px) { .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 22px; }
        .card h3 { margin: 8px 0 8px; }
        .card p { margin: 0; opacity: .9; }

        .faq { padding: 0 24px; }
        .qa-grid { display: grid; gap: 16px; max-width: 1000px; margin: 0 auto 12px; grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 900px) { .qa-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .qa { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 18px; }
        .qa .q { font-weight: 700; margin-bottom: 6px; }
        .qa .a { opacity: .9; }

        .footer { text-align: center; padding: 40px 24px 60px; opacity: .7; font-size: 14px; }
      `}</style>
    </>
  );
}

function Feature({ title, desc, icon }) {
  return (
    <div className="feature">
      <div className="icon" aria-hidden>{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <style jsx>{`
        .feature { display: flex; flex-direction: column; gap: 6px; }
      `}</style>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className="step">
      <div className="n">STEP {n}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function Card({ title, desc }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function QA({ q, a }) {
  return (
    <div className="qa">
      <div className="q">{q}</div>
      <div className="a">{a}</div>
    </div>
  );
}

