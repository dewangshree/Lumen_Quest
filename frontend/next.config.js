/** @type {import('next').NextConfig} */
// Set GITHUB_PAGES=true to build a static export for GitHub Pages
// (served from https://dewangshree.github.io/Lumen_Quest/).
const isGithubPages = process.env.GITHUB_PAGES === 'true'
const basePath = isGithubPages ? '/Lumen_Quest' : ''

const nextConfig = {
  ...(isGithubPages && {
    output: 'export',
    basePath,
    trailingSlash: true,
  }),
  images: {
    unoptimized: isGithubPages,
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
  eslint: { ignoreDuringBuilds: true },
}

module.exports = nextConfig
