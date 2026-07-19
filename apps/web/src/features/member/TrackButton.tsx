import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.js';
import { fetchListTracking, fetchTrackedLists, memberKeys, trackList, untrackList } from './api.js';
import { ProgressBar } from './components.js';

/**
 * Track/untrack control for a list page (docs/01 F7). Tracking is private and calm —
 * when tracked, it shows live progress against the list's books. Anonymous visitors
 * get a quiet sign-in nudge rather than a wall.
 */
export function TrackButton({ slug }: { slug: string }) {
  const { status, user } = useAuth();
  const isAuthed = status === 'authenticated' && Boolean(user);
  const queryClient = useQueryClient();

  const trackingQuery = useQuery({
    queryKey: memberKeys.listTracking(slug),
    queryFn: () => fetchListTracking(slug),
    enabled: isAuthed,
  });
  const trackedListsQuery = useQuery({
    queryKey: memberKeys.trackedLists,
    queryFn: fetchTrackedLists,
    enabled: isAuthed,
  });

  const tracked = trackingQuery.data?.tracked ?? false;
  const progress = trackedListsQuery.data?.find((l) => l.slug === slug)?.progress;

  const mutation = useMutation({
    mutationFn: () => (tracked ? untrackList(slug) : trackList(slug)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberKeys.listTracking(slug) });
      void queryClient.invalidateQueries({ queryKey: memberKeys.trackedLists });
    },
  });

  if (!isAuthed) {
    return (
      <p className="font-sans text-sm text-muted">
        <Link className="text-accent hover:underline" to="/login">
          Sign in
        </Link>{' '}
        to track this list and watch your progress.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <button
          type="button"
          disabled={mutation.isPending || trackingQuery.isPending}
          aria-pressed={tracked}
          onClick={() => mutation.mutate()}
          className={`rounded-md border px-4 py-1.5 font-sans text-sm transition-colors disabled:opacity-50 ${
            tracked
              ? 'border-accent bg-accent-wash text-accent'
              : 'border-accent bg-accent text-paper hover:bg-accent/90'
          }`}
        >
          {tracked ? '✓ Tracking' : 'Track this list'}
        </button>
      </div>
      {tracked && progress ? <ProgressBar progress={progress} /> : null}
    </div>
  );
}
