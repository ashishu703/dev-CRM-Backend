// OPTIMIZED: Response compression middleware
// Uses compression package for Express
const compression = require('compression');

// Compression configuration
const compressionMiddleware = compression({
  // Only compress responses above 1KB
  threshold: 1024,
  // Use gzip compression
  level: 6, // Balance between compression ratio and CPU usage (1-9)
  // Filter function to decide what to compress
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Compress JSON and text responses
    const contentType = res.getHeader('content-type') || '';
    if (contentType.includes('application/json') || 
        contentType.includes('text/') ||
        contentType.includes('application/javascript')) {
      return true;
    }
    // Don't compress images, videos, or already compressed content
    if (contentType.includes('image/') || 
        contentType.includes('video/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip')) {
      return false;
    }
    // Default: compress other content types
    return true;
  }
});

module.exports = compressionMiddleware;

