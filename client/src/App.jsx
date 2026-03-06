// Fix Issue 3 — App.jsx now has proper routing including /onboarding
// which authController redirects to after Google OAuth success
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — shows Google Sign-In button */}
        <Route path="/" element={<Login />} />

        {/* Post-OAuth page — backend redirects here with ?token=...&name=...&whatsapp=... */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Catch-all — redirect unknown routes to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
