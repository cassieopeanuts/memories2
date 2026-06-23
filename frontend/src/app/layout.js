import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata = {
  title: "ЛегкоСохранить.РФ — Ваше личное семейное облако",
  description: "Безопасное хранилище для ваших семейных фото и видеоархивов с сохранением оригинального качества.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
