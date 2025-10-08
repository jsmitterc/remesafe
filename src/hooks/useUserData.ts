import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginUser } from '@/lib/database';

export function useUserData() {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<LoginUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setUserData(null);
      return;
    }

    const fetchUserData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the Firebase ID token
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/user/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else if (response.status === 404) {
          setUserData(null);
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to fetch user data');
        }
      } catch (err) {
        setError('Network error occurred');
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  return { userData, loading, error };
}