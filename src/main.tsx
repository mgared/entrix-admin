import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// @ts-nocheck
import { AuthProvider } from "./features/auth/AuthContext";
import RequireAuth from "./features/auth/RequireAuth";
import Signin from "./features/auth/Signin.jsx";
import AdminPage from "./pages/admin/page.jsx";

// import "./styles/index.css";
import "./styles/admin.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public route: sign-in */}
          <Route path="/" element={<Signin />} />

          {/* Protected route: admin dashboard */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
