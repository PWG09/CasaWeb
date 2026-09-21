"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { id: string; name: string; initials: string; color: string };
type Item = { id: number; text: string; done: boolean };
type Lists = Record<string, Item[]>;

const users: User[] = [
  { id: "carlos", name: "Carlos W", initials: "CW", color: "coral" },
  { id: "jorge", name: "Jorge A", initials: "JA", color: "blue" },
  { id: "luis", name: "Luis M", initials: "LM", color: "green" },
];
const accounts = users.map((user) => ({ username: user.id, password: "Casa123", userId: user.id }));
const initialLists: Lists = {
  carlos: [{ id: 1, text: "Leche", done: false }, { id: 2, text: "Papel de cocina", done: true }],
  jorge: [{ id: 3, text: "Jabón para platos", done: false }],
  luis: [{ id: 4, text: "Café", done: false }, { id: 5, text: "Bombillas", done: false }],
};

function stored<T>(key: string, fallback: T): T {
  const value = typeof window === "undefined" ? null : window.localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return typeof fallback === "string" ? value as T : fallback;
  }
}

export default function Home() {
  const [current, setCurrent] = useState<User | null>(() => {
    const saved = stored<string | null>("casaweb-user", null);
    return saved ? users.find((user) => user.id === saved) ?? null : null;
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [lists, setLists] = useState<Lists>(() => ({ ...initialLists, ...stored<Lists>("casaweb-lists", initialLists) }));
  const [occupiedBy, setOccupiedBy] = useState<string | null>(() => stored("casaweb-occupied", null));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function syncState() {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo conectar con la base de datos.");
        const remote = await response.json() as { lists: Lists; occupiedBy: string | null };
        if (active) { setLists(remote.lists); setOccupiedBy(remote.occupiedBy); }
      } catch (error) { if (active) setNotice(error instanceof Error ? error.message : "Backend no disponible."); }
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    syncState();
    const interval = window.setInterval(syncState, 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const pending = useMemo(() => Object.values(lists).flat().filter((item) => !item.done).length, [lists]);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = accounts.find((candidate) => candidate.username === username.toLowerCase() && candidate.password === password);
    if (!account) { setError("Usuario o contraseña incorrectos."); return; }
    const user = users.find((candidate) => candidate.id === account.userId) ?? null;
    setCurrent(user); setError(""); window.localStorage.setItem("casaweb-user", account.userId);
  }
  function addItem(userId: string) {
    const text = drafts[userId]?.trim();
    if (!text) return;
    const item = { id: Math.max(0, ...Object.values(lists).flat().map((entry) => entry.id)) + 1, text, done: false };
    setLists((value) => ({ ...value, [userId]: [...value[userId], item] }));
    setDrafts((value) => ({ ...value, [userId]: "" }));
    void saveRemote({ lists: { ...lists, [userId]: [...lists[userId], item] } });
  }
  function toggleItem(userId: string, id: number) {
    setLists((value) => ({ ...value, [userId]: value[userId].map((item) => item.id === id ? { ...item, done: !item.done } : item) }));
    const nextLists = { ...lists, [userId]: lists[userId].map((item) => item.id === id ? { ...item, done: !item.done } : item) };
    void saveRemote({ lists: nextLists });
  }
  async function saveRemote(payload: { lists?: Lists; occupiedBy?: string | null; message?: { title: string; body: string } }) {
    if (!current) return;
    const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: current.id, ...payload }) });
    if (!response.ok) setNotice("No se pudo guardar el cambio en el servidor.");
  }
  function base64ToBytes(value: string) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
  }
  async function allowNotifications() {
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    const result = await Notification.requestPermission();
    if (result !== "granted") { setPermission(result); setNotice("Los avisos siguen desactivados."); return; }
    const registration = await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) { setNotice("Falta configurar la clave VAPID pública en Vercel."); return; }
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
    await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: current?.id, subscription }) });
    setPermission(result); setNotice("Avisos activados en este dispositivo.");
  }
  function toggleHouse() {
    if (!current) return;
    const next = occupiedBy === current.id ? null : current.id;
    setOccupiedBy(next); setNotice(next ? "Aviso enviado al grupo." : "La casa vuelve a estar disponible.");
    void saveRemote({ occupiedBy: next, message: next ? { title: `${current.name} necesita la casa`, body: "Revisa Casa Común para ver el aviso." } : undefined });
  }

  if (!current) return <main className="login-shell"><section className="login-copy"><p className="eyebrow">CASA COMÚN / 03</p><h1>La casa,<br /><em>en sintonía.</em></h1><p className="intro">Un lugar pequeño para coordinar lo cotidiano sin llenar el chat de mensajes.</p><p className="login-note">● Espacio privado para tres personas</p></section><section className="login-panel"><div className="brand-mark">CC</div><p className="eyebrow">ENTRAR AL ESPACIO</p><h2>Qué bueno verte.</h2><form onSubmit={login} className="login-form"><label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="carlos" /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Casa123" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button">Entrar a Casa Común <span>↗</span></button></form><p className="demo-hint">Demo: carlos, jorge o luis / contraseña: Casa123</p></section></main>;

  return <main className="app-shell"><header className="topbar"><div className="wordmark"><span>CC</span><strong>Casa Común</strong></div><div className="topbar-actions"><span className="live-dot">● Todo al día</span><button className="text-button" onClick={() => { setCurrent(null); window.localStorage.removeItem("casaweb-user"); }}>Salir</button></div></header><div className="app-content"><aside className="sidebar"><p className="eyebrow">NUESTRO ESPACIO</p><h1>Hola, {current.name}.</h1><p className="muted">Aquí sabemos qué falta, quién está y cuándo necesitamos un poco de casa.</p><div className="sidebar-rule" /><p className="eyebrow">LAS TRES LLAVES</p><div className="people-list">{users.map((user) => <div className={`person-row ${occupiedBy === user.id ? "is-occupied" : ""}`} key={user.id}><span className={`avatar ${user.color}`}>{user.initials}</span><div><strong>{user.name}{user.id === current.id ? " (tú)" : ""}</strong><small>{occupiedBy === user.id ? "Necesita la casa ahora" : "Disponible"}</small></div><span className={`status ${occupiedBy === user.id ? "busy" : "free"}`} /></div>)}</div><button className={`house-button ${occupiedBy === current.id ? "active" : ""}`} onClick={toggleHouse}>{occupiedBy === current.id ? "Ya no necesito la casa" : "Necesito la casa ahora"}<span>{occupiedBy === current.id ? "×" : "!"}</span></button><div className="notification-box"><div><strong>Avisos en tu móvil</strong><p>{permission === "granted" ? "Están activos en este dispositivo." : "Actívalos para enterarte al momento."}</p></div><button onClick={allowNotifications} disabled={permission === "granted"}>{permission === "granted" ? "Listo" : "Activar"}</button></div><p className="ios-note">En iPhone y iPad, añade Casa Común a la pantalla de inicio. Los avisos web funcionan desde iOS/iPadOS 16.4.</p></aside><section className="workspace"><div className="workspace-heading"><div><p className="eyebrow">LISTA COMPARTIDA</p><h2>Lo que hace falta</h2></div><span className="count-badge">{pending} pendientes</span></div>{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}<div className="lists-grid">{users.map((user) => <article className={`list-card ${user.id === current.id ? "your-list" : ""}`} key={user.id}><div className="list-card-heading"><span className={`avatar small-avatar ${user.color}`}>{user.initials}</span><div><h3>{user.id === current.id ? "Tu lista" : `Lista de ${user.name}`}</h3><p>{lists[user.id].filter((item) => !item.done).length} por comprar</p></div>{user.id === current.id && <span className="you-label">TÚ</span>}</div><div className="items">{lists[user.id].map((item) => <label className={`item ${item.done ? "done" : ""}`} key={item.id}><input type="checkbox" checked={item.done} onChange={() => toggleItem(user.id, item.id)} /><span>{item.text}</span></label>)}</div><form className="add-item" onSubmit={(event) => { event.preventDefault(); addItem(user.id); }}><input value={drafts[user.id] ?? ""} onChange={(event) => setDrafts((value) => ({ ...value, [user.id]: event.target.value }))} placeholder="Añadir algo..." /><button aria-label="Añadir producto">+</button></form></article>)}</div><footer className="workspace-footer"><span><strong>{pending}</strong> cosas pendientes en casa</span><span>Guardado en este dispositivo</span></footer></section></div></main>;
}
