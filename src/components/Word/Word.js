// src/components/Word/Word.js
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../../supabaseClient";
import FlipCard from "./FlipCard";
import { notifySuccess, notifyError } from "../../utils/notification";

const COMPLETED_WORDS_STORAGE_KEY = "completedWords";
const PAGE_SIZE = 20;

function Word() {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;
  const fileInputRef = useRef(null);

  // 렌더링 목록(누적), 로딩 상태, 페이지, 더 불러올 수 있는지
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // 완료 단어(로컬스토리지)
  const getCompletedIds = () =>
    JSON.parse(localStorage.getItem(COMPLETED_WORDS_STORAGE_KEY)) || [];

  useEffect(() => {
    // 최초 1페이지 로드
    resetAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAndLoad = async () => {
    setLoading(true);
    setWords([]);
    setPage(0);
    setHasMore(true);
    try {
      const first = await fetchPage(0);
      setWords(first.items);
      setHasMore(first.hasMore);
      setPage(1);
    } catch (e) {
      notifyError(`단어 로딩 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 특정 페이지 데이터를 서버에서 20개 가져와서,
   * useYn=true + 완료단어 제외 필터링을 적용해 반환
   * @param {number} pageIndex 0-based
   * @returns {{items: Array, hasMore: boolean}}
   */
  const fetchPage = async (pageIndex) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // 서버에서 페이지 단위로 가져오기
    const { data, error } = await supabase
      .from("Word")
      .select("*")
      .eq("useYn", true)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;

    const completed = new Set(getCompletedIds());
    const filtered = (data || []).filter((w) => !completed.has(w.id));

    // 다음 페이지가 더 있는지 대략 판단(이번에 PAGE_SIZE개를 받았는지 기준)
    const hasMore = (data || []).length === PAGE_SIZE;
    return { items: filtered, hasMore };
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchPage(page);
      setWords((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
      setPage((p) => p + 1);
    } catch (e) {
      notifyError(`추가 로딩 실패: ${e.message}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleComplete = (wordId) => {
    const completedWords = getCompletedIds();
    const newCompletedWords = [...completedWords, wordId];
    localStorage.setItem(
      COMPLETED_WORDS_STORAGE_KEY,
      JSON.stringify(newCompletedWords)
    );
    // 현재 화면에서도 제거
    setWords((currentWords) =>
      currentWords.filter((word) => word.id !== wordId)
    );
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: ["engWord", "korWord", "etc"],
          skipHeader: true,
        });

        if (jsonData.length === 0)
          throw new Error("엑셀 파일에 데이터가 없습니다.");

        // (간단/안전) 전체 engWord 가져와서 중복 제거
        // 데이터가 수천 개 규모라면 이 방식으로도 충분히 동작합니다.
        const { data: existingWords, error: fetchError } = await supabase
          .from("Word")
          .select("engWord");
        if (fetchError) throw fetchError;

        const existingSet = new Set(
          (existingWords || [])
            .map((w) => w.engWord)
            .filter(Boolean)
            .map((s) => s.trim().toLowerCase())
        );

        // 업로드 대상 정규화 후 중복 스킵 (engWord 기준, 대소문자 무시)
        const newWords = jsonData
          .filter((w) => w.engWord)
          .filter(
            (w) => !existingSet.has(String(w.engWord).trim().toLowerCase())
          );

        if (newWords.length === 0) {
          notifyError("업로드할 새로운 단어가 없습니다. (모두 중복됨)");
          return;
        }

        const { error: insertError } = await supabase
          .from("Word")
          .insert(newWords);
        if (insertError) throw insertError;

        notifySuccess(
          `${newWords.length}개의 단어가 성공적으로 업로드되었습니다. (중복 제외)`
        );

        // 업로드 후 목록 초기화 & 재조회
        await resetAndLoad();
      } catch (error) {
        notifyError(`업로드 실패: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  return (
    <div className="container mt-4">
      <div className="p-4 p-md-5 mb-4 bg-primary text-white rounded-3">
        <div className="container-fluid py-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h1 className="display-5 fw-bold m-0">영단어장</h1>
            {isAdmin && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  accept=".xlsx, .xls"
                />
                <button
                  className="btn btn-outline-light"
                  onClick={triggerFileInput}
                >
                  단어 업로드
                </button>
              </>
            )}
          </div>
          <p className="fs-5 fs-md-4">
            매일 새로운 단어를 학습하며, 카드를 클릭하여 뜻을 확인해 보세요.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">단어를 불러오는 중...</p>
        </div>
      ) : (
        <>
          <div className="row">
            {words.length > 0 ? (
              words.map((word) => (
                <div
                  key={word.id}
                  className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4 d-flex align-items-stretch"
                >
                  <FlipCard
                    engWord={word.engWord}
                    korWord={word.korWord}
                    etc={word.etc}
                    onComplete={() => handleComplete(word.id)}
                  />
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="text-center p-5 bg-light rounded">
                  <h2 className="text-success">🎉</h2>
                  <h3 className="mb-3">학습 완료!</h3>
                  <p className="text-muted">
                    모든 단어 학습을 완료했습니다. 정말 대단해요!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 더 보기 */}
          {hasMore && (
            <div className="text-center mb-5">
              <button
                className="btn btn-outline-primary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "로딩 중..." : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Word;
