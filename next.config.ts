import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // 런타임 마이그레이션용 SQL 파일을 서버 번들에 포함
  outputFileTracingIncludes: { "/**": ["./drizzle/**"] },
};

export default nextConfig;
