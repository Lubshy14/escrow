import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn("Failed to parse stored user", error);
      }
    }
    return null;
  });

  const [token, setToken] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const persistSession = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    return data.user;
  }, []);

  const login = useCallback(async (username, password) => {
    const normalizedUsername = username?.trim();
    const normalizedPassword = password?.trim();
    const { data } = await axios.post("/api/auth/login", {
      username: normalizedUsername,
      password: normalizedPassword,
    });

    return persistSession(data);
  }, [persistSession]);

  const register = useCallback(async (name, username, password, email, inviteCode) => {
    const normalizedUsername = username?.trim();
    const normalizedPassword = password?.trim();
    const normalizedEmail = email?.trim().toLowerCase();

    const { data } = await axios.post("/api/auth/register", {
      name: name?.trim(),
      username: normalizedUsername,
      password: normalizedPassword,
      email: normalizedEmail,
      inviteCode,
    });

    return persistSession(data);
  }, [persistSession]);

  const loginWithLink = useCallback(async (code) => {
    const { data } = await axios.get(`/api/link/${code}`);
    return persistSession(data);
  }, [persistSession]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    login,
    register,
    loginWithLink,
    logout,
  }), [user, token, login, register, loginWithLink, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
