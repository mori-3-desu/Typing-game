import React, { useEffect, useState } from 'react';

type Props = {
  imageUrl: string;
};

export const GameBackground: React.FC<Props> = ({ imageUrl }) => {
  // 2枚のレイヤーでクロスフェードを管理
  const [activeImage, setActiveImage] = useState(imageUrl);
  const [nextImage, setNextImage] = useState("");
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // 画像が変わったときだけ処理
    if (imageUrl !== activeImage) {
      setNextImage(imageUrl);
      setIsFading(true); // フェード開始

      // 0.5秒後（CSSのtransitionと同じ時間）に切り替え完了
      const timer = setTimeout(() => {
        setActiveImage(imageUrl);
        setIsFading(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [imageUrl, activeImage]);

  return (
    <div id="bg-container" style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 0 }}>
      {/* 奥にあるレイヤー（現在表示中） */}
      <div 
        className="bg-layer visible"
        style={{ backgroundImage: `url('${activeImage}')` }}
      />
      
      {/* 手前にあるレイヤー（次の画像：フェードインしてくる） */}
      <div 
        className={`bg-layer ${isFading ? 'visible' : ''}`}
        style={{ backgroundImage: `url('${nextImage}')`, opacity: isFading ? 1 : 0 }}
      />
    </div>
  );
};