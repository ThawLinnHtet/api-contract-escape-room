import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
};
export default config;
