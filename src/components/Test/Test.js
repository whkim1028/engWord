import React, { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import * as XLSX from "xlsx";
import { notifySuccess, notifyError } from "../../utils/notification";

function Test() {
  const [version, setVersion] = useState("");
  const [existingVersions, setExistingVersions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [newQuestion, setNewQuestion] = useState({ question: "", etc: "" });
  const [newAnswer, setNewAnswer] = useState({
    answer: "",
    correctYn: false,
    etc: "",
  });

  const fileInputRef = useRef(null);
  const answerFileInputRef = useRef(null);

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase.from("Question").select("version");
      if (error) throw error;
      const uniqueVersions = [
        ...new Set(data.map((item) => item.version)),
      ].sort();
      setExistingVersions(uniqueVersions);
    } catch (error) {
      notifyError("기존 버전 목록을 불러오는 데 실패했습니다.");
    }
  };

  const handleVersionSelect = async (selectedVersion) => {
    setVersion(selectedVersion);
    setSelectedQuestion(null);
    setAnswers([]);
    if (!selectedVersion) {
      setQuestions([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("Question")
        .select("id, question, etc")
        .eq("version", selectedVersion);
      if (error) throw error;
      setQuestions(data);
      notifySuccess(
        `'${selectedVersion}' 버전의 문제 ${data.length}개를 불러왔습니다.`
      );
    } catch (error) {
      notifyError("문제 목록을 불러오는 데 실패했습니다.");
    }
  };

  const handleQuestionSelect = async (question) => {
    setSelectedQuestion(question);
    try {
      const { data, error } = await supabase
        .from("Answer")
        .select("*")
        .eq("questionId", question.id);
      if (error) throw error;
      setAnswers(data);
    } catch (error) {
      notifyError("보기 목록을 불러오는 데 실패했습니다.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleExcelUpload(file, "question");
  };

  const handleAnswerFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleExcelUpload(file, "answer");
  };

  const handleUploadClick = () => fileInputRef.current.click();
  const handleAnswerUploadClick = () => answerFileInputRef.current.click();

  const handleExcelUpload = useCallback(
    async (file, type) => {
      if (!file) return;
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          if (json.length === 0) {
            notifyError("엑셀 파일에 데이터가 없습니다.");
            return;
          }

          if (type === "question") {
            const requiredFields = ["question", "etc"];
            if (
              !requiredFields.every((field) => json[0].hasOwnProperty(field))
            ) {
              notifyError(
                `엑셀 파일에 필수 필드(${requiredFields.join(
                  ", "
                )})가 없습니다.`
              );
              return;
            }
            setQuestions((prev) => [...prev, ...json]);
            notifySuccess(`${json.length}개의 문제를 목록에 추가했습니다.`);
          } else if (type === "answer") {
            if (!selectedQuestion) {
              notifyError("보기를 추가할 문제를 먼저 선택해주세요.");
              return;
            }
            const requiredFields = ["answer", "correctYn", "etc"];
            if (
              !requiredFields.every((field) => json[0].hasOwnProperty(field))
            ) {
              notifyError(
                `엑셀 파일에 필수 필드(${requiredFields.join(
                  ", "
                )})가 없습니다.`
              );
              return;
            }
            const answersToInsert = json.map((item) => ({
              ...item,
              questionId: selectedQuestion.id,
            }));
            const { data: insertedData, error } = await supabase
              .from("Answer")
              .insert(answersToInsert)
              .select();
            if (error) throw error;
            setAnswers((prev) => [...prev, ...insertedData]);
            notifySuccess(`${insertedData.length}개의 보기를 추가했습니다.`);
          }
        } catch (error) {
          notifyError(`파일 처리 중 오류: ${error.message}`);
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (answerFileInputRef.current) answerFileInputRef.current.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [selectedQuestion]
  );

  const handleSave = async () => {
    if (!version) {
      notifyError("버전을 입력하거나 선택해주세요.");
      return;
    }
    if (questions.length === 0) {
      notifyError("저장할 문제가 없습니다.");
      return;
    }
    try {
      await supabase.from("Question").delete().eq("version", version);
      const dataToInsert = questions.map(({ question, etc }) => ({
        question,
        etc,
        version,
      }));
      const { error } = await supabase.from("Question").insert(dataToInsert);
      if (error) throw error;
      notifySuccess(
        `'${version}' 버전의 시험 문제가 성공적으로 저장되었습니다.`
      );
      if (!existingVersions.includes(version)) {
        setExistingVersions((prev) => [...prev, version].sort());
      }
      handleVersionSelect(version); // Re-fetch questions with IDs
    } catch (error) {
      notifyError(`저장 중 오류: ${error.message}`);
    }
  };

  const handleAddAnswer = async () => {
    if (!selectedQuestion) {
      notifyError("문제를 먼저 선택해주세요.");
      return;
    }
    if (!newAnswer.answer) {
      notifyError("답변 내용을 입력해주세요.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("Answer")
        .insert([{ ...newAnswer, questionId: selectedQuestion.id }])
        .select();
      if (error) throw error;
      setAnswers([...answers, ...data]);
      setNewAnswer({ answer: "", correctYn: false, etc: "" });
      notifySuccess("보기가 추가되었습니다.");
    } catch (error) {
      notifyError(`보기 추가 중 오류: ${error.message}`);
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    try {
      const { error } = await supabase
        .from("Answer")
        .delete()
        .eq("id", answerId);
      if (error) throw error;
      setAnswers(answers.filter((a) => a.id !== answerId));
      notifySuccess("보기가 삭제되었습니다.");
    } catch (error) {
      notifyError(`보기 삭제 중 오류: ${error.message}`);
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestion.question.trim()) {
      notifyError("문제 내용을 입력해주세요.");
      return;
    }
    // Using a temporary unique ID for client-side operations
    const questionToAdd = { ...newQuestion, id: `temp-${Date.now()}` };
    setQuestions([...questions, questionToAdd]);
    setNewQuestion({ question: "", etc: "" }); // Reset input
  };

  const handleDeleteQuestion = (index) => {
    const questionToDelete = questions[index];
    if (selectedQuestion && selectedQuestion.id === questionToDelete.id) {
      setSelectedQuestion(null);
      setAnswers([]);
    }
    setQuestions(questions.filter((_, i) => i !== index));
    notifySuccess("문제가 목록에서 삭제되었습니다.");
  };

  return (
    <div className="container-fluid mt-4">
      {/* Page Header */}
      <div className="mb-3">
        <h2 className="mb-0">시험 등록</h2>
      </div>

      {/* Version Bar */}
      <div className="row mb-4">
        <div className="col-12">
          <label htmlFor="version-input" className="form-label">
            버전
          </label>
          <div className="input-group">
            <input
              id="version-input"
              type="text"
              className="form-control"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="새 버전을 입력하거나 기존 버전을 선택하세요."
            />
            <select
              className="form-select"
              value={version}
              onChange={(e) => handleVersionSelect(e.target.value)}
              style={{ maxWidth: "250px" }}
            >
              <option value="">기존 버전에서 선택...</option>
              {existingVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="row">
        {/* Left Column: Questions */}
        <div className="col-md-7">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
            accept=".xlsx, .xls"
          />

          {questions.length > 0 ? (
            <div
              className="card"
              style={{ maxHeight: "70vh", overflowY: "auto" }}
            >
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">문제 목록 ({questions.length}개)</h5>
                <div>
                  <button
                    className="btn btn-secondary btn-sm me-2"
                    onClick={handleUploadClick}
                    disabled={uploading}
                  >
                    {uploading ? "업로드 중..." : "엑셀 추가"}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={!version || questions.length === 0 || uploading}
                  >
                    저장
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                <div
                  className="table-responsive"
                  style={{ maxHeight: "60vh", overflowY: "auto" }}
                >
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: "45%" }}>
                          문제
                        </th>
                        <th scope="col" style={{ width: "45%" }}>
                          부연설명
                        </th>
                        <th scope="col" style={{ width: "10%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, index) => (
                        <tr
                          key={q.id || `q-${index}`}
                          onClick={() => handleQuestionSelect(q)}
                          className={
                            selectedQuestion?.id === q.id ? "table-active" : ""
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <td>{q.question}</td>
                          <td>{q.etc}</td>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-outline-danger py-0 px-1"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row selection
                                handleDeleteQuestion(index);
                              }}
                            >
                              X
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer">
                <div className="row g-2 align-items-center">
                  <div className="col">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="새 문제 입력"
                      value={newQuestion.question}
                      onChange={(e) =>
                        setNewQuestion({
                          ...newQuestion,
                          question: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="부연 설명 (선택)"
                      value={newQuestion.etc}
                      onChange={(e) =>
                        setNewQuestion({ ...newQuestion, etc: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-auto">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={handleAddQuestion}
                    >
                      행 추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-5 border rounded bg-light">
              <h4>등록할 시험 문제가 없습니다.</h4>
              <p className="text-muted">
                버전을 선택하여 기존 문제를 불러오거나, "엑셀 추가" 버튼을
                클릭하여 새 문제를 등록해주세요.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Answers */}
        <div className="col-md-5">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">보기 등록</h5>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={handleAnswerUploadClick}
                disabled={!selectedQuestion || uploading}
              >
                {uploading ? "업로드 중..." : "보기 엑셀 업로드"}
              </button>
              <input
                type="file"
                ref={answerFileInputRef}
                onChange={handleAnswerFileChange}
                style={{ display: "none" }}
                accept=".xlsx, .xls"
              />
            </div>
            <div
              className="card-body"
              style={{ maxHeight: "70vh", overflowY: "auto" }}
            >
              {!selectedQuestion ? (
                <div className="text-center p-5">
                  <p className="text-muted">
                    왼쪽 목록에서 문제를 선택해주세요.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <strong>선택된 문제:</strong>
                    <p className="text-primary">{selectedQuestion.question}</p>
                  </div>

                  <h6>
                    보기 목록{" "}
                    <span className="text-muted">({answers.length}개)</span>
                  </h6>
                  <div
                    className="table-responsive mb-3"
                    style={{ maxHeight: "200px", overflowY: "auto" }}
                  >
                    <table className="table table-sm table-striped">
                      <thead>
                        <tr>
                          <th>답변</th>
                          <th>정답</th>
                          <th>부연설명</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {answers.map((ans) => (
                          <tr key={ans.id}>
                            <td>{ans.answer}</td>
                            <td>
                              {ans.correctYn ? (
                                <span className="badge bg-success">Y</span>
                              ) : (
                                <span className="badge bg-secondary">N</span>
                              )}
                            </td>
                            <td>{ans.etc}</td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-danger py-0 px-1"
                                onClick={() => handleDeleteAnswer(ans.id)}
                              >
                                X
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <hr />
                  <h6>새 보기 추가</h6>
                  <div className="mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={newAnswer.answer}
                      placeholder="답변 내용"
                      onChange={(e) =>
                        setNewAnswer({ ...newAnswer, answer: e.target.value })
                      }
                    />
                  </div>
                  <div className="mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={newAnswer.etc}
                      placeholder="부연 설명 (선택)"
                      onChange={(e) =>
                        setNewAnswer({ ...newAnswer, etc: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="correctYnSwitch"
                      checked={newAnswer.correctYn}
                      onChange={(e) =>
                        setNewAnswer({
                          ...newAnswer,
                          correctYn: e.target.checked,
                        })
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="correctYnSwitch"
                    >
                      정답
                    </label>
                  </div>
                  <button
                    className="btn btn-primary w-100"
                    onClick={handleAddAnswer}
                  >
                    보기 추가
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Test;
