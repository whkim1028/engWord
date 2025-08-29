import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

function Login() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      // 1. 사용자 이름으로 User 테이블에서 이메일과 관리자 여부 조회
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('email, adminYn')
        .eq('userName', id)
        .single();

      if (userError || !userData) {
        // 여기서 에러가 나면 RLS 정책 또는 User 테이블의 데이터 문제일 가능성이 높습니다.
        throw new Error('사용자 정보를 찾는 데 실패했습니다. RLS 정책을 확인하세요.');
      }

      // 2. 조회된 이메일로 로그인 시도
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (authError) {
        // 여기서 에러가 나면 Supabase 인증 관련 문제입니다.
        throw authError;
      }

      // 3. 로그인 성공 시 adminYn 값과 함께 /word 페이지로 이동
      navigate('/word', { state: { isAdmin: userData.adminYn } });

    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="container vh-100 d-flex justify-content-center align-items-center">
      <div className="card p-4" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="card-body">
          <h3 className="card-title text-center mb-4">로그인</h3>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="idInput" className="form-label">아이디</label>
              <input 
                type="text" 
                className="form-control" 
                id="idInput" 
                placeholder="아이디를 입력하세요" 
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="passwordInput" className="form-label">비밀번호</label>
              <input 
                type="password" 
                className="form-control" 
                id="passwordInput" 
                placeholder="비밀번호를 입력하세요" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="d-grid">
              <button type="submit" className="btn btn-primary">로그인</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
