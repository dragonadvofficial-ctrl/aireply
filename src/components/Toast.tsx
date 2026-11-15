"use client";
import { useEffect, useState } from "react";

export function Toast({ message }: { message?: string | null }) {
  const [show, setShow] = useState(Boolean(message));
  useEffect(() => { setShow(Boolean(message)); const t = setTimeout(() => setShow(false), 3800); return () => clearTimeout(t); }, [message]);
  return show && message ? <div className="toast" role="status">{message}</div> : null;
}
