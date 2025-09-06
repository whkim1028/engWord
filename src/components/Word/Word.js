// src/components/Word/Word.js
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "../../supabaseClient";
import FlipCard from "./FlipCard";
import { notifySuccess, notifyError } from "../../utils/notification";

const COMPLETED_WORDS_STORAGE_KEY = "completedWords";
const PAGE_SIZE = 20;
const SEED_STORAGE_KEY = "randomSeed";

function Word() {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;
  const fileInputRef = useRef(null);

  // 세션 동안 고정되는 시드(새로고침 시 유지, 탭 닫으면 초기화)
  const [seed] = useState(() => {
    const saved = sessionStorage.getItem(SEED_STORAGE_KEY);
    if (saved) return saved;
    const s = Math.random().toString(36).slice(2);
    sessionStorage.setItem(SEED_STORAGE_KEY, s);
    return s;
  });

  // 렌더링 목록(누적), 로딩 상태, 페이지, 더 불러올 수 있는지
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Div / Category 필터
  const [divs, setDivs] = useState([]);
  const [selectedDiv, setSelectedDiv] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // 완료 단어(로컬스토리지)
  const getCompletedIds = () =>
    JSON.parse(localStorage.getItem(COMPLETED_WORDS_STORAGE_KEY)) || [];

  const fetchDivs = async () => {
    try {
      const { data, error } = await supabase.from("Word").select("div");
      if (error) throw error;
      const distinctDivs = [
        ...new Set(data.map((item) => item.div).filter(Boolean)),
      ];
      setDivs(distinctDivs.sort());
    } catch (e) {
      notifyError(`Div 목록 로딩 실패: ${e.message}`);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from("Word").select("category");
      if (error) throw error;
      const distinctCategories = [
        ...new Set(data.map((item) => item.category).filter(Boolean)),
      ];
      setCategories(distinctCategories.sort());
    } catch (e) {
      notifyError(`Category 목록 로딩 실패: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchDivs();
    fetchCategories();
  }, []);

  useEffect(() => {
    resetAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiv, selectedCategory]);

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
   * 서버(RPC)에서 랜덤 정렬된 페이지 데이터를 가져옴
   * - useYn=true
   * - 완료단어 제외(서버에서 필터링)
   * - limit+1 트릭으로 hasMore 판정
   */
  const fetchPage = async (pageIndex) => {
    const from = pageIndex * PAGE_SIZE;

    const completed = getCompletedIds();
    const { data, error } = await supabase.rpc("get_words_random", {
      _seed: seed,
      _limit: PAGE_SIZE + 1,
      _offset: from,
      _completed_ids: completed,
      _div: selectedDiv || null,
      _category: selectedCategory || null,
    });
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return { items, hasMore };
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
    setWords((currentWords) =>
      currentWords.filter((word) => word.id !== wordId)
    );
  };

  // ✅ 수정된 업로드: 기존 데이터 전부 삭제 후, 엑셀의 데이터만 인서트
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (
      !window.confirm(
        "현재 Word 테이블의 모든 데이터를 삭제하고, 업로드 파일의 데이터로 재생성합니다. 계속할까요?"
      )
    ) {
      event.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // 1) 엑셀 파싱
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 파일 헤더 순서: engWord, korWord, etc, div, category
        const rawRows = XLSX.utils.sheet_to_json(worksheet, {
          header: ["engWord", "korWord", "etc", "div", "category"],
          skipHeader: true,
        });

        if (!rawRows.length) throw new Error("엑셀 파일에 데이터가 없습니다.");

        // 2) 정규화 + 파일 내부 중복 제거(engWord 기준, 대소문자 무시)
        const seen = new Set();
        const prepared = rawRows
          .map((r) => ({
            engWord: (r.engWord ?? "").toString().trim(),
            korWord: (r.korWord ?? "").toString().trim(),
            etc: (r.etc ?? "").toString().trim(),
            div: r.div ? r.div.toString().trim() : null,
            category: r.category ? r.category.toString().trim() : null,
            useYn: true, // 조회 조건과 일치하도록 명시
          }))
          .filter((r) => r.engWord.length > 0)
          .filter((r) => {
            const key = r.engWord.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

        if (!prepared.length)
          throw new Error("유효한 단어(engWord)가 없습니다.");

        // 3) 기존 데이터 전체 삭제
        const { error: delError } = await supabase
          .from("Word")
          .delete()
          .not("id", "is", null); // 모든 행 삭제
        if (delError) throw delError;

        // 4) 대량 인서트(청크)
        const chunkSize = 1000;
        const chunks = [];
        for (let i = 0; i < prepared.length; i += chunkSize) {
          chunks.push(prepared.slice(i, i + chunkSize));
        }
        for (const chunk of chunks) {
          const { error: insertError } = await supabase
            .from("Word")
            .insert(chunk);
          if (insertError) throw insertError;
        }

        // 5) 완료 단어 로컬 스토리지 초기화 (ID 재생성되므로)
        localStorage.removeItem(COMPLETED_WORDS_STORAGE_KEY);

        notifySuccess(
          `총 ${prepared.length.toLocaleString()}개의 단어가 재생성되었습니다.`
        );

        // 6) 필터 리프레시 + 목록 재조회
        await fetchDivs();
        await fetchCategories();
        await resetAndLoad();
      } catch (error) {
        notifyError(`업로드 실패: ${error.message}`);
      } finally {
        event.target.value = null;
      }
    };

    reader.readAsArrayBuffer(file);
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

      {/* 필터 섹션 */}
      <div className="card card-body bg-light mb-4">
        <div className="col-md-6">
          <label htmlFor="category-filter" className="form-label">
            단어장
          </label>
          <select
            id="category-filter"
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">전체</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="row g-3">
          <div className="col-md-6">
            <label htmlFor="div-filter" className="form-label">
              Day
            </label>
            <select
              id="div-filter"
              className="form-select"
              value={selectedDiv}
              onChange={(e) => setSelectedDiv(e.target.value)}
            >
              <option value="">전체</option>
              {divs.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
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
