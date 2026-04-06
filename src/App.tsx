import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { MatchPage } from './pages/MatchPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}

export default App;
