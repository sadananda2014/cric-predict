import { Link } from 'react-router-dom';
import { MatchList } from '../components/MatchList/MatchList';

export function HomePage() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Link to="/dashboard" style={{ fontSize: '0.8rem' }}>📊 Dashboard</Link>
        <Link to="/settings" style={{ fontSize: '0.8rem' }}>⚙️ Settings</Link>
      </div>
      <MatchList />
    </>
  );
}
