import { useId } from "react";

type SliderProps = Omit<React.ComponentProps<"input">, "type" | "onChange"> & {
  label: string;
  displayValue: string;
  onValueChange: (value: number) => void;
};

export const Slider = ({
  label,
  displayValue,
  onValueChange,
  ...rest
}: SliderProps) => {
  const sliderId = useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(parseFloat(e.currentTarget.value));
  };

  return (
    <>
      <label className="slider-label-row" htmlFor={sliderId}>
        <span>{label}</span>
        <span>{displayValue}</span>
      </label>

      <input
        id={sliderId}
        type="range"
        className="volume-slider"
        onChange={handleChange}
        {...rest}
      />
    </>
  );
};
