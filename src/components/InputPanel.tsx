interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function InputPanel({ value, onChange }: Props) {
  return (
    <textarea
      className="input-panel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Standard input — one value per line, read by input()"
      spellCheck={false}
    />
  );
}
