import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import People from './pages/People.jsx';
import Groups from './pages/Groups.jsx';
import Doors from './pages/Doors.jsx';
import Devices from './pages/Devices.jsx';
import Logs from './pages/Logs.jsx';
import Audit from './pages/Audit.jsx';
import SettingsPage from './pages/Settings.jsx';
import Remote from './pages/Remote.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function Toasts() {
  const { theme } = useTheme();
  return (
    <Toaster position="top-right" toastOptions={{
      duration: 3500,
      style: {
        borderRadius: 2, fontSize: 14, boxShadow: 'none',
        ...(theme === 'dark' ? { background: '#171717', color: '#f5f5f5', border: '1px solid #404040' } : { background: '#fff', color: '#171717', border: '1px solid #d4d4d4' }),
      },
      success: { iconTheme: { primary: '#15803d', secondary: '#fff' } },
      error: { iconTheme: { primary: '#b91c1c', secondary: '#fff' } },
    }} />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Toasts />
      <Routes>
        <Route path="/abrir" element={<Remote />} />
        <Route path="*" element={
          <AuthProvider>
            <ConfirmProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Protected />}>
                  <Route index element={<Dashboard />} />
                  <Route path="personas" element={<People />} />
                  <Route path="grupos" element={<Groups />} />
                  <Route path="puertas" element={<Doors />} />
                  <Route path="dispositivos" element={<Devices />} />
                  <Route path="registros" element={<Logs />} />
                  <Route path="auditoria" element={<Audit />} />
                  <Route path="configuracion" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ConfirmProvider>
          </AuthProvider>
        } />
      </Routes>
    </ThemeProvider>
  );
}
