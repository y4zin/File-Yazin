/* STYLE: Amethyst Control Room — the application defaults to a stable low-glare workspace. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "@/pages/Home";

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" richColors position="bottom-center" /><Home /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
