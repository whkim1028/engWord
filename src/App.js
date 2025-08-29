import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login/Login';
import Word from './components/Word/Word';
import Quiz from './components/Quiz/Quiz';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/word" element={<Word />} />
          <Route path="/quiz" element={<Quiz />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
