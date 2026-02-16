import { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Navbar from './components/navbar/Navbar'
import Landing from './pages/Landing/Landing'
import Chat from './pages/Chat/Chat'
import Videocall from './pages/Videocall/Videocall'

// Global ref to store Lenis instance
let globalLenis = null;

// Export function to pause/resume Lenis
window.pauseLenis = () => {
  if (globalLenis) globalLenis.stop();
};
window.resumeLenis = () => {
  if (globalLenis) globalLenis.start();
};

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    // Only initialize Lenis for landing page, not for chat or videocall
    if (location.pathname === '/') {
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        direction: 'vertical',
        smoothTouch: false,
      })

      globalLenis = lenis;

      // Animation frame for Lenis
      function raf(time) {
        lenis.raf(time)
        requestAnimationFrame(raf)
      }

      const rafId = requestAnimationFrame(raf)

      // Cleanup on unmount or route change
      return () => {
        cancelAnimationFrame(rafId)
        lenis.destroy()
        globalLenis = null;
      }
    }
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/" element={
        <>
          <Navbar/>
          <Landing/>
        </>
      } />
      <Route path="/chat" element={<Chat />} />
      <Route path="/videocall" element={<Videocall />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
