import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RoleGuardProps {
  allowedRoles?: string[];
  redirectTo?: string;
  children?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, redirectTo, children }: RoleGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: '#f7f7f7', fontFamily: 'Inter, sans-serif' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"
            style={{ borderTopColor: '#E6900E' }}
          />
          <p className="text-sm font-mono" style={{ color: '#737373' }}>
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, redirect to auth page
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Determine user role (defaults to 'rider')
  let userRole = (profile?.role || user.user_metadata?.role || 'rider').toLowerCase();
  // Normalize legacy 'student' to 'rider'
  if (userRole === 'student') userRole = 'rider';

  // If allowedRoles is specified, check role permission
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map(r => (r.toLowerCase() === 'student' ? 'rider' : r.toLowerCase()));
    const isAllowed = normalizedAllowed.includes(userRole);

    if (!isAllowed) {
      if (redirectTo) {
        return <Navigate to={redirectTo} replace />;
      }
      if (userRole === 'driver') {
        return <Navigate to="/driver" replace />;
      }
      if (userRole === 'admin') {
        return <Navigate to="/admin" replace />;
      }
      return <Navigate to="/rider" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}

interface PublicOnlyRouteProps {
  children?: React.ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: '#f7f7f7', fontFamily: 'Inter, sans-serif' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"
            style={{ borderTopColor: '#E6900E' }}
          />
          <p className="text-sm font-mono" style={{ color: '#737373' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  const searchParams = new URLSearchParams(location.search);
  const hasExplicitAuthIntent =
    searchParams.has('mode') ||
    searchParams.has('role') ||
    searchParams.has('intent') ||
    searchParams.get('force') === 'true';

  if (user && !hasExplicitAuthIntent) {
    let userRole = (profile?.role || user.user_metadata?.role || 'rider').toLowerCase();
    if (userRole === 'student') userRole = 'rider';

    if (userRole === 'driver') {
      return <Navigate to="/driver" replace />;
    }
    if (userRole === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/rider" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default RoleGuard;