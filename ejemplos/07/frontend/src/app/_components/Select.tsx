export function Select({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{ label: string; value: string }>;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="grid gap-2">
      {label && (
        <span className="text-sm font-medium text-neutral-200">{label}</span>
      )}
      <select
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-neutral-400/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
