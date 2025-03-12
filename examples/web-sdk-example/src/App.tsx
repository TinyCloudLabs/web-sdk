import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';

import Home from './pages/Home';
import Shared from './pages/Shared';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-bg text-text">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/share" element={<Shared />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
