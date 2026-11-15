export function Switch({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="switch-track" />
      {label}
    </label>
  );
}
