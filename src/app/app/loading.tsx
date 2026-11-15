export default function Loading() {
  return (
    <section className="stage" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ height: 52, width: "min(420px, 70%)", marginBottom: 14 }} />
      <div className="skel" style={{ height: 18, width: "min(560px, 90%)", marginBottom: 36 }} />
      <div className="grid-cards">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skel" style={{ height: 280, borderRadius: 24 }} />)}</div>
    </section>
  );
}
