/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Export pages as dir/index.html. Without this, /gallery exports as
  // gallery.html while public/gallery/ (photo assets) becomes an index-less
  // out/gallery/ directory — nginx's try_files hits that directory and
  // returns 403 for direct visits to /gallery/.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
