import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
    test: /node_modules[\\/](katex|react-katex)[\\/]/,
  },
  {
    name: 'vendor-icons',
    test: /node_modules[\\/]lucide-react[\\/]/,
  },
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          const matchedRule = CHUNK_RULES.find((rule) => rule.test.test(id));
          return matchedRule?.name;
        },
      },
    },
  },
});
