import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { useRandomEpisodeLadder } from '../hooks/useRandomEpisodeLadder';
import { EpisodeLadderView, type EpisodeLadderPageProps } from './EpisodeLadderPage';

export function RandomEpisodeLadderPage(props: Omit<EpisodeLadderPageProps, 'selectedGameId'>) {
  const { user, session, isLoading } = useAuth();
  const [difficulty, setDifficulty] = useState(1);
  const ladder = useRandomEpisodeLadder(user?.id, session?.access_token ?? null, isLoading, difficulty);
  return <EpisodeLadderView key={`${difficulty}:${ladder.roundKey}`} {...props} selectedGameId={null} ladder={ladder}
    selectedDifficulty={difficulty} onSelectDifficulty={setDifficulty}
    onNextRandomGame={() => { void ladder.nextGame(); }} />;
}
