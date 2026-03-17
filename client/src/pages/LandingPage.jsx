import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { startGoogleOAuth } from "../utils/api";
import "./LandingPage.css";

const FEATURES = [
  {
    icon: "📂",
    title: "List & Browse",
    desc: 'Say "list files" on WhatsApp. Get your recent Drive files instantly.',
  },
  {
    icon: "🔍",
    title: "Search Anything",
    desc: 'Type "search budget Q3" — DriveBot finds it in seconds.',
  },
  {
    icon: "⬆️",
    title: "Upload on the Go",
    desc: "Send any file to the bot. It lands in your Google Drive automatically.",
  },
  {
    icon: "🗑️",
    title: "Delete Files",
    desc: "Clean up clutter with a simple WhatsApp message. Confirmation required.",
  },
  {
    icon: "🔗",
    title: "Share with Anyone",
    desc: "Share a file with any email as reader, writer, or commenter.",
  },
  {
    icon: "📊",
    title: "File Info",
    desc: "Get size, modified date, and a direct link — without opening Drive.",
  },
];

const STEPS = [
  { step: "01", text: "Sign up with your Google account" },
  { step: "02", text: "Save the DriveBot WhatsApp number" },
  { step: "03", text: "Send any command — it just works" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCTA = () => {
    if (isAuthenticated) navigate("/dashboard");
    else navigate("/register");
  };

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">DriveBot</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <button className="nav-cta" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-grid" />
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            Now in beta — free forever
          </div>

          <h1 className="hero-title">
            Your Google Drive,
            <br />
            <span className="hero-accent">controlled by WhatsApp</span>
          </h1>

          <p className="hero-sub">
            List, search, upload, share, and delete Drive files — all from a
            WhatsApp message. No app switching. No browser tabs.
          </p>

          <div className="hero-actions">
            <button className="btn-primary" onClick={handleCTA}>
              <GoogleIcon />
              Get started free
            </button>
            <button
              className="btn-ghost"
              onClick={() =>
                document
                  .getElementById("how")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              See how it works ↓
            </button>
          </div>

          <p className="hero-note">
            No credit card · No installs · Just WhatsApp
          </p>
        </div>

        {/* Mock phone */}
        <div className="hero-phone">
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="chat-header">
                <div className="chat-avatar">🤖</div>
                <div>
                  <div className="chat-name">DriveBot</div>
                  <div className="chat-status">online</div>
                </div>
              </div>
              <div className="chat-body">
                <ChatBubble from="user" text="list files" delay="0s" />
                <ChatBubble
                  from="bot"
                  text="📂 Your recent files (5):"
                  delay="0.4s"
                />
                <ChatBubble
                  from="bot"
                  text="1. Q3 Budget.xlsx · 2.1 MB&#10;2. Project Brief.pdf · 840 KB&#10;3. Logo Final.png · 512 KB"
                  delay="0.7s"
                />
                <ChatBubble
                  from="user"
                  text="share Q3 Budget.xlsx with boss@acme.com"
                  delay="1.2s"
                />
                <ChatBubble
                  from="bot"
                  text="✅ Q3 Budget.xlsx shared with boss@acme.com as reader."
                  delay="1.6s"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features" id="features">
        <div className="section-label">What DriveBot does</div>
        <h2 className="section-title">Everything Drive, via WhatsApp</h2>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="how" id="how">
        <div className="section-label">Simple setup</div>
        <h2 className="section-title">Three steps to start</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.step}>
              <div className="step-number">{s.step}</div>
              <div className="step-text">{s.text}</div>
              {i < STEPS.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="cta-banner">
        <div className="cta-glow" />
        <h2 className="cta-title">Ready to stop switching tabs?</h2>
        <p className="cta-sub">
          Connect Google Drive to WhatsApp in under 30 seconds.
        </p>
        <button className="btn-primary btn-large" onClick={handleCTA}>
          <GoogleIcon />
          Start free with Google
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-logo">
          <span className="logo-icon">⚡</span> DriveBot
        </div>
        <p className="footer-copy">
          © {new Date().getFullYear()} DriveBot. Built with ♥ and Node.js.
        </p>
      </footer>
    </div>
  );
}

function ChatBubble({ from, text, delay }) {
  return (
    <div className={`bubble bubble-${from}`} style={{ animationDelay: delay }}>
      {text.split("\n").map((line, i) => (
        <span key={i}>
          {line}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
