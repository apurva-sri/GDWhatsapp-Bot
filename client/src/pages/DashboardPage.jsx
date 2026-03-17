import React,{ useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import {
  listFiles,
  searchFiles,
  deleteFile,
  shareFile,
  getStats,
  getHistory,
} from "../utils/api";
import "./DashboardPage.css";

// ── Tab IDs ────────────────────────────────────────────────────
const TABS = ["files", "history", "stats", "settings"];

export default function DashboardPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("files");
  const [sidebarOpen, setSidebar] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="dash">
      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">⚡</span>
          <span className="sidebar-brand">DriveBot</span>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: "files", icon: "📂", label: "My Files" },
            { id: "history", icon: "🕑", label: "History" },
            { id: "stats", icon: "📊", label: "Stats" },
            { id: "settings", icon: "⚙️", label: "Settings" },
          ].map((item) => (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? "nav-item-active" : ""}`}
              onClick={() => {
                setTab(item.id);
                setSidebar(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">👤</div>
            )}
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Overlay for mobile ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebar(false)} />
      )}

      {/* ── Main ── */}
      <main className="dash-main">
        {/* Topbar */}
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebar((v) => !v)}>
            <span />
            <span />
            <span />
          </button>
          <h1 className="topbar-title">
            {tab === "files"
              ? "My Files"
              : tab === "history"
                ? "Command History"
                : tab === "stats"
                  ? "Usage Stats"
                  : "Settings"}
          </h1>
          <div className="topbar-right">
            <div className="wa-badge">
              <WADot />
              <span>WhatsApp active</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="dash-content">
          {tab === "files" && <FilesTab token={token} />}
          {tab === "history" && <HistoryTab token={token} />}
          {tab === "stats" && <StatsTab token={token} />}
          {tab === "settings" && (
            <SettingsTab user={user} token={token} onLogout={handleLogout} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILES TAB
══════════════════════════════════════════════════════════════ */
function FilesTab({ token }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [shareModal, setShareModal] = useState(null); // { fileId, fileName }
  const [deleteModal, setDeleteModal] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFiles(token);
      setFiles(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return fetchFiles();
    setSearching(true);
    setError(null);
    try {
      const res = await searchFiles(token, query);
      setFiles(res.data?.files || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await deleteFile(token, fileId);
      setFiles((f) => f.filter((x) => x.id !== fileId));
      setDeleteModal(null);
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  if (loading) return <TabLoader />;

  return (
    <div className="files-tab">
      {/* Search bar */}
      <form className="search-bar" onSubmit={handleSearch}>
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          placeholder="Search your Drive files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => {
              setQuery("");
              fetchFiles();
            }}
          >
            ✕
          </button>
        )}
        <button type="submit" className="search-submit" disabled={searching}>
          {searching ? "…" : "Search"}
        </button>
      </form>

      {error && <ErrorBanner msg={error} onRetry={fetchFiles} />}

      {!error && files.length === 0 && (
        <EmptyState
          icon="📂"
          title="No files found"
          desc="Your Drive is empty, or no results matched your search."
        />
      )}

      {/* Files grid */}
      <div className="files-grid">
        {files.map((file, i) => (
          <FileCard
            key={file.id}
            file={file}
            style={{ animationDelay: `${i * 0.04}s` }}
            onShare={() =>
              setShareModal({ fileId: file.id, fileName: file.name })
            }
            onDelete={() => setDeleteModal(file)}
          />
        ))}
      </div>

      {/* Share modal */}
      {shareModal && (
        <ShareModal
          token={token}
          fileId={shareModal.fileId}
          fileName={shareModal.fileName}
          onClose={() => setShareModal(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteModal && (
        <ConfirmModal
          title="Move to Trash?"
          desc={`"${deleteModal.name}" will be moved to your Google Drive trash.`}
          confirmLabel="Move to Trash"
          danger
          onConfirm={() => handleDelete(deleteModal.id)}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}

function FileCard({ file, style, onShare, onDelete }) {
  const ext = getExt(file.mimeType, file.name);
  const size = file.size ? formatSize(parseInt(file.size)) : "—";
  const mod = file.modifiedTime
    ? new Date(file.modifiedTime).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="file-card" style={style}>
      <div className="file-icon-wrap">
        <div className="file-icon" style={{ background: extColor(ext) }}>
          {extEmoji(ext)}
        </div>
      </div>
      <div className="file-info">
        <div className="file-name" title={file.name}>
          {file.name}
        </div>
        <div className="file-meta">
          {size} · {mod}
        </div>
      </div>
      <div className="file-actions">
        {file.webViewLink && (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="file-action"
            title="Open in Drive"
          >
            🔗
          </a>
        )}
        <button className="file-action" title="Share" onClick={onShare}>
          📤
        </button>
        <button
          className="file-action file-action-danger"
          title="Delete"
          onClick={onDelete}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HISTORY TAB
══════════════════════════════════════════════════════════════ */
function HistoryTab({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getHistory(token);
        setLogs(res.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token]);

  if (loading) return <TabLoader />;
  if (error) return <ErrorBanner msg={error} />;

  if (logs.length === 0)
    return (
      <EmptyState
        icon="🕑"
        title="No history yet"
        desc="Your WhatsApp commands will appear here."
      />
    );

  return (
    <div className="history-list">
      {logs.map((log, i) => (
        <div
          className="history-item"
          key={log._id}
          style={{ animationDelay: `${i * 0.03}s` }}
        >
          <div
            className={`history-status status-${log.status}`}
            title={log.status}
          />
          <div className="history-main">
            <div className="history-command">
              {log.rawMessage || log.command}
            </div>
            {log.responseMessage && (
              <div className="history-response">{log.responseMessage}</div>
            )}
          </div>
          <div className="history-meta">
            <span className="history-cmd-badge">{log.command}</span>
            <span className="history-time">
              {new Date(log.createdAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATS TAB
══════════════════════════════════════════════════════════════ */
function StatsTab({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getStats(token);
        setStats(res.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token]);

  if (loading) return <TabLoader />;
  if (error) return <ErrorBanner msg={error} />;
  if (!stats) return null;

  const cards = [
    { label: "Total Commands", value: stats.totalLogged || 0, icon: "⌨️" },
    { label: "Files Uploaded", value: stats.totalUploads || 0, icon: "⬆️" },
    { label: "Files Deleted", value: stats.totalDeletes || 0, icon: "🗑️" },
    { label: "Files Shared", value: stats.totalShares || 0, icon: "🔗" },
    { label: "Failed Commands", value: stats.failedCommands || 0, icon: "⚠️" },
    {
      label: "Member Since",
      value: new Date(stats.memberSince).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      icon: "🗓️",
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c, i) => (
        <div
          className="stat-card"
          key={c.label}
          style={{ animationDelay: `${i * 0.07}s` }}
        >
          <div className="stat-icon">{c.icon}</div>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════════════════════════════ */
function SettingsTab({ user, token, onLogout }) {
  const [deactivating, setDeactivating] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const navigate = useNavigate();

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const { deactivateAcc } = await import("../utils/api");
      await deactivateAcc(token);
      onLogout();
    } catch (e) {
      alert("Failed to deactivate: " + e.message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="settings-page">
      {/* Profile section */}
      <section className="settings-section">
        <h2 className="settings-section-title">Profile</h2>
        <div className="settings-profile">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="settings-avatar"
            />
          ) : (
            <div className="settings-avatar-ph">👤</div>
          )}
          <div>
            <div className="settings-name">{user?.name}</div>
            <div className="settings-email">{user?.email}</div>
          </div>
        </div>
      </section>

      {/* WhatsApp section */}
      <section className="settings-section">
        <h2 className="settings-section-title">WhatsApp Bot</h2>
        <div className="settings-info-box">
          <div className="settings-info-row">
            <span className="settings-info-label">Bot Number</span>
            <span className="settings-info-val">
              {user?.whatsapp || "Configured on server"}
            </span>
          </div>
          <div className="settings-info-row">
            <span className="settings-info-label">Available Commands</span>
            <span className="settings-info-val">
              list · search · upload · delete · share · info · help
            </span>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="settings-section danger-zone">
        <h2 className="settings-section-title settings-danger-title">
          Danger Zone
        </h2>
        <div className="settings-danger-box">
          <div>
            <div className="settings-danger-label">Deactivate Account</div>
            <div className="settings-danger-desc">
              This will disconnect Google Drive and disable WhatsApp access.
              Your Drive files are not deleted.
            </div>
          </div>
          <button
            className="settings-danger-btn"
            onClick={() => setShowDeactivate(true)}
          >
            Deactivate
          </button>
        </div>
      </section>

      {showDeactivate && (
        <ConfirmModal
          title="Deactivate account?"
          desc="Your DriveBot access will be disabled. Your Google Drive files remain untouched."
          confirmLabel={deactivating ? "Deactivating…" : "Yes, deactivate"}
          danger
          onConfirm={handleDeactivate}
          onClose={() => setShowDeactivate(false)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */
function ShareModal({ token, fileId, fileName, onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reader");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await shareFile(token, fileId, { email: email.trim(), role });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h2 className="modal-title">Share File</h2>
        <p className="modal-desc">
          Sharing: <strong>{fileName}</strong>
        </p>

        {done ? (
          <div className="modal-success">
            <div className="modal-success-icon">✅</div>
            <p>
              Shared with <strong>{email}</strong> as <em>{role}</em>.
            </p>
            <button className="modal-btn modal-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-field">
              <label className="modal-label">Email address</label>
              <input
                className="modal-input"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Permission</label>
              <select
                className="modal-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="reader">Reader (can view)</option>
                <option value="commenter">Commenter (can comment)</option>
                <option value="writer">Writer (can edit)</option>
              </select>
            </div>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn-ghost"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn modal-btn-primary"
                disabled={loading}
              >
                {loading ? "Sharing…" : "Share"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  desc,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-desc">{desc}</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`modal-btn ${danger ? "modal-btn-danger" : "modal-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabLoader() {
  return (
    <div className="tab-loader">
      {[...Array(6)].map((_, i) => (
        <div
          className="skeleton-card"
          key={i}
          style={{ animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </div>
  );
}

function ErrorBanner({ msg, onRetry }) {
  return (
    <div className="error-banner">
      <span>⚠️ {msg}</span>
      {onRetry && (
        <button className="error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-desc">{desc}</p>
    </div>
  );
}

function WADot() {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--wa-green)",
        display: "inline-block",
        animation: "pulse-glow 2s ease-in-out infinite",
        boxShadow: "0 0 6px var(--wa-green)",
      }}
    />
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */
function getExt(mime = "", name = "") {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("spreadsheet") || name.endsWith(".xlsx")) return "xlsx";
  if (mime.includes("document") || name.endsWith(".docx")) return "docx";
  if (mime.includes("presentation")) return "pptx";
  if (mime.includes("image")) return "img";
  if (mime.includes("video")) return "vid";
  if (mime.includes("audio")) return "aud";
  if (mime.includes("zip")) return "zip";
  return "file";
}

function extEmoji(ext) {
  return (
    {
      pdf: "📄",
      xlsx: "📊",
      docx: "📝",
      pptx: "📋",
      img: "🖼️",
      vid: "🎬",
      aud: "🎵",
      zip: "📦",
      file: "📁",
    }[ext] || "📁"
  );
}

function extColor(ext) {
  return (
    {
      pdf: "rgba(234,67,53,0.15)",
      xlsx: "rgba(52,168,83,0.15)",
      docx: "rgba(66,133,244,0.15)",
      pptx: "rgba(251,188,5,0.15)",
      img: "rgba(155,81,224,0.15)",
      vid: "rgba(0,172,193,0.15)",
      aud: "rgba(255,145,0,0.15)",
      zip: "rgba(255,255,255,0.06)",
    }[ext] || "rgba(255,255,255,0.06)"
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
