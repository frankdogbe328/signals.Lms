// vite.config.ts
import { defineConfig } from "file:///D:/signals.Lms-main/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig({
  root: ".",
  server: {
    port: 3e3,
    open: true,
    host: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        adminLogin: "admin/login.html",
        adminDashboard: "admin/dashboard.html",
        studentLogin: "student/login.html",
        studentRegister: "student/register.html",
        studentDashboard: "student/dashboard.html",
        lecturerLogin: "lecturer/login.html",
        lecturerRegister: "lecturer/register.html",
        lecturerDashboard: "lecturer/dashboard.html"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzaWduYWxzLkxtcy1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxzaWduYWxzLkxtcy1tYWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9zaWduYWxzLkxtcy1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHJvb3Q6ICcuJyxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgICBvcGVuOiB0cnVlLFxuICAgIGhvc3Q6IHRydWUsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgbWFpbjogJ2luZGV4Lmh0bWwnLFxuICAgICAgICBhZG1pbkxvZ2luOiAnYWRtaW4vbG9naW4uaHRtbCcsXG4gICAgICAgIGFkbWluRGFzaGJvYXJkOiAnYWRtaW4vZGFzaGJvYXJkLmh0bWwnLFxuICAgICAgICBzdHVkZW50TG9naW46ICdzdHVkZW50L2xvZ2luLmh0bWwnLFxuICAgICAgICBzdHVkZW50UmVnaXN0ZXI6ICdzdHVkZW50L3JlZ2lzdGVyLmh0bWwnLFxuICAgICAgICBzdHVkZW50RGFzaGJvYXJkOiAnc3R1ZGVudC9kYXNoYm9hcmQuaHRtbCcsXG4gICAgICAgIGxlY3R1cmVyTG9naW46ICdsZWN0dXJlci9sb2dpbi5odG1sJyxcbiAgICAgICAgbGVjdHVyZXJSZWdpc3RlcjogJ2xlY3R1cmVyL3JlZ2lzdGVyLmh0bWwnLFxuICAgICAgICBsZWN0dXJlckRhc2hib2FyZDogJ2xlY3R1cmVyL2Rhc2hib2FyZC5odG1sJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErTyxTQUFTLG9CQUFvQjtBQUU1USxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osZ0JBQWdCO0FBQUEsUUFDaEIsY0FBYztBQUFBLFFBQ2QsaUJBQWlCO0FBQUEsUUFDakIsa0JBQWtCO0FBQUEsUUFDbEIsZUFBZTtBQUFBLFFBQ2Ysa0JBQWtCO0FBQUEsUUFDbEIsbUJBQW1CO0FBQUEsTUFDckI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
