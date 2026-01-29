import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Shared = lazy(() => import('./pages/Shared'));
const Delegate = lazy(() => import('./pages/Delegate'));

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-bg text-text">
          <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/share" element={<Shared />} />
              <Route path="/delegate" element={<Delegate />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
