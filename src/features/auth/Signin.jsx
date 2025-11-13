import React, { useEffect, useState } from "react";
import { Shield, Mail, Lock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import "./Authentication.css";

const THEME = "#3BB44A";

export default function Signin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // form & field errors
  const [formError, setFormError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // password reveal
  const [showPassword, setShowPassword] = useState(false);

  // already signed in? go to /admin
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) navigate("/admin", { replace: true });
    });
    return unsub;
  }, [navigate]);

  // reveal handlers (mouse + touch)
  const startReveal = () => setShowPassword(true);
  const stopReveal = () => setShowPassword(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setFormError("Enter your work email and password to continue.");
      return;
    }

    // clear old errors
    setFormError("");
    setPasswordError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/admin", { replace: true });
    } catch (err) {
      // map common Firebase Auth errors to a friendly field error
      const code = err?.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setPasswordError("Incorrect email or password.");
      } else if (code === "auth/too-many-requests") {
        setPasswordError("Too many attempts. Try again later.");
      } else if (code === "auth/network-request-failed") {
        setPasswordError("Network error. Check your connection.");
      } else {
        setPasswordError("Unable to sign in. Please try again.");
      }
      console.error(err);
    }
  };

  return (
    <div className="login-root">
      <div className="login-shell">
        {/* Left section */}
        <section className="login-left">
          <div className="login-logo-mark" style={{ borderColor: THEME }}>
            <div
              className="login-logo-dot"
              style={{ backgroundColor: THEME }}
            />
          </div>
          <h1 className="login-brand">Entrix Admin</h1>
          <p className="login-label">Secure property admin access</p>
        </section>

        {/* Right section */}
        <section className="login-right">
          <div className="login-card">
            <div className="login-card-header">
              <div
                className="login-card-icon"
                style={{ backgroundColor: THEME }}
              >
                <Shield size={18} />
              </div>
              <div>
                <h2 className="login-title">Sign in</h2>
                <p className="login-subtitle">
                  Use your assigned admin credentials.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {/* Email */}
              <div className="form-field">
                <label className="field-label">Work Email</label>
                <div className="field-input-wrap">
                  <Mail size={14} className="field-icon" />
                  <input
                    type="email"
                    className="field-input"
                    placeholder="you@company.com"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // clear global error when user edits fields
                      if (formError) setFormError("");
                    }}
                    style={{ paddingLeft: "28px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-field">
                <label className="field-label">Password</label>
                <div className="field-input-wrap">
                  <Lock size={14} className="field-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="field-input"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    style={{ paddingLeft: "28px", paddingRight: "36px" }}
                    aria-invalid={passwordError ? "true" : "false"}
                    aria-describedby={
                      passwordError ? "password-error" : undefined
                    }
                  />

                  {/* Press & hold to reveal */}
                  <button
                    type="button"
                    className="reveal-btn"
                    aria-label="Hold to show password"
                    onMouseDown={startReveal}
                    onMouseUp={stopReveal}
                    onMouseLeave={stopReveal}
                    onTouchStart={startReveal}
                    onTouchEnd={stopReveal}
                  >
                    <Eye size={16} />
                  </button>
                </div>

                {/* field-level error */}
                {passwordError && (
                  <div
                    id="password-error"
                    className="error-text"
                    style={{ marginTop: 4 }}
                  >
                    {passwordError}
                  </div>
                )}
              </div>

              {/* top-level form error (missing fields, etc.) */}
              {formError && <div className="error-text">{formError}</div>}

              <button type="submit" className="login-button">
                Sign in
              </button>

              <div className="login-meta">
                Access to properties is based on your admin assignment.
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
