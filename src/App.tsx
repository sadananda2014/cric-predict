import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { MatchPage } from './pages/MatchPage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}

export default App;
