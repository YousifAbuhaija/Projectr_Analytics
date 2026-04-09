import { useState } from "react";

export function useLocation() {
  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLoading(false);
      },
      () => {
        setError("Permission denied or failed");
        setLoading(false);
      }
    );
  };

  return { location, loading, error, getLocation };
}
