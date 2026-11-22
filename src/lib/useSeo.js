import { useEffect } from 'react';

// SEO cho các trang public (SPA Vite, không dùng react-helmet).
// Cập nhật <title>, meta description và canonical theo từng trang.
export function useSeo({ title, description, path }) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
    if (path) {
      const href = `https://www.dautruonghoctap.dev${path}`;
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    }
  }, [title, description, path]);
}

export default useSeo;
