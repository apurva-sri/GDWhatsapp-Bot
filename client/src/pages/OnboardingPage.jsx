import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/authContext";
import "./OnboardingPage.css";

const STEPS = [
  {
    id: "connected",
    icon: "✅",
    title: "Google Drive connected",
    desc: "Your account is linked and ready.",
  },
  {
    id: "save-number",
    icon: "📱",
    title: "Save the WhatsApp number",
    desc: (num) => `Add this number to your contacts:\n${num}`,
    action: true,
  },
  {
    id: "send-hi",
    icon: "👋",
    title: 'Send "hi" on WhatsApp',
    desc: "Start a chat — DriveBot will greet you and walk you through commands.",
  },
];

export default function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const { saveAuth, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 = loading, 1-3 = steps, 4 = done
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

  // ── Parse JWT from URL on mount ──────────────────────────────
  useEffect(() => {
    const token = searchParams.get("token");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const picture = searchParams.get("picture");
    const whatsapp = searchParams.get("whatsapp");

    if (!token) {
      const err = searchParams.get("error");
      if (err === "access_denied") {
        setError("You cancelled the Google sign-in. Please try again.");
      } else if (err === "no_refresh_token") {
        setError("Session issue with Google. Please sign in again.");
      } else if (isAuthenticated) {
        // Already logged in — skip straight to steps
        setStep(1);
        return;
      } else {
        navigate("/login", { replace: true });
        return;
      }
      return;
    }

    const user = { name, email, picture, whatsapp };
    saveAuth(token, user);
    setUserData(user);

    // Animate through loading → step 1
    setTimeout(() => setStep(1), 800);
  }, []);

  const handleGoToDashboard = () => navigate("/dashboard", { replace: true });
  const handleOpenWhatsApp = () => {
    const num = userData?.whatsapp?.replace("whatsapp:", "");
    if (num) window.open(`https://wa.me/${num.replace("+", "")}`, "_blank");
  };

  // ── Error state ──────────────────────────────────────────────
  if (error)
    return (
      <div className="onboarding-page">
        <OrbBg />
        <div className="onboarding-card error-card">
          <div className="error-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button
            className="ob-btn ob-btn-primary"
            onClick={() => navigate("/login")}
          >
            Try again
          </button>
        </div>
      </div>
    );

  // ── Loading splash ───────────────────────────────────────────
  if (step === 0)
    return (
      <div className="onboarding-page">
        <OrbBg />
        <div className="ob-loading">
          <div className="ob-spinner" />
          <p className="ob-loading-text">Connecting your account…</p>
        </div>
      </div>
    );

  return (
    <div className="onboarding-page">
      <OrbBg />

      <div className="onboarding-card">
        {/* Header */}
        <div className="ob-header">
          <div className="ob-avatar">
            {userData?.picture ? (
              <img
                src={userData.picture}
                alt={userData.name}
                className="ob-avatar-img"
              />
            ) : (
              <span>👤</span>
            )}
            <span className="ob-avatar-check">✓</span>
          </div>
          <h1 className="ob-welcome">
            Welcome{userData?.name ? `, ${userData.name.split(" ")[0]}` : ""}!
            🎉
          </h1>
          <p className="ob-welcome-sub">
            You're all set. Here's how to get started with DriveBot:
          </p>
        </div>

        {/* Steps */}
        <div className="ob-steps">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`ob-step ${step > i ? "ob-step-done" : ""} ${step === i + 1 ? "ob-step-active" : ""}`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="ob-step-icon">{s.icon}</div>
              <div className="ob-step-body">
                <div className="ob-step-title">{s.title}</div>
                <div className="ob-step-desc">
                  {typeof s.desc === "function"
                    ? s.desc(
                        userData?.whatsapp ||
                          process.env.REACT_APP_TWILIO_NUMBER ||
                          "+1 (415) 523-8886",
                      )
                    : s.desc}
                </div>
                {s.action && (
                  <button
                    className="ob-btn ob-btn-wa"
                    onClick={handleOpenWhatsApp}
                  >
                    <WAIcon /> Open WhatsApp
                  </button>
                )}
              </div>
              {i < STEPS.length - 1 && <div className="ob-step-connector" />}
            </div>
          ))}
        </div>

        {/* Commands preview */}
        <div className="ob-commands">
          <div className="ob-commands-title">Commands you can use:</div>
          <div className="ob-commands-grid">
            {[
              ["list", "See recent files"],
              ["search [name]", "Find a file"],
              ["upload", "Upload a file"],
              ["delete [name]", "Trash a file"],
              ["share [name]", "Share with email"],
              ["info [name]", "File details"],
            ].map(([cmd, desc]) => (
              <div className="ob-cmd" key={cmd}>
                <code className="ob-cmd-code">{cmd}</code>
                <span className="ob-cmd-desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          className="ob-btn ob-btn-primary ob-cta"
          onClick={handleGoToDashboard}
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}

function OrbBg() {
  return (
    <div className="ob-bg">
      <div className="ob-orb ob-orb-a" />
      <div className="ob-orb ob-orb-b" />
    </div>
  );
}

function WAIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.533 5.854L.054 23.389a.75.75 0 0 0 .918.919l5.577-1.463A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.728 9.728 0 0 1-5.012-1.386l-.36-.213-3.729.978.997-3.645-.234-.374A9.719 9.719 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
    </svg>
  );
}
