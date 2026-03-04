import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function Index() {
  const { session, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/welcome');
      return;
    }

    switch (role) {
      case 'customer':
        router.replace('/(customer)/bookings');
        break;
      case 'driver':
        router.replace('/(driver)/jobs');
        break;
      case 'admin':
        router.replace('/(admin)/dashboard');
        break;
      default:
        router.replace('/(auth)/welcome');
    }
  }, [loading, session, role]);

  return <LoadingScreen />;
}
