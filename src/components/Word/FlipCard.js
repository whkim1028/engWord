import React, { useState } from 'react';
import './FlipCard.css';

function FlipCard({ engWord, korWord, onComplete }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleCompleteClick = (e) => {
    e.stopPropagation(); // 카드가 뒤집히는 것을 방지
    onComplete();
  };

  return (
    <div className={`flip-card ${isFlipped ? 'flipped' : ''}`} onClick={handleCardClick}>
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <p>{engWord}</p>
        </div>
        <div className="flip-card-back">
          <div>
            <p>{korWord}</p>
            <button className="btn btn-outline-secondary" onClick={handleCompleteClick}>완료</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlipCard;
