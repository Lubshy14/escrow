import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [verificationToken, setVerificationToken] = useState(localStorage.getItem("verificationToken"));
  const [verificationUserId, setVerificationUserId] = useState(localStorage.getItem("verificationUserId"));
  const [verificationEmail, setVerificationEmail] = useState(localStorage.getItem("verificationEmail"));

  useEffect(() => {
    // Restore normal auth session
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    }

    // Restore verification session (needed for /verify page reliability)
    // This must run even when `token` is not set (signup/login-verification flow).
    const storedVerificationToken = localStorage.getItem("verificationToken");
    const storedVerificationUserId = localStorage.getItem("verificationUserId");
    const storedVerificationEmail = localStorage.getItem("verificationEmail");

    if (storedVerificationToken) setVerificationToken(storedVerificationToken);
    if (storedVerificationUserId) setVerificationUserId(storedVerificationUserId);
    if (storedVerificationEmail) setVerificationEmail(storedVerificationEmail);
  }, []);




  const login = async (username, password) => {
    const normalizedUsername = username?.trim();
    const normalizedPassword = password?.trim();
    const { data } = await axios.post("/api/auth/login", {
      username: normalizedUsername,
      password: normalizedPassword,
    });
    
    setVerificationToken(data.verificationToken);
    setVerificationUserId(data.userId);
    setVerificationEmail(data.email);
    
    localStorage.setItem("verificationToken", data.verificationToken);
    localStorage.setItem("verificationUserId", data.userId);
    localStorage.setItem("verificationEmail", data.email);
    
    return { requiresVerification: true, userId: data.userId, email: data.email };
  };

  const register = async (name, username, password, email) => {
    const normalizedUsername = username?.trim();
    const normalizedPassword = password?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    
    const { data } = await axios.post("/api/auth/register", {
      name: name?.trim(),
      username: normalizedUsername,
      password: normalizedPassword,
      email: normalizedEmail,
    });
    
    setVerificationToken(data.verificationToken);
    setVerificationUserId(data.userId);
    setVerificationEmail(data.email);
    
    localStorage.setItem("verificationToken", data.verificationToken);
    localStorage.setItem("verificationUserId", data.userId);
    localStorage.setItem("verificationEmail", data.email);
    
    return { requiresVerification: true, userId: data.userId, email: data.email };
  };

  const verifyCode = async (code) => {
    const { data } = await axios.post("/api/auth/verify", {
      userId: verificationUserId,
      code,
    });
    
    setToken(data.token);
    setUser(data.user);
    setVerificationToken(null);
    setVerificationUserId(null);
    setVerificationEmail(null);
    
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.removeItem("verificationToken");
    localStorage.removeItem("verificationUserId");
    localStorage.removeItem("verificationEmail");
    
    axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    
    return data.user;
  };

  const resendCode = async () => {
    await axios.post("/api/auth/resend-code", {
      userId: verificationUserId,
    });
  };

  const loginWithLink = async (code) => {
    const { data } = await axios.get(`/api/link/${code}`);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setVerificationToken(null);
    setVerificationUserId(null);
    setVerificationEmail(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("verificationToken");
    localStorage.removeItem("verificationUserId");
    localStorage.removeItem("verificationEmail");
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      verificationToken,
      verificationUserId,
      verificationEmail,
      login, 
      register,
      verifyCode,
      resendCode,
      loginWithLink, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
