import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
      // Redirect authenticated users to dashboard
      const userRole = session?.user?.role;
      
      if (userRole === 'super_admin') {
        router.replace('/super-admin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    } else {
      // Redirect unauthenticated users to signin
      router.replace('/auth/signin');
    }
  }, [status, session, router]);

  // Show loading state while redirecting
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#065F46' }}>
          Redirecting...
        </div>
      </div>
    </div>
  );
}
