import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("drivebot_token");
    const savedUser = localStorage.getItem("drivebot_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        clearAuth();
      }
    }
    setLoading(false);
  }, []);

  const saveAuth = useCallback((tokenVal, userData) => {
    localStorage.setItem("drivebot_token", tokenVal);
    localStorage.setItem("drivebot_user", JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem("drivebot_token");
    localStorage.removeItem("drivebot_user");
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    clearAuth();
  }, [token, clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        saveAuth,
        clearAuth,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
