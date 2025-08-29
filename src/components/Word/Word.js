import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import FlipCard from './FlipCard';

const COMPLETED_WORDS_STORAGE_KEY = 'completedWords';

function Word() {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;
  const fileInputRef = useRef(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWords();
  }, []);

  const fetchWords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Word')
        .select('*')
        .eq('useYn', true);

      if (error) throw error;

      const completedWords = JSON.parse(localStorage.getItem(COMPLETED_WORDS_STORAGE_KEY)) || [];
      const filteredWords = data.filter(word => !completedWords.includes(word.id));
      
      setWords(filteredWords);
    } catch (error) {
      alert(`단어 로딩 실패: ${error.message}`);
    }
    setLoading(false);
  };

  const handleComplete = (wordId) => {
    const completedWords = JSON.parse(localStorage.getItem(COMPLETED_WORDS_STORAGE_KEY)) || [];
    const newCompletedWords = [...completedWords, wordId];
    localStorage.setItem(COMPLETED_WORDS_STORAGE_KEY, JSON.stringify(newCompletedWords));

    setWords(currentWords => currentWords.filter(word => word.id !== wordId));
    alert('단어 학습을 완료했습니다!');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: ['engWord', 'korWord', 'etc'],
          skipHeader: true
        });

        if (jsonData.length === 0) throw new Error('엑셀 파일에 데이터가 없습니다.');

        const { error } = await supabase.from('Word').insert(jsonData);
        if (error) throw error;

        alert(`${jsonData.length}개의 단어가 성공적으로 업로드되었습니다.`);
        fetchWords(); // 단어 목록 새로고침
      } catch (error) {
        alert(`업로드 실패: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>영단어장</h1>
        {isAdmin && (
          <>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".xlsx, .xls" />
            <button className="btn btn-primary" onClick={triggerFileInput}>단어 업로드</button>
          </>
        )}
      </div>
      
      {loading ? (
        <p>단어를 불러오는 중...</p>
      ) : (
        <div className="d-flex flex-wrap justify-content-center">
          {words.length > 0 ? (
            words.map(word => (
              <FlipCard 
                key={word.id}
                engWord={word.engWord} 
                korWord={word.korWord} 
                onComplete={() => handleComplete(word.id)} 
              />
            ))
          ) : (
            <p>모든 단어 학습을 완료했습니다! 🎉</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Word;
