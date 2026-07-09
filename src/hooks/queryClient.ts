import { QueryClient } from '@tanstack/react-query';

/** Single app-wide query client. Local IndexedDB reads are fast, so we keep
 * data fresh and simply invalidate after mutations. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, refetchOnWindowFocus: false },
  },
});
