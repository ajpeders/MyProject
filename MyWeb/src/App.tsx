import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./tools/HomePage";
import MailPage from "./tools/mail/MailPage";
import SearchPage from "./tools/search/SearchPage";
import ChatPage from "./tools/chat/ChatPage";
import MemoryPage from "./tools/memory/MemoryPage";
import MyAgentPage from "./tools/myagent/MyAgentPage";
import NewsPage from "./tools/news/NewsPage";
import CalendarPage from "./tools/calendar/CalendarPage";
import DevTeamPage from "./tools/devteam/DevTeamPage";
import AdminPage from "./tools/admin/AdminPage";
import LoginPage from "./tools/LoginPage";
import SettingsPage from "./tools/SettingsPage";
import WhisperPage from "./tools/whisper/WhisperPage";
import { isAuthenticated, isAdmin } from "./api/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  return isAdmin() ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/mail" element={<MailPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/myagent" element={<MyAgentPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/devteam" element={<DevTeamPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/whisper" element={<WhisperPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
