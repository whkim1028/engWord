// src/components/Quiz/Quiz.js
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { notifySuccess, notifyError } from "../../utils/notification";

function Quiz() {
  const [existingVersions, setExistingVersions] = useState([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState([]); // [{id, question, etc, answers: [...], shuffledAnswers: [...]}]
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState({}); // { [questionId]: answerId }
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [resultFocusQid, setResultFocusQid] = useState(null); // 결과 섹션에서 표시할 문제

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("Question")
          .select("version");
        if (error) throw error;
        const unique = [...new Set((data || []).map((d) => d.version))].sort();
        setExistingVersions(unique);
      } catch (e) {
        notifyError("버전 목록을 불러오지 못했습니다.");
      }
    })();
  }, []);

  const handleVersionSelect = async (selected) => {
    setVersion(selected);
    setSubmitted(false);
    setScore(null);
    setChoices({});
    setCurrentIndex(0);
    setResultFocusQid(null);

    if (!selected) {
      setQuestions([]);
      return;
    }

    setLoading(true);
    try {
      const { data: qs, error: qErr } = await supabase
        .from("Question")
        .select("id, question, etc")
        .eq("version", selected);

      if (qErr) throw qErr;

      const questionIds = (qs || []).map((q) => q.id);
      if (questionIds.length === 0) {
        setQuestions([]);
        notifySuccess(`'${selected}' 버전의 문제가 없습니다.`);
        return;
      }

      const { data: ans, error: aErr } = await supabase
        .from("Answer")
        .select("id, answer, correctYn, etc, questionId")
        .in("questionId", questionIds);

      if (aErr) throw aErr;

      const answersByQ = {};
      (ans || []).forEach((a) => {
        if (!answersByQ[a.questionId]) answersByQ[a.questionId] = [];
        answersByQ[a.questionId].push(a);
      });

      const shuffle = (arr) => {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      const merged = (qs || []).map((q) => {
        const list = answersByQ[q.id] || [];
        return {
          ...q,
          answers: list,
          shuffledAnswers: shuffle(list),
        };
      });

      setQuestions(merged);
      notifySuccess(
        `'${selected}' 버전의 문제 ${merged.length}개를 불러왔습니다.`
      );
    } catch (e) {
      notifyError(`문제/보기를 불러오는 중 오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const progress = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round(((currentIndex + 1) / questions.length) * 100);
  }, [currentIndex, questions.length]);

  const currentQuestion = questions[currentIndex];

  const handleChoose = (questionId, answerId) => {
    if (submitted) return;
    setChoices((prev) => ({ ...prev, [questionId]: answerId }));
  };

  const goPrev = () => currentIndex > 0 && setCurrentIndex((i) => i - 1);
  const goNext = () =>
    currentIndex < questions.length - 1 && setCurrentIndex((i) => i + 1);

  const unanswered = useMemo(
    () => questions.filter((q) => !choices[q.id]),
    [questions, choices]
  );

  const handleSubmit = () => {
    if (questions.length === 0) return;

    // 가드: 미답변 있으면 채점 불가 + 첫 미답변으로 이동
    if (unanswered.length > 0) {
      const firstUnansweredId = unanswered[0].id;
      const idx = questions.findIndex((q) => q.id === firstUnansweredId);
      if (idx >= 0) setCurrentIndex(idx);
      notifyError(`아직 선택하지 않은 문항이 ${unanswered.length}개 있습니다.`);
      return;
    }

    let correct = 0;
    for (const q of questions) {
      const picked = choices[q.id];
      const ans = q.answers.find((a) => a.id === picked);
      if (ans && ans.correctYn) correct += 1;
    }
    setScore({ correct, total: questions.length });
    setSubmitted(true);
    setResultFocusQid(questions[0]?.id || null); // 결과 기본 포커스 1번 문항
    notifySuccess("채점이 완료되었습니다.");
  };

  const handleReset = async () => {
    const v = version;
    setVersion("");
    setQuestions([]);
    setChoices({});
    setCurrentIndex(0);
    setSubmitted(false);
    setScore(null);
    setResultFocusQid(null);
    await handleVersionSelect(v); // 보기 순서 재셔플
  };

  // 제출 전에는 배경색 변화 없음
  const getChoiceClass = (q, a) => {
    if (!submitted) {
      return "list-group-item list-group-item-action d-flex align-items-start";
    }
    const picked = choices[q.id];
    const isPicked = picked === a.id;
    const isCorrect = !!a.correctYn;
    if (isCorrect && isPicked)
      return "list-group-item list-group-item-success d-flex align-items-start";
    if (!isCorrect && isPicked)
      return "list-group-item list-group-item-danger d-flex align-items-start";
    if (isCorrect && !isPicked)
      return "list-group-item d-flex align-items-start border border-success";
    return "list-group-item d-flex align-items-start";
  };

  const isQuestionCorrect = (q) => {
    const picked = choices[q.id];
    if (!picked) return false;
    const ans = q.answers.find((a) => a.id === picked);
    return !!(ans && ans.correctYn);
  };

  const resultFocusQuestion = useMemo(
    () => questions.find((q) => q.id === resultFocusQid),
    [questions, resultFocusQid]
  );

  return (
    <div className="container mt-4">
      <div className="p-4 p-md-5 mb-4 bg-primary text-white rounded-3">
        <div className="container-fluid py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="display-5 fw-bold m-0">시험 페이지</h1>
            {submitted && score && (
              <span className="badge bg-light text-primary fs-6">
                점수: {score.correct} / {score.total}
              </span>
            )}
          </div>
          <p className="fs-5 fs-md-4">
            문제를 풀고 실력을 확인해 보세요.
          </p>
        </div>
      </div>

      {/* 버전 선택 */}
      <div className="card mb-3">
        <div className="card-body p-4">
          <label className="form-label fw-semibold">버전 선택</label>
          <div className="d-flex gap-2">
            <select
              className="form-select"
              value={version}
              onChange={(e) => handleVersionSelect(e.target.value)}
              disabled={loading}
            >
              <option value="">버전을 선택하세요</option>
              {existingVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="btn btn-outline-secondary"
              onClick={() => handleVersionSelect(version)}
              disabled={!version || loading}
              title={!version ? "버전을 먼저 선택하세요" : ""}
            >
              새로고침
            </button>
          </div>
          {loading && <div className="mt-2 text-muted">불러오는 중...</div>}
        </div>
      </div>

      {/* 문제가 없을 때 */}
      {!loading && version && questions.length === 0 && (
        <div className="alert alert-info">
          이 버전에 등록된 문제가 없습니다.
        </div>
      )}

      {/* 문제 진행 UI */}
      {questions.length > 0 && (
        <>
          {/* 진행률 */}
          <div className="mb-3">
            <div className="d-flex justify-content-between">
              <small className="text-muted fw-semibold">
                {currentIndex + 1} / {questions.length}
              </small>
              <small className="text-muted fw-semibold">{progress}%</small>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* 문제 카드 */}
          <div className="card mb-5">
            <div className="card-header fw-semibold">
              <strong>문제 {currentIndex + 1}</strong>
            </div>
            <div className="card-body">
              <p className="fs-5 mb-2">{currentQuestion.question}</p>
              {currentQuestion.etc && (
                <p className="text-muted mb-3">{currentQuestion.etc}</p>
              )}

              {/* 보기 목록: 줄 배경색 유지, 라디오만 체크 */}
              <div className="list-group">
                {currentQuestion.shuffledAnswers.map((a) => (
                  <label
                    key={a.id}
                    className={getChoiceClass(currentQuestion, a) + " py-3"}
                    style={{ cursor: submitted ? "default" : "pointer" }}
                  >
                    <input
                      className="form-check-input me-2"
                      type="radio"
                      name={`q-${currentQuestion.id}`}
                      checked={choices[currentQuestion.id] === a.id}
                      onChange={() => handleChoose(currentQuestion.id, a.id)}
                      disabled={submitted}
                      style={{ marginTop: 3 }}
                    />
                    <div className="flex-grow-1">
                      <div>{a.answer}</div>
                      {/* 채점 후 정답 해설(간단 표시) */}
                      {submitted && a.correctYn && a.etc && (
                        <div className="mt-2">
                          <small className="text-success">해설: {a.etc}</small>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* 미답변 안내(제출 전) */}
              {!submitted && unanswered.length > 0 && (
                <div className="mt-3 small text-muted">
                  미답변: {unanswered.length}문항
                </div>
              )}
            </div>
          </div>

          {/* 하단 내비게이션(모바일 sticky) */}
          <div
            className="bg-light shadow-sm border-top py-2 px-2 d-flex gap-2"
            style={{ position: "sticky", bottom: 0, zIndex: 10 }}
          >
            <button
              className="btn btn-outline-secondary w-25"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              이전
            </button>
            <button
              className="btn btn-outline-secondary w-25"
              onClick={goNext}
              disabled={currentIndex === questions.length - 1}
            >
              다음
            </button>
            {!submitted ? (
              <button
                className="btn btn-primary w-50"
                onClick={handleSubmit}
                disabled={
                  questions.length === 0 ||
                  Object.keys(choices).length !== questions.length
                }
                title={
                  Object.keys(choices).length !== questions.length
                    ? "모든 문항에 답해야 채점할 수 있어요"
                    : ""
                }
              >
                채점하기
              </button>
            ) : (
              <button
                className="btn btn-success w-50"
                onClick={handleReset}
                disabled={!version}
              >
                다시 풀기
              </button>
            )}
          </div>

          {/* 제출 후 결과/해설 섹션 */}
          {submitted && score && (
            <div className="card mt-3 mb-5">
              <div className="card-body">
                <h5 className="card-title fw-semibold">결과</h5>
                <p className="card-text mb-3">
                  총 <strong>{questions.length}</strong>문항 중{" "}
                  <strong className="text-primary">{score.correct}</strong>개
                  정답
                </p>

                <div className="row g-3">
                  {/* 좌: 문제 리스트 */}
                  <div className="col-12 col-md-6">
                    <div className="mb-2 fw-bold">문제 리스트</div>
                    <div className="list-group">
                      {questions.map((q, idx) => {
                        const correct = isQuestionCorrect(q);
                        const active = q.id === resultFocusQid;
                        return (
                          <button
                            key={q.id}
                            className={
                              "list-group-item d-flex justify-content-between align-items-center py-2 " +
                              (active ? "border border-primary" : "")
                            }
                            onClick={() => setResultFocusQid(q.id)}
                            style={{ textAlign: "left", minHeight: 48 }}
                          >
                            <span className="me-2">
                              {idx + 1}. {q.question}
                            </span>
                            <span
                              className={
                                "badge " +
                                (correct ? "bg-success" : "bg-danger")
                              }
                            >
                              {correct ? "정답" : "오답"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 우: 문제 해설 + 보기 해설 */}
                  <div className="col-12 col-md-6">
                    <div className="mb-2 fw-bold">문제 해설</div>
                    <div className="border rounded p-3 mb-3 bg-light">
                      {resultFocusQuestion ? (
                        <>
                          <div className="mb-2">
                            <div className="small text-muted">문제</div>
                            <div className="fw-semibold">
                              {resultFocusQuestion.question}
                            </div>
                          </div>
                          <div>
                            <div className="small text-muted">해설</div>
                            <div>
                              {resultFocusQuestion.etc
                                ? resultFocusQuestion.etc
                                : "해설이 없습니다."}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-muted">
                          좌측에서 문제를 선택하세요.
                        </div>
                      )}
                    </div>

                    <div className="mb-2 fw-semibold">보기 해설</div>
                    <div className="border rounded p-3 bg-light">
                      {resultFocusQuestion ? (
                        resultFocusQuestion.answers.length > 0 ? (
                          <ul className="list-unstyled mb-0">
                            {resultFocusQuestion.answers.map((a) => {
                              const picked =
                                choices[resultFocusQuestion.id] === a.id;
                              return (
                                <li key={a.id} className="mb-2">
                                  <div className="d-flex align-items-center">
                                    <span className="badge badge-pill me-2">
                                      {a.correctYn ? "정답" : "보기"}
                                    </span>
                                    <span className="fw-semibold">
                                      {a.answer}
                                    </span>
                                    {picked && (
                                      <span className="badge bg-primary ms-2">
                                        내 선택
                                      </span>
                                    )}
                                  </div>
                                  <div className="small text-muted mt-1">
                                    {a.etc ? a.etc : "해설이 없습니다."}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="text-muted">
                            등록된 보기가 없습니다.
                          </div>
                        )
                      ) : (
                        <div className="text-muted">
                          좌측에서 문제를 선택하세요.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-end">
                  <button
                    className="btn btn-success"
                    onClick={handleReset}
                    disabled={!version}
                  >
                    다시 풀기
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Quiz;
