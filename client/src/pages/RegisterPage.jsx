import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { startGoogleOAuth } from "../utils/api";
import { GoogleIcon } from "./LoginPage";
import "./AuthPages.css";

const PERKS = [
  { icon: "📂", text: "List your Drive files instantly" },
  { icon: "🔍", text: "Search files from WhatsApp" },
  { icon: "⬆️", text: "Upload files by sending them" },
  { icon: "🔗", text: "Share with teammates in seconds" },
];

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div className="auth-page auth-page-register">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-a" />
        <div className="auth-orb auth-orb-b" />
        <div className="auth-dots" />
      </div>

      <Link to="/" className="auth-back">
        ← Back to home
      </Link>

      <div className="register-layout">
        {/* Left panel — perks */}
        <div className="register-left">
          <div className="auth-logo">
            <span className="logo-icon-lg">⚡</span>
            <span className="auth-brand">DriveBot</span>
          </div>
          <h2 className="register-tagline">
            Your Drive.
            <br />
            In your WhatsApp.
          </h2>
          <p className="register-tagline-sub">
            Free forever. No credit card. Setup takes 30 seconds.
          </p>
          <ul className="perks-list">
            {PERKS.map((p) => (
              <li key={p.text} className="perk-item">
                <span className="perk-icon">{p.icon}</span>
                <span className="perk-text">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right panel — sign up card */}
        <div className="auth-card register-card">
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">
            One click with Google. That's it. We never see your files or
            password.
          </p>

          <div className="google-scope-info">
            <div className="scope-title">DriveBot will be able to:</div>
            <ul className="scope-list">
              <li>✅ View and manage your Google Drive files</li>
              <li>✅ View your basic profile info</li>
              <li>🚫 We never read file contents without permission</li>
            </ul>
          </div>

          <button className="google-btn" onClick={startGoogleOAuth}>
            <GoogleIcon />
            <span>Sign up with Google</span>
          </button>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>

          <p className="auth-legal">
            By continuing you agree to our{" "}
            <a href="#" className="auth-link">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="auth-link">
              Privacy Policy
            </a>
            . We use OAuth 2.0 and never store your Google password.
          </p>
        </div>
      </div>
    </div>
  );
}
