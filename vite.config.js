import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { compression } from 'vite-plugin-compression2';

const CHUNK_RULES = [
  {
    name: 'vendor-react',
    test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
  },
  {
    name: 'vendor-supabase',
    test: /node_modules[\\/]@supabase[\\/]/,
  },
  {
    name: 'vendor-katex',
    test: /node_modules[\\/]katex[\\/]/,
  },
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Gzip compression for text assets (JS/CSS/HTML) → giảm ~70% kích thước transfer
    compression({
      algorithm: 'gzip',
      threshold: 1024, // chỉ compress file > 1KB
    }),
    // Brotli compression (tốt hơn gzip ~15-25%, Chrome/Firefox support)
    compression({
      algorithm: 'brotliCompress',
      threshold: 1024,
    }),
  ],
  build: {
    // Dùng esbuild minifier (nhanh hơn terser)
    minify: 'esbuild',
    // Target modern browsers để tận dụng ES2020+ features
    target: 'es2020',
    // Tăng warning threshold (pdf.worker là lớn, đây là expected)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Cache-busting: file name có hash → browser cache lâu dài
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          for (const rule of CHUNK_RULES) {
            if (rule.test.test(id)) {
              return rule.name;
            }
          }
          return undefined;
        },
      },
    },
  },
  // Tối ưu asset inline threshold: ảnh < 4KB → inline as base64
  assetsInclude: ['**/*.webp'],
});
