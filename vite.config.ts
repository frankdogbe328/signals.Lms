import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        adminLogin: 'admin/login.html',
        adminDashboard: 'admin/dashboard.html',
        studentLogin: 'student/login.html',
        studentRegister: 'student/register.html',
        studentDashboard: 'student/dashboard.html',
        lecturerLogin: 'lecturer/login.html',
        lecturerRegister: 'lecturer/register.html',
        lecturerDashboard: 'lecturer/dashboard.html',
      },
    },
  },
});
