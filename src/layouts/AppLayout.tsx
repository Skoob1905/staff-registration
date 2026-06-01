import { Outlet } from "react-router-dom";
import { Navbar } from "../components/ui";
import { Footer } from "../components/Footer";

export const AppLayout = () => (
  <div className="flex min-h-screen flex-col app-bg">
    <Navbar />
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3 sm:py-6">
      <Outlet />
    </main>
    <Footer />
  </div>
);
