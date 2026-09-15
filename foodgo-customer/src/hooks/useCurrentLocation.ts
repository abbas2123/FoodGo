import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setLocationLoading,
  setLocation,
  setPermissionDenied,
  setLocationError,
} from '@/store/slices/locationSlice';
import {
  requestForegroundPermission,
  getCurrentLocation,
} from '@/services/location/locationService';

export function useCurrentLocation(): { refetch: () => Promise<void> } {
  const dispatch = useAppDispatch();
  const latitude = useAppSelector((state) => state.location.latitude);
  const hasFetched = useRef(false);

  const fetchLocation = useCallback(async () => {
    dispatch(setLocationLoading());

    const permissionStatus = await requestForegroundPermission();

    if (permissionStatus !== 'granted') {
      dispatch(setPermissionDenied());
      return;
    }

    try {
      const result = await getCurrentLocation();
      dispatch(setLocation(result));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to get location';
      dispatch(setLocationError(message));
    }
  }, [dispatch]);

  useEffect(() => {
    if (hasFetched.current || latitude !== null) {
      return;
    }

    hasFetched.current = true;
    fetchLocation();
  }, [fetchLocation, latitude]);

  return { refetch: fetchLocation };
}
