'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@/server/router';

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  const [trpcClient] = useState(() => createTRPCClient<AppRouter>({ links: [httpLink({ url: '/api/trpc' })] }));
  return <QueryClientProvider client={queryClient}>
    <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>{children}</TRPCProvider>
  </QueryClientProvider>;
}
