// Original 3D art generated for rply (Magnific, Nov 2026). Files: /public/art/*.webp (800px, transparent).
export type CharName = "bub" | "heart" | "plane" | "bell" | "at" | "phone" | "lens";
export type ObjName = "obj-heart" | "obj-bolt" | "obj-typing" | "obj-chip";
export type ArtName = CharName | `${CharName}-head` | ObjName;

export function Art({ name, size = 96, alt = "", className = "art", eager = false, style }: {
  name: ArtName; size?: number; alt?: string; className?: string; eager?: boolean; style?: React.CSSProperties;
}) {
  return <img src={`/art/${name}.webp`} width={size} height={size} alt={alt} className={className} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} style={style} />;
}
