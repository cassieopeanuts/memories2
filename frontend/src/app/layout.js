import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import BetaWrapper from "@/components/BetaWrapper";

export const metadata = {
  title: "ЛегкоСохранить.РФ — Ваше личное семейное хранилище",
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
            <BetaWrapper>
              {children}
            </BetaWrapper>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
