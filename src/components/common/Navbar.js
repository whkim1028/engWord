import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    } else {
      navigate('/'); // 로그아웃 후 로그인 페이지로 이동
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container">
        <NavLink className="navbar-brand" to="/word">로이의 탄탄토익</NavLink>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink className="nav-link" to="/word">단어장</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/quiz">시험</NavLink>
            </li>
          </ul>
          <button className="btn btn-outline-primary" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
