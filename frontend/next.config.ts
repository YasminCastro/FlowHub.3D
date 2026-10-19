import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone com só o necessário para rodar (usado no Dockerfile).
  output: "standalone",
  // Há um package-lock.json na raiz do repositório; sem isto o Next adota a
  // raiz como workspace e observa o backend também (as fotos gravadas em
  // backend/uploads disparavam reload da página em dev).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
