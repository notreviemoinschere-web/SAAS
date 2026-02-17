import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "./api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("pwp_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("pwp_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
      setTenant(res.data.tenant);
      localStorage.setItem("pwp_user", JSON.stringify(res.data.user));
    } catch {
      localStorage.removeItem("pwp_token");
      localStorage.removeItem("pwp_user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("pwp_token", res.data.token);
    localStorage.setItem("pwp_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    await fetchMe();
    return res.data;
  };

  const signup = async (business_name, email, password) => {
    const res = await api.post("/auth/signup", { business_name, email, password });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("pwp_token");
    localStorage.removeItem("pwp_user");
    setUser(null);
    setTenant(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, signup, logout, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
