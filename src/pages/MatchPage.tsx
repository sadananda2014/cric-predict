import { useParams, Navigate } from 'react-router-dom';
import { useMatchStore } from '../store/matchStore';
import { MatchDetail } from '../components/MatchDetail/MatchDetail';

export function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const match = useMatchStore((s) => (id ? s.matches[id] : undefined));

  if (!match) {
    return <Navigate to="/" replace />;
  }

  return <MatchDetail match={match} />;
}
