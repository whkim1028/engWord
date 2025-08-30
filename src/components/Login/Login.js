import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { notifySuccess, notifyError } from "../../utils/notification";

function Login() {
  const [isSignUp, setIsSignUp] = useState(false); // 로그인/회원가입 모드 전환
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [invitationCode, setInvitationCode] = useState(""); // 초대코드
  const navigate = useNavigate();

  // 모드 전환 핸들러 (상태 초기화 포함)
  const handleSwitchToSignUp = (e) => {
    e.preventDefault();
    setIsSignUp(true);
    setPassword("");
    setInvitationCode("");
    setPrivacyAgreed(false);
    // email/userName은 유지해도 UX상 편리
  };

  const handleSwitchToLogin = (e) => {
    e.preventDefault();
    setIsSignUp(false);
    setPassword("");
    setInvitationCode("");
    setPrivacyAgreed(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // userName으로 사용자 조회
      const { data: userData, error: userError } = await supabase
        .from("User")
        .select("email, adminYn")
        .eq("userName", userName)
        .single();

      if (userError || !userData) {
        throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      }

      // supabase auth는 email로 로그인
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password,
      });
      if (authError) throw authError;

      navigate("/word", { state: { isAdmin: userData.adminYn } });
    } catch (error) {
      notifyError(error.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!privacyAgreed) {
      notifyError("개인정보 제공에 동의해야 회원가입이 가능합니다.");
      return;
    }
    if (invitationCode !== "RoyTantan") {
      notifyError("초대코드가 올바르지 않습니다.");
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            userName,
            privacy_agreed: true,
          },
        },
      });
      if (authError) throw authError;
      if (!authData.user)
        throw new Error("회원가입 후 사용자 정보를 확인할 수 없습니다.");

      const { error: userInsertError } = await supabase.from("User").insert([
        {
          id: authData.user.id,
          userName,
          email,
          adminYn: false,
        },
      ]);
      if (userInsertError) throw userInsertError;

      notifySuccess("회원가입이 완료되었습니다.");
      // 로그인 폼으로 전환 + 가입 관련 필드 초기화
      setIsSignUp(false);
      setInvitationCode("");
      setPrivacyAgreed(false);
      setPassword("");
    } catch (error) {
      notifyError(error.message);
    }
  };

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      <header className="bg-primary text-white text-center py-5">
        <div className="container">
          <i className="bi bi-book-half" style={{ fontSize: "3rem" }}></i>
          <h1 className="display-4 fw-bold mt-2">로이의 탄탄토익</h1>
          <p className="lead text-white">
            당신의 토익 점수를 탄탄하게 만들어 드립니다.
          </p>
        </div>
      </header>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-5">
            <div className="card border-0 shadow-lg my-5 login-card">
              <div className="card-body p-5">
                <h3 className="card-title text-center mb-4 fw-bold">
                  {isSignUp ? "회원가입" : "로그인"}
                </h3>

                <form onSubmit={isSignUp ? handleSignUp : handleLogin}>
                  {/* 회원가입 전용 필드: 아이디 + 초대코드 + 동의 */}
                  {isSignUp && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="userNameInput" className="form-label">
                          아이디
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="userNameInput"
                          placeholder="사용할 아이디를 입력하세요"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* 공용 필드(이메일/아이디, 비밀번호) */}
                  <div className="mb-3">
                    <label htmlFor="emailInput" className="form-label">
                      {isSignUp ? "이메일" : "아이디"}
                    </label>
                    <input
                      type={isSignUp ? "email" : "text"}
                      className="form-control"
                      id="emailInput"
                      placeholder={
                        isSignUp
                          ? "이메일 주소를 입력하세요"
                          : "아이디를 입력하세요"
                      }
                      value={isSignUp ? email : userName}
                      onChange={
                        isSignUp
                          ? (e) => setEmail(e.target.value)
                          : (e) => setUserName(e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="passwordInput" className="form-label">
                      비밀번호
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="passwordInput"
                      placeholder="비밀번호를 입력하세요"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {isSignUp && (
                    <div className="mb-3">
                      <label htmlFor="invitationCode" className="form-label">
                        초대코드
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="invitationCode"
                        placeholder="초대코드를 입력하세요"
                        value={invitationCode}
                        onChange={(e) => setInvitationCode(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {/* 회원가입 시에만 보이는 개인정보 동의 */}
                  {isSignUp && (
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="privacyCheck"
                        checked={privacyAgreed}
                        onChange={(e) => setPrivacyAgreed(e.target.checked)}
                      />
                      <label
                        className="form-check-label"
                        htmlFor="privacyCheck"
                      >
                        개인정보 제공에 동의합니다.
                      </label>
                    </div>
                  )}

                  <div className="d-grid">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSignUp && !privacyAgreed}
                    >
                      {isSignUp ? "회원가입" : "로그인"}
                    </button>
                  </div>
                </form>

                {/* 모드 전환 링크 */}
                <div className="text-center mt-3">
                  {isSignUp ? (
                    <a href="#" onClick={handleSwitchToLogin}>
                      이미 계정이 있으신가요? 로그인
                    </a>
                  ) : (
                    <a href="#" onClick={handleSwitchToSignUp}>
                      계정이 없으신가요? 회원가입
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
