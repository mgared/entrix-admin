// src/features/auth/RequireAuth.jsx
// Protects routes: only renders children if user is signed in.

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }) {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="login-root">
        <div className="login-shell">
          <div className="login-loading">Checking session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
