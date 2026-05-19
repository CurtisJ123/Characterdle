interface MetricRowProps {
  label: string;
  value: string;
  danger?: boolean;
}

export function MetricRow({ label, value, danger = false }: MetricRowProps) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong className={danger ? 'danger-text' : ''}>{value}</strong>
    </div>
  );
}
