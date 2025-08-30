import React, { useState } from 'react';
import './FlipCard.css';

function FlipCard({ engWord, korWord, etc, onComplete }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleCompleteClick = (e) => {
    e.stopPropagation(); // 카드가 뒤집히는 것을 방지
    onComplete();
  };

  return (
    <div className={`flip-card shadow-sm ${isFlipped ? 'flipped' : ''}`} onClick={handleCardClick}>
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <h3 className="m-0">{engWord}</h3>
        </div>
        <div className="flip-card-back">
          <div>
            <h4 className="m-0">{korWord}</h4>
            {etc && <p className="text-muted small mt-2 mb-0">{etc}</p>}
            <button className="btn btn-success mt-3" onClick={handleCompleteClick}>완료</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlipCard;
