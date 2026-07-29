import type { NextConfig } from "next";

const isStaticExport = process.env.VINEXT_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
};

export default nextConfig;
