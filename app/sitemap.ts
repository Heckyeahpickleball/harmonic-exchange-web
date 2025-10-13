import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';
  const now = new Date().toISOString();

  // Add your stable routes here. If you have dynamic content, you can
  // fetch and map it in this function.
  const staticRoutes = [
    '',
    '/offers',
    '/requests',
    '/chapters',
    '/about',
    '/privacy',
    '/terms',
  ];

  return staticRoutes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
