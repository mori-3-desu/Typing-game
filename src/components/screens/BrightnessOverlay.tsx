type Props = {
  brightness: number;
};

export const BrightnessOverlay = ({ brightness }: Props) => {
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "black",
          pointerEvents: "none", // 🌟クリック貫通（必須）
          zIndex: 9999, // 🌟一番手前に持ってくる
          opacity: 1 - brightness, // brightness=1で透明(0)、0.5で半透明(0.5)
          transition: "opacity 0.2s ease-in-out", // ふんわり変化
        }}
      />
    </>
  );
};
