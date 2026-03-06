import { useState, useEffect } from "react";

const GOOGLE_FEATURES = [
  { icon: "📁", text: "List & search your Drive files" },
  { icon: "⬆️", text: "Upload files via WhatsApp" },
  { icon: "🗑️", text: "Delete files with a command" },
  { icon: "🔗", text: "Share files instantly" },
  { icon: "🔒", text: "Encrypted token storage" },
];

const COMMANDS = [
  "list",
  "upload",
  "search report.pdf",
  "delete old.docx",
  "share file.pdf john@gmail.com",
  "help",
];

export default function Login() {
  const [cmdIndex, setCmdIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Typewriter effect for command preview
  useEffect(() => {
    const cmd = COMMANDS[cmdIndex];
    if (typing) {
      if (displayed.length < cmd.length) {
        const t = setTimeout(
          () => setDisplayed(cmd.slice(0, displayed.length + 1)),
          80,
        );
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setTyping(false), 1800);
        return () => clearTimeout(t);
      }
    } else {
      if (displayed.length > 0) {
        const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 40);
        return () => clearTimeout(t);
      } else {
        setTyping(true);
        setCmdIndex((i) => (i + 1) % COMMANDS.length);
      }
    }
  }, [displayed, typing, cmdIndex]);

  // Parallax mouse tracking
  useEffect(() => {
    const handler = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/google`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          background: #080c10;
          color: #e8edf3;
          font-family: 'Syne', sans-serif;
          overflow-x: hidden;
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          position: relative;
          overflow: hidden;
        }

        /* Ambient background blobs */
        .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.12;
          pointer-events: none;
          z-index: 0;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .blob-1 { width: 600px; height: 600px; background: #2563eb; top: -200px; left: -200px; animation-delay: 0s; }
        .blob-2 { width: 500px; height: 500px; background: #7c3aed; top: 40%; right: -150px; animation-delay: -4s; }
        .blob-3 { width: 400px; height: 400px; background: #0891b2; bottom: -100px; left: 30%; animation-delay: -8s; }

        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(30px, -20px) scale(1.05); }
        }

        /* Grid overlay */
        .grid-overlay {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* LEFT PANEL */
        .left-panel {
          position: relative; z-index: 1;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .logo {
          display: flex; align-items: center; gap: 12px;
        }
        .logo-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        .logo-text {
          font-size: 22px; font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .hero {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; padding: 40px 0;
        }

        .badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(37, 99, 235, 0.3);
          padding: 6px 14px; border-radius: 999px;
          font-size: 12px; font-weight: 600;
          color: #60a5fa; letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 28px;
          width: fit-content;
          animation: fadeUp 0.6s ease both;
        }
        .badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #60a5fa;
          animation: pulse 2s ease infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        h1 {
          font-size: clamp(40px, 5vw, 60px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -2px;
          margin-bottom: 20px;
          animation: fadeUp 0.6s ease 0.1s both;
        }
        h1 span {
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #34d399 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .subtitle {
          font-size: 17px; color: #8b99b0;
          line-height: 1.7; max-width: 420px;
          margin-bottom: 40px;
          animation: fadeUp 0.6s ease 0.2s both;
        }

        /* Terminal preview */
        .terminal {
          background: rgba(15, 20, 30, 0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 20px 24px;
          max-width: 420px;
          backdrop-filter: blur(20px);
          animation: fadeUp 0.6s ease 0.3s both;
        }
        .terminal-header {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot-r { background: #ff5f56; }
        .dot-y { background: #ffbd2e; }
        .dot-g { background: #27c93f; }
        .terminal-title {
          margin-left: auto; font-size: 11px;
          color: #4a5568; font-family: 'JetBrains Mono', monospace;
        }
        .terminal-line {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .prompt { color: #60a5fa; }
        .cmd-text { color: #e2e8f0; }
        .cursor {
          display: inline-block; width: 2px; height: 16px;
          background: #60a5fa;
          animation: blink 1s step-end infinite;
          vertical-align: middle;
        }
        @keyframes blink { 50% { opacity: 0; } }

        /* Features */
        .features {
          display: flex; flex-direction: column; gap: 10px;
          animation: fadeUp 0.6s ease 0.4s both;
        }
        .feature-item {
          display: flex; align-items: center; gap: 12px;
          font-size: 14px; color: #8b99b0;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: color 0.2s;
        }
        .feature-item:hover { color: #c7d0dc; }
        .feature-icon { font-size: 16px; }

        /* RIGHT PANEL */
        .right-panel {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 60px;
        }

        .card {
          background: rgba(13, 18, 28, 0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 52px 44px;
          width: 100%; max-width: 420px;
          backdrop-filter: blur(30px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 40px 80px rgba(0,0,0,0.5),
            0 0 100px rgba(37,99,235,0.06);
          animation: slideIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .card-icon {
          width: 64px; height: 64px;
          background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(124,58,237,0.2));
          border: 1px solid rgba(37,99,235,0.3);
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          font-size: 30px; margin-bottom: 28px;
        }

        .card h2 {
          font-size: 26px; font-weight: 800;
          letter-spacing: -0.8px;
          margin-bottom: 10px;
        }
        .card p {
          color: #6b7a8f; font-size: 15px;
          line-height: 1.6; margin-bottom: 36px;
        }

        .scope-list {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 28px;
        }
        .scope-title {
          font-size: 11px; color: #4a5568;
          text-transform: uppercase; letter-spacing: 1px;
          margin-bottom: 12px; font-weight: 600;
        }
        .scope-item {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: #8b99b0;
          padding: 5px 0;
        }
        .scope-check {
          width: 16px; height: 16px; border-radius: 50%;
          background: rgba(52, 211, 153, 0.15);
          border: 1px solid rgba(52, 211, 153, 0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; color: #34d399; flex-shrink: 0;
        }

        .google-btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center;
          gap: 12px;
          background: #fff;
          color: #1a1a2e;
          border: none; border-radius: 12px;
          padding: 16px;
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative; overflow: hidden;
          margin-bottom: 16px;
        }
        .google-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(255,255,255,0.15);
        }
        .google-btn:active { transform: translateY(0); }
        .google-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .google-logo {
          width: 20px; height: 20px;
          background: url('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg') no-repeat center;
          background-size: contain; flex-shrink: 0;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(0,0,0,0.15);
          border-top-color: #1a1a2e;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 16px; color: #2d3748; font-size: 12px;
        }
        .divider::before, .divider::after {
          content: ''; flex: 1; height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .privacy-note {
          font-size: 12px; color: #4a5568;
          text-align: center; line-height: 1.5;
        }
        .privacy-note a { color: #60a5fa; text-decoration: none; }

        /* Steps */
        .steps {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .steps-title {
          font-size: 11px; color: #4a5568;
          text-transform: uppercase; letter-spacing: 1px;
          margin-bottom: 16px; font-weight: 600;
        }
        .step {
          display: flex; gap: 14px; margin-bottom: 14px;
          align-items: flex-start;
        }
        .step-num {
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(37, 99, 235, 0.3);
          color: #60a5fa; font-size: 11px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; flex-shrink: 0; margin-top: 1px;
        }
        .step-text { font-size: 13px; color: #6b7a8f; line-height: 1.5; }
        .step-text strong { color: #a0aec0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .page { grid-template-columns: 1fr; }
          .left-panel { display: none; }
          .right-panel { padding: 30px 20px; }
        }
      `}</style>

      <div className="page">
        <div className="grid-overlay" />
        <div
          className="blob blob-1"
          style={{
            transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)`,
          }}
        />
        <div
          className="blob blob-2"
          style={{
            transform: `translate(${-mousePos.x * 0.3}px, ${-mousePos.y * 0.3}px)`,
          }}
        />
        <div
          className="blob blob-3"
          style={{
            transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px)`,
          }}
        />

        {/* LEFT */}
        <div className="left-panel">
          <div className="logo">
            <div className="logo-icon">📂</div>
            <span className="logo-text">DriveBot</span>
          </div>

          <div className="hero">
            <div className="badge">
              <div className="badge-dot" />
              Google Drive + WhatsApp
            </div>

            <h1>
              Your Drive,
              <br />
              in your <span>pocket.</span>
            </h1>

            <p className="subtitle">
              Sign in once. Get a WhatsApp number. Manage your entire Google
              Drive through simple chat commands — no app needed.
            </p>

            <div className="terminal" style={{ marginBottom: 32 }}>
              <div className="terminal-header">
                <div className="dot dot-r" />
                <div className="dot dot-y" />
                <div className="dot dot-g" />
                <span className="terminal-title">WhatsApp → DriveBot</span>
              </div>
              <div className="terminal-line">
                <span className="prompt">›</span>
                <span className="cmd-text">{displayed}</span>
                <span className="cursor" />
              </div>
            </div>

            <div className="features">
              {GOOGLE_FEATURES.map((f, i) => (
                <div
                  className="feature-item"
                  key={i}
                  style={{ animationDelay: `${0.4 + i * 0.08}s` }}
                >
                  <span className="feature-icon">{f.icon}</span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#2d3748" }}>
            © 2025 DriveBot. Not affiliated with Google or Meta.
          </div>
        </div>

        {/* RIGHT */}
        <div className="right-panel">
          <div className="card">
            <div className="card-icon">🔐</div>
            <h2>Get Started</h2>
            <p>
              Connect your Google account to get your personal WhatsApp bot
              number.
            </p>

            <div className="scope-list">
              <div className="scope-title">Permissions requested</div>
              {[
                "View and manage Drive files",
                "Read file names and metadata",
                "Access your email address",
              ].map((s, i) => (
                <div className="scope-item" key={i}>
                  <div className="scope-check">✓</div>
                  {s}
                </div>
              ))}
            </div>

            <button
              className="google-btn"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <div className="google-logo" />
              )}
              {loading ? "Connecting..." : "Continue with Google"}
            </button>

            <div className="divider">secure OAuth 2.0</div>

            <p className="privacy-note">
              Your tokens are encrypted at rest. We never store your password.{" "}
              <a href="#">Privacy Policy</a>
            </p>

            <div className="steps">
              <div className="steps-title">What happens next</div>
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-text">
                  Grant Drive permissions on Google's secure page
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-text">
                  Receive your <strong>personal WhatsApp bot number</strong>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-text">
                  Send <strong>"list"</strong> to see your Drive files
                  immediately
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
