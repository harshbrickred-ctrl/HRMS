import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchDirectory, type DirectoryPerson } from '@/lib/hrApi';

export function useDirectory() {
  const { user } = useAuth();
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDirectory()
      .then((rows) => {
        if (cancelled) return;
        setPeople(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the directory.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const me = people.find((person) => person.email.toLowerCase() === user?.email?.toLowerCase());
  return { people, me, loading, error };
}
