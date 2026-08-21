import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const EventsListPage = lazy(() => import('./features/events/EventsListPage'));
const NewEventPage = lazy(() => import('./features/events/NewEventPage'));
const EventDetailPage = lazy(() => import('./features/events/EventDetailPage'));
const ScorecardPage = lazy(() => import('./features/scorecard/ScorecardPage'));
const PlayersPage = lazy(() => import('./features/players/PlayersPage'));
const TeamsPage = lazy(() => import('./features/teams/TeamsPage'));
const CoursesPage = lazy(() => import('./features/courses/CoursesPage'));
const BigBoardPage = lazy(() => import('./features/leaderboard/BigBoardPage'));
const MyBoardRedirect = lazy(() => import('./features/leaderboard/MyBoardRedirect'));
const GamesPage = lazy(() => import('./features/games/GamesPage'));

function RouteFallback() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div className="h-full w-1/3 rounded-full bg-brand-500 animate-[loadingBar_0.9s_ease-in-out_infinite]" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<EventsListPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="events/new" element={<NewEventPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="events/:eventId/games" element={<GamesPage />} />
          <Route path="events/:eventId/matches/:matchId" element={<ScorecardPage />} />
        </Route>
        <Route path="events/:eventId/board" element={<BigBoardPage />} />
        <Route path="my/board" element={<MyBoardRedirect />} />
      </Routes>
    </Suspense>
  );
}
