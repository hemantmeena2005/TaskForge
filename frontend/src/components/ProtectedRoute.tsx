import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    if (user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        // Token invalid -> interceptor handles refresh/logout
      })
      .finally(() => setLoading(false));
  }, [accessToken, user, setUser]);

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
