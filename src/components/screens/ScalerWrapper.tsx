import type { ReactNode } from "react";

import { useScaler } from "../../hooks/useScaler";

type Props = {
  children: ReactNode;
};

export const ScalerWrapper = ({ children }: Props) => {
  const scalerRef = useScaler();

  return (
    <div className="scaler" ref={scalerRef}>
      {children}
    </div>
  );
};
