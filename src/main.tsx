import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthProvider";
import { DataProvider } from "./context/DataProvider";
import { ToastProvider } from "./context/ToastProvider";
import { AppRouter } from "./router/AppRouter";
import "./index.css";

// document.getElementById("splash")?.remove();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <AppRouter />
            <Analytics />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
