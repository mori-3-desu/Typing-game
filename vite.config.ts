// 'vite' ではなく 'vitest/config' から読み込むように変更してください
import { defineConfig } from 'vitest/config' 
import react from '@vitejs/plugin-react'

// これで { test: ... } と書いても怒られなくなります
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})