import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // IPv4-адрес явно: при включённом VPN (TUN) петля ::1 может не отвечать
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
