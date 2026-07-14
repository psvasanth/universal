import { useState, useEffect, useRef } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, X, Plus, Minus, Check, Trash2, Bell,
  ListChecks, Settings, Palette, ChevronDown, Sparkles, ArrowRightLeft, Pencil, User
} from "lucide-react";

/* ---------- persistence ---------- */

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (e.g. private browsing) — fail silently.
    }
  }, [key, value]);

  return [value, setValue];
}

/* ---------- constants ---------- */

const ACCENTS = {
  emerald: { name: "Emerald", hex: "#34d399", soft: "rgba(52,211,153,0.16)" },
  blue:    { name: "Electric blue", hex: "#60a5fa", soft: "rgba(96,165,250,0.16)" },
  purple:  { name: "Deep purple", hex: "#a78bfa", soft: "rgba(167,139,250,0.16)" },
};

const COLOR_PALETTE = {
  purple: { hex: "#a78bfa", text: "text-purple-300", bg: "bg-purple-500/15", border: "border-purple-500/30" },
  blue:   { hex: "#60a5fa", text: "text-blue-300",   bg: "bg-blue-500/15",   border: "border-blue-500/30" },
  emerald:{ hex: "#34d399", text: "text-emerald-300",bg: "bg-emerald-500/15",border: "border-emerald-500/30" },
  amber:  { hex: "#fbbf24", text: "text-amber-300",  bg: "bg-amber-500/15",  border: "border-amber-500/30" },
  cyan:   { hex: "#22d3ee", text: "text-cyan-300",   bg: "bg-cyan-500/15",   border: "border-cyan-500/30" },
  rose:   { hex: "#fb7185", text: "text-rose-300",   bg: "bg-rose-500/15",   border: "border-rose-500/30" },
  orange: { hex: "#fb923c", text: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-500/30" },
  pink:   { hex: "#f472b6", text: "text-pink-300",   bg: "bg-pink-500/15",   border: "border-pink-500/30" },
};
const FALLBACK_CAT_STYLE = { text: "text-zinc-300", bg: "bg-zinc-500/15", border: "border-zinc-500/30" };

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Bill", color: "purple" },
  { id: 2, name: "Personal", color: "blue" },
  { id: 3, name: "Work", color: "emerald" },
  { id: 4, name: "Health", color: "amber" },
  { id: 5, name: "Recharge", color: "cyan" },
];

const QUADRANTS = [
  { key: "do",       label: "Do",       sub: "Urgent & important",        dot: "bg-emerald-400", text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  { key: "schedule", label: "Schedule", sub: "Not urgent & important",    dot: "bg-blue-400",    text: "text-blue-400",    border: "border-blue-500/30",    bg: "bg-blue-500/10" },
  { key: "delegate", label: "Delegate", sub: "Urgent & not important",    dot: "bg-orange-400",  text: "text-orange-400",  border: "border-orange-500/30",  bg: "bg-orange-500/10" },
  { key: "delete",   label: "Delete",   sub: "Not urgent, not important", dot: "bg-rose-400",    text: "text-rose-400",    border: "border-rose-500/30",    bg: "bg-rose-500/10" },
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ---------- helpers ---------- */

function pad(n) { return n < 10 ? "0" + n : "" + n; }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0); return d; }
function addHours(base, n) { const d = new Date(base); d.setHours(d.getHours() + n); return d; }

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function countdown(due, now) {
  const diff = due.getTime() - now.getTime();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const totalHours = Math.floor(abs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { overdue, days, hours };
}

function urgency({ overdue, days }) {
  if (overdue) return { hex: "#f43f5e" };
  if (days < 1) return { hex: "#f43f5e" };
  if (days < 3) return { hex: "#fb923c" };
  if (days < 7) return { hex: "#60a5fa" };
  return { hex: "#34d399" };
}

function fmtDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function categoryStyle(categories, name) {
  const cat = categories.find((c) => c.name === name);
  return cat ? COLOR_PALETTE[cat.color] : FALLBACK_CAT_STYLE;
}

let idCounter = 1000;
function nextId() { idCounter += 1; return idCounter; }

/* ---------- mock initial data (dates stored as ISO strings for persistence) ---------- */

const NOW0 = new Date();

const INITIAL_EVENTS = [
  { id: nextId(), title: "Submit DNB thesis draft", category: "Work", due: addHours(NOW0, 20).toISOString(), status: "pending" },
  { id: nextId(), title: "Dental checkup", category: "Health", due: addDays(NOW0, -1).toISOString(), status: "pending" },
  { id: nextId(), title: "LIC premium payment", category: "Bill", due: addDays(NOW0, 4).toISOString(), status: "pending" },
  { id: nextId(), title: "Anniversary dinner", category: "Personal", due: addDays(NOW0, 12).toISOString(), status: "pending" },
  { id: nextId(), title: "Mobile recharge", category: "Recharge", due: addDays(NOW0, 6).toISOString(), status: "pending" },
];

const INITIAL_NOTES = {
  [dateKey(addDays(NOW0, 2))]: [{ id: nextId(), text: "OPD duty, 8 AM to 2 PM" }],
  [dateKey(addDays(NOW0, 4))]: [{ id: nextId(), text: "LIC premium due today" }],
  [dateKey(addDays(NOW0, -3))]: [{ id: nextId(), text: "Grand round presentation" }],
  [dateKey(addDays(NOW0, 9))]: [{ id: nextId(), text: "NEET SS mock test" }],
};

const INITIAL_TASKS = {
  do: [
    { id: nextId(), text: "Finish ward round notes", done: false },
    { id: nextId(), text: "Call back patient re: reports", done: false },
  ],
  schedule: [
    { id: nextId(), text: "Revise Harrison's Ch.12, Endocrine", done: false },
    { id: nextId(), text: "Plan NEET SS mock schedule", done: false },
  ],
  delegate: [
    { id: nextId(), text: "Ask intern to update vitals chart", done: false },
  ],
  delete: [
    { id: nextId(), text: "Reorganize old lecture PDFs", done: false },
    { id: nextId(), text: "Clean up gallery screenshots", done: false },
  ],
};

const INITIAL_SETTINGS = { name: "Dharani", aim: "Clear DNB, General Medicine", accent: "emerald", notifications: true };

/* ---------- shared pieces ---------- */

function SplashScreen({ visible }) {
  return (
    <div
      className="absolute inset-0 z-[60] bg-zinc-950 flex flex-col items-center justify-center gap-4 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      <img src="./logo.png" alt="Universal" className="w-20 h-20" />
      <div>
        <p className="text-lg font-extrabold tracking-tight text-zinc-50 text-center">Universal</p>
        <p className="text-xs text-zinc-500 text-center mt-0.5">Daily Command</p>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-medium text-zinc-100 shadow-lg animate-fadeslide">
      {message}
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-zinc-400" />}
          <span className="text-sm font-bold text-zinc-100">{title}</span>
        </div>
        {open ? <Minus size={16} className="text-zinc-500" /> : <Plus size={16} className="text-zinc-500" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

/* ---------- Calendar ---------- */

function CalendarView({ notes, events, accent, onOpenDay }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const cells = buildMonthGrid(year, month);
  const today = new Date();

  function shiftMonth(delta) {
    setMonthDate(new Date(year, month + delta, 1));
  }

  function dayHasNote(d) {
    return !!notes[dateKey(d)]?.length;
  }
  function dayHasEvent(d) {
    return events.some((e) => e.status !== "done" && sameDay(new Date(e.due), d));
  }

  const rowCount = cells.length / 7;

  return (
    <div className="animate-fadeslide pt-5 h-full flex flex-col">
      <div className="mx-5 mb-4 flex items-center justify-between shrink-0">
        <button onClick={() => shiftMonth(-1)} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center active:scale-95 transition">
          <ChevronLeft size={18} className="text-zinc-300" />
        </button>
        <span className="font-bold text-zinc-100 text-base">{MONTH_NAMES[month]} {year}</span>
        <button onClick={() => shiftMonth(1)} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center active:scale-95 transition">
          <ChevronRight size={18} className="text-zinc-300" />
        </button>
      </div>

      <div className="mx-5 grid grid-cols-7 gap-y-1 mb-1 shrink-0">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-zinc-600 py-1">{w}</div>
        ))}
      </div>

      <div
        className="mx-5 mb-5 grid grid-cols-7 gap-1.5 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${rowCount}, 1fr)` }}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday = sameDay(d, today);
          const hasNote = dayHasNote(d);
          const hasEvent = dayHasEvent(d);
          return (
            <button
              key={i}
              onClick={() => onOpenDay(d)}
              className="h-full rounded-xl flex flex-col items-center justify-center gap-1 border transition active:scale-95"
              style={{
                backgroundColor: isToday ? accent.soft : "rgb(24 24 27)",
                borderColor: isToday ? accent.hex : "rgb(39 39 42)",
              }}
            >
              <span className={`text-base font-semibold ${isToday ? "" : "text-zinc-300"}`} style={isToday ? { color: accent.hex } : {}}>
                {d.getDate()}
              </span>
              <div className="flex gap-0.5 h-1.5">
                {hasNote && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                {hasEvent && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.hex }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateSheet({ date, notes, events, categories, onAddNote, onDeleteNote, onClose, accent }) {
  const [text, setText] = useState("");
  if (!date) return null;
  const key = dateKey(date);
  const dayNotes = notes[key] || [];
  const dayEvents = events.filter((e) => sameDay(new Date(e.due), date));

  function submit() {
    if (!text.trim()) return;
    onAddNote(key, text.trim());
    setText("");
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 pb-7 animate-sheetup max-h-[80%] flex flex-col" style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-50">{date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {dayEvents.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">Events due</p>
              <div className="flex flex-col gap-2">
                {dayEvents.map((e) => {
                  const cat = categoryStyle(categories, e.category);
                  return (
                    <div key={e.id} className={`px-3 py-2 rounded-xl border ${cat.border} ${cat.bg} text-sm font-medium ${cat.text}`}>
                      {e.title}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">Notes</p>
          <div className="flex flex-col gap-2 mb-4">
            {dayNotes.length === 0 && (
              <p className="text-sm text-zinc-600 italic py-2">No notes for this day yet.</p>
            )}
            {dayNotes.map((n) => (
              <div key={n.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                <span className="text-sm text-zinc-200">{n.text}</span>
                <button onClick={() => onDeleteNote(key, n.id)} className="text-zinc-600 active:text-rose-400 p-1">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 shrink-0">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a quick note..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button
            onClick={submit}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition"
            style={{ backgroundColor: accent.hex }}
          >
            <Plus size={20} className="text-zinc-950" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Event tracker ---------- */

function CountdownRing({ due, now }) {
  const c = countdown(due, now);
  const u = urgency(c);
  const circumference = 2 * Math.PI * 17;
  const pct = c.overdue ? 1 : Math.max(0.08, Math.min(1, 1 - c.days / 14));
  const offset = circumference * (1 - pct);
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="17" fill="none" stroke="rgb(39 39 42)" strokeWidth="3.5" />
        <circle
          cx="24" cy="24" r="17" fill="none"
          stroke={u.hex} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {c.overdue ? (
          <span className="text-[9px] font-bold text-rose-400">LATE</span>
        ) : c.days < 1 ? (
          <span className="text-xs font-extrabold tabular-nums" style={{ color: u.hex }}>{c.hours}h</span>
        ) : (
          <span className="text-xs font-extrabold tabular-nums" style={{ color: u.hex }}>{c.days}d</span>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, now, categories, onComplete, onDelete }) {
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const cat = categoryStyle(categories, event.category);
  const due = new Date(event.due);

  function down(e) { dragging.current = true; startX.current = e.clientX; }
  function move(e) {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    setDragX(Math.max(-96, Math.min(0, delta)));
  }
  function up() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX < -70) onDelete(event.id);
    else setDragX(0);
  }

  return (
    <div className="relative mb-3 select-none">
      <div className="absolute inset-0 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-end pr-6">
        <Trash2 size={18} className="text-rose-400" />
      </div>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{ transform: `translateX(${dragX}px)`, transition: dragging.current ? "none" : "transform 0.25s ease", touchAction: "pan-y" }}
        className={`relative z-10 bg-zinc-900 border rounded-2xl p-3.5 flex items-center gap-3 ${event.status === "done" ? "opacity-45 border-zinc-800" : "border-zinc-800"}`}
      >
        <CountdownRing due={due} now={now} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold text-zinc-100 truncate ${event.status === "done" ? "line-through" : ""}`}>{event.title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.border} ${cat.bg} ${cat.text}`}>{event.category}</span>
            <span className="text-[11px] text-zinc-500">{fmtDate(due)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button onClick={() => onComplete(event.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center border ${event.status === "done" ? "bg-emerald-500/20 border-emerald-500/40" : "bg-zinc-800 border-zinc-700"}`}>
            <Check size={14} className={event.status === "done" ? "text-emerald-400" : "text-zinc-400"} />
          </button>
          <button onClick={() => onDelete(event.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-800 border border-zinc-700">
            <Trash2 size={14} className="text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryManagerSheet({ categories, onAdd, onRename, onDelete, onClose }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("purple");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  function submitNew() {
    if (!newName.trim()) return;
    onAdd(newName.trim(), newColor);
    setNewName("");
  }
  function startEdit(cat) { setEditingId(cat.id); setEditText(cat.name); }
  function submitEdit() {
    if (editText.trim()) onRename(editingId, editText.trim());
    setEditingId(null);
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 pb-7 animate-sheetup max-h-[85%] flex flex-col" style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}>
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-50">Categories</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1 flex flex-col gap-2 mb-4">
          {categories.map((cat) => {
            const pal = COLOR_PALETTE[cat.color];
            return (
              <div key={cat.id} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${pal.border} ${pal.bg}`}>
                {editingId === cat.id ? (
                  <input
                    autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitEdit()} onBlur={submitEdit}
                    className="flex-1 bg-transparent outline-none text-sm font-semibold text-zinc-100"
                  />
                ) : (
                  <button onClick={() => startEdit(cat)} className={`text-sm font-semibold ${pal.text} text-left`}>{cat.name}</button>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(cat)} className="w-7 h-7 rounded-lg bg-zinc-900/60 flex items-center justify-center">
                    <Pencil size={12} className="text-zinc-400" />
                  </button>
                  <button onClick={() => onDelete(cat.id)} className="w-7 h-7 rounded-lg bg-zinc-900/60 flex items-center justify-center">
                    <Trash2 size={12} className="text-zinc-500" />
                  </button>
                </div>
              </div>
            );
          })}
          {categories.length === 0 && <p className="text-xs text-zinc-600 italic py-2">No categories yet — add one below.</p>}
        </div>

        <div className="flex flex-col gap-2 pt-3 shrink-0 border-t border-zinc-800">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">Add category</p>
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
            placeholder='e.g. "Recharge"'
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2 flex-wrap">
            {Object.entries(COLOR_PALETTE).map(([key, pal]) => (
              <button
                key={key} onClick={() => setNewColor(key)}
                className="w-8 h-8 rounded-full border-2"
                style={{ backgroundColor: pal.hex, borderColor: newColor === key ? "#e4e4e7" : "transparent" }}
              />
            ))}
          </div>
          <button onClick={submitNew} className="py-2.5 rounded-xl text-zinc-950 text-sm font-bold mt-1" style={{ backgroundColor: COLOR_PALETTE[newColor].hex }}>
            Add category
          </button>
        </div>
      </div>
    </div>
  );
}

function EventsView({ events, now, accent, categories, onAdd, onComplete, onDelete, onAddCategory, onRenameCategory, onDeleteCategory }) {
  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]?.name || "");
  const [dueDate, setDueDate] = useState("");

  function submit() {
    if (!title.trim() || !dueDate || !category) return;
    const due = new Date(dueDate);
    due.setHours(18, 0, 0, 0);
    onAdd({ title: title.trim(), category, due: due.toISOString(), status: "pending" });
    setTitle(""); setDueDate(""); setShowForm(false);
  }

  const pending = [...events].filter((e) => e.status !== "done").sort((a, b) => new Date(a.due) - new Date(b.due));
  const done = [...events].filter((e) => e.status === "done");

  return (
    <div className="animate-fadeslide pb-4 pt-5">
      <div className="mx-5 mb-4 flex items-center gap-2">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="flex-1 py-3 rounded-2xl border border-dashed border-zinc-700 text-zinc-400 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition">
            <Plus size={16} /> Add event
          </button>
        ) : (
          <div className="flex-1" />
        )}
        <button onClick={() => setShowCategoryManager(true)} className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <Pencil size={16} className="text-zinc-400" />
        </button>
      </div>

      {showForm && (
        <div className="mx-5 mb-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "LIC Premium Payment"'
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((c) => {
              const pal = COLOR_PALETTE[c.color];
              const selected = category === c.name;
              return (
                <button
                  key={c.id} onClick={() => setCategory(c.name)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${selected ? `${pal.border} ${pal.bg} ${pal.text}` : "border-zinc-800 text-zinc-500"}`}
                >
                  {c.name}
                </button>
              );
            })}
            <button onClick={() => setShowCategoryManager(true)} className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-dashed border-zinc-700 text-zinc-500">
              + New
            </button>
          </div>
          <input
            type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold">Cancel</button>
            <button onClick={submit} className="flex-1 py-2.5 rounded-xl text-zinc-950 text-sm font-bold" style={{ backgroundColor: accent.hex }}>Save</button>
          </div>
        </div>
      )}

      <div className="mx-5">
        {pending.length === 0 && done.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Sparkles size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events yet. Add your first one above.</p>
          </div>
        )}
        {pending.map((e) => (
          <EventCard key={e.id} event={e} now={now} categories={categories} onComplete={onComplete} onDelete={onDelete} />
        ))}
        {done.length > 0 && (
          <>
            <p className="text-[11px] uppercase tracking-wide text-zinc-600 font-semibold mt-2 mb-2">Completed</p>
            {done.map((e) => (
              <EventCard key={e.id} event={e} now={now} categories={categories} onComplete={onComplete} onDelete={onDelete} />
            ))}
          </>
        )}
      </div>

      {showCategoryManager && (
        <CategoryManagerSheet
          categories={categories}
          onAdd={(name, color) => { onAddCategory(name, color); setCategory(name); }}
          onRename={onRenameCategory}
          onDelete={onDeleteCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  );
}

/* ---------- Task manager ---------- */

function TaskRow({ task, currentKey, onMove, onDelete, onToggleDone }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2500);
    } else {
      clearTimeout(confirmTimer.current);
      onDelete(currentKey, task.id);
    }
  }

  return (
    <div className="relative flex items-center justify-between bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2.5 mb-2 gap-2">
      <button
        onClick={() => onToggleDone(currentKey, task.id)}
        className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 ${task.done ? "bg-emerald-500/25 border-emerald-500/50" : "border-zinc-700"}`}
      >
        {task.done && <Check size={13} className="text-emerald-400" />}
      </button>
      <span className={`text-sm flex-1 ${task.done ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{task.text}</span>
      {confirmDelete && <span className="text-[11px] font-semibold text-rose-400 shrink-0">Abort?</span>}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setMenuOpen((v) => !v)} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center">
          <ArrowRightLeft size={12} className="text-zinc-400" />
        </button>
        <button
          onClick={handleDeleteClick}
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${confirmDelete ? "bg-rose-500/25 border border-rose-500/50" : "bg-zinc-800"}`}
        >
          <Trash2 size={12} className={confirmDelete ? "text-rose-400" : "text-zinc-500"} />
        </button>
      </div>
      {menuOpen && (
        <div className="absolute right-0 top-9 z-20 bg-zinc-900 border border-zinc-700 rounded-xl p-1.5 shadow-xl flex flex-col gap-1 w-40">
          {QUADRANTS.filter((q) => q.key !== currentKey).map((q) => (
            <button
              key={q.key}
              onClick={() => { onMove(currentKey, q.key, task.id); setMenuOpen(false); }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-300 active:bg-zinc-800"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${q.dot}`} /> Move to {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuadrantSection({ q, tasks, expanded, onToggle, onAdd, onMove, onDelete, onToggleDone }) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim()) return;
    onAdd(q.key, text.trim());
    setText("");
  }
  const sorted = [...tasks].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  const pendingCount = tasks.filter((t) => !t.done).length;

  return (
    <div className={`rounded-2xl border ${q.border} ${q.bg} mb-3 overflow-hidden`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${q.dot}`} />
          <div className="text-left">
            <p className={`text-sm font-bold ${q.text}`}>{q.label}</p>
            <p className="text-[11px] text-zinc-500">{q.sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 bg-zinc-900/70 rounded-full px-2 py-0.5">{pendingCount}</span>
          <ChevronDown size={16} className={`text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {sorted.length === 0 && <p className="text-xs text-zinc-600 italic mb-2">Nothing here.</p>}
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} currentKey={q.key} onMove={onMove} onDelete={onDelete} onToggleDone={onToggleDone} />
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input
              value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Add a task..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
            />
            <button onClick={submit} className={`w-9 h-9 rounded-lg flex items-center justify-center ${q.bg} border ${q.border}`}>
              <Plus size={16} className={q.text} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TasksView({ tasks, accent, onAdd, onMove, onDelete, onToggleDone }) {
  const [expanded, setExpanded] = useState("do");
  const allTasks = Object.values(tasks).flat();
  const completedCount = allTasks.filter((t) => t.done).length;
  const totalCount = allTasks.length;

  return (
    <div className="animate-fadeslide pb-4 pt-5">
      <div className="mx-5 mb-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accent.soft }}>
          <Sparkles size={18} style={{ color: accent.hex }} />
        </div>
        <div key={completedCount} className="animate-fadeslide">
          <p className="text-sm font-bold text-zinc-100">{completedCount} of {totalCount} tasks completed</p>
          <p className="text-[11px] text-zinc-500">Tick tasks off as you finish them</p>
        </div>
      </div>

      <div className="mx-5">
        {QUADRANTS.map((q) => (
          <QuadrantSection
            key={q.key} q={q} tasks={tasks[q.key]}
            expanded={expanded === q.key}
            onToggle={() => setExpanded(expanded === q.key ? null : q.key)}
            onAdd={onAdd} onMove={onMove} onDelete={onDelete} onToggleDone={onToggleDone}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */

function ToggleSwitch({ checked, onChange, accent }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0"
      style={{ backgroundColor: checked ? accent.hex : "rgb(39 39 42)" }}
    >
      <div className="w-6 h-6 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? "translateX(24px)" : "translateX(0)" }} />
    </button>
  );
}

function ProfileForm({ settings, onSave, accent }) {
  const [name, setName] = useState(settings.name);
  const [aim, setAim] = useState(settings.aim);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  function handleSave() {
    onSave({ name, aim });
    setSaved(true);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-zinc-950" style={{ backgroundColor: accent.hex }}>
          {(name || "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-100">{name || "Your name"}</p>
          <p className="text-xs text-zinc-500">{aim}</p>
        </div>
      </div>
      <label className="text-xs text-zinc-500 font-medium">Name</label>
      <input
        value={name} onChange={(e) => setName(e.target.value)}
        className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 -mt-2"
      />
      <label className="text-xs text-zinc-500 font-medium">Aim</label>
      <input
        value={aim} onChange={(e) => setAim(e.target.value)}
        placeholder="e.g. Clear DNB, General Medicine"
        className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600 -mt-2"
      />
      <button
        onClick={handleSave}
        className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 mt-1"
        style={{ backgroundColor: saved ? "rgb(39 39 42)" : accent.hex, color: saved ? "#d4d4d8" : "#09090b" }}
      >
        {saved && <Check size={15} />} {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

function SettingsView({ settings, onUpdate, onClearData, accent }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="animate-fadeslide pb-4 pt-5">
      <div className="mx-5 mb-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
        <img src="./logo.png" alt="Universal" className="w-10 h-10" />
        <div>
          <p className="text-sm font-bold text-zinc-100">Universal — Daily Command</p>
          <p className="text-[11px] text-zinc-500">Version 1.0.0</p>
        </div>
      </div>

      <div className="mx-5">
        <CollapsibleSection title="Profile" icon={User}>
          <ProfileForm settings={settings} accent={accent} onSave={(patch) => onUpdate({ ...settings, ...patch })} />
        </CollapsibleSection>

        <CollapsibleSection title="Accent color" icon={Palette}>
          <div className="grid grid-cols-3 gap-2.5">
            {Object.entries(ACCENTS).map(([key, acc]) => (
              <button
                key={key} onClick={() => onUpdate({ ...settings, accent: key })}
                className="flex flex-col items-center gap-2 py-3 rounded-2xl border bg-zinc-900"
                style={{ borderColor: settings.accent === key ? acc.hex : "rgb(39 39 42)" }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: acc.hex }}>
                  {settings.accent === key && <Check size={14} className="text-zinc-950" />}
                </div>
                <span className="text-[11px] font-medium text-zinc-400">{acc.name}</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>

        <div className="mb-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Mock notifications</p>
              <p className="text-xs text-zinc-500 mt-0.5">Simulated reminders for due events</p>
            </div>
            <ToggleSwitch checked={settings.notifications} onChange={(v) => onUpdate({ ...settings, notifications: v })} accent={accent} />
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold mb-2">Data</p>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="w-full py-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm font-semibold">
              Clear local storage
            </button>
          ) : (
            <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4">
              <p className="text-xs text-zinc-400 mb-3">This erases all events, tasks, and notes on this device. This can't be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold">Cancel</button>
                <button onClick={() => { onClearData(); setConfirming(false); }} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-zinc-950 text-sm font-bold">Confirm</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Bottom nav ---------- */

function BottomNav({ active, setActive, accent }) {
  const tabs = [
    { key: "calendar", icon: Calendar, label: "Calendar" },
    { key: "events", icon: Bell, label: "Events" },
    { key: "tasks", icon: ListChecks, label: "Tasks" },
    { key: "settings", icon: Settings, label: "Settings" },
  ];
  return (
    <div className="shrink-0 bg-zinc-950 border-t border-zinc-900 flex" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative active:scale-95 transition"
          >
            {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full" style={{ backgroundColor: accent.hex }} />}
            <t.icon size={20} style={isActive ? { color: accent.hex } : {}} className={isActive ? "" : "text-zinc-600"} />
            <span className="text-[10px] font-semibold" style={isActive ? { color: accent.hex } : { color: "rgb(82 82 91)" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- App ---------- */

export default function App() {
  const [active, setActive] = useState("calendar");
  const [now, setNow] = useState(new Date());
  const [events, setEvents] = usePersistentState("universal.events", INITIAL_EVENTS);
  const [notes, setNotes] = usePersistentState("universal.notes", INITIAL_NOTES);
  const [tasks, setTasks] = usePersistentState("universal.tasks", INITIAL_TASKS);
  const [settings, setSettings] = usePersistentState("universal.settings", INITIAL_SETTINGS);
  const [categories, setCategories] = usePersistentState("universal.categories", DEFAULT_CATEGORIES);
  const [selectedDate, setSelectedDate] = useState(null);
  const [toast, setToast] = useState("");
  const [showSplash, setShowSplash] = useState(true);

  // One-time migration for anyone with an older save that used "role" instead of "aim".
  useEffect(() => {
    if (settings.role && !settings.aim) {
      setSettings((prev) => {
        const { role, ...rest } = prev;
        return { ...rest, aim: role };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const accent = ACCENTS[settings.accent];

  function addEvent(ev) {
    setEvents((prev) => [...prev, { ...ev, id: nextId() }]);
    setToast("Event added");
  }
  function completeEvent(id) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: e.status === "done" ? "pending" : "done" } : e));
  }
  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setToast("Event deleted");
  }

  function addCategory(name, color) {
    setCategories((prev) => [...prev, { id: nextId(), name, color }]);
  }
  function renameCategory(id, name) {
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
  }
  function deleteCategory(id) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  function addNote(key, text) {
    setNotes((prev) => ({ ...prev, [key]: [...(prev[key] || []), { id: nextId(), text }] }));
  }
  function deleteNote(key, id) {
    setNotes((prev) => ({ ...prev, [key]: (prev[key] || []).filter((n) => n.id !== id) }));
  }

  function addTask(quadrant, text) {
    setTasks((prev) => ({ ...prev, [quadrant]: [...prev[quadrant], { id: nextId(), text, done: false }] }));
  }
  function toggleTaskDone(quadrant, id) {
    setTasks((prev) => ({
      ...prev,
      [quadrant]: prev[quadrant].map((t) => t.id === id ? { ...t, done: !t.done } : t),
    }));
  }
  function moveTask(fromKey, toKey, id) {
    setTasks((prev) => {
      const task = prev[fromKey].find((t) => t.id === id);
      if (!task) return prev;
      return {
        ...prev,
        [fromKey]: prev[fromKey].filter((t) => t.id !== id),
        [toKey]: [...prev[toKey], task],
      };
    });
  }
  function deleteTask(quadrant, id) {
    setTasks((prev) => ({ ...prev, [quadrant]: prev[quadrant].filter((t) => t.id !== id) }));
  }

  function clearAllData() {
    window.localStorage.removeItem("universal.events");
    window.localStorage.removeItem("universal.notes");
    window.localStorage.removeItem("universal.tasks");
    setEvents([]);
    setNotes({});
    setTasks({ do: [], schedule: [], delegate: [], delete: [] });
    setToast("All data cleared");
  }

  return (
    <div className="h-screen w-full max-w-md mx-auto bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes fadeslide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeslide { animation: fadeslide 0.25s ease-out; }
        @keyframes sheetup { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-sheetup { animation: sheetup 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.6; }
      `}</style>

      <div className="flex-1 overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {active === "calendar" && (
          <CalendarView notes={notes} events={events} accent={accent} onOpenDay={setSelectedDate} />
        )}
        {active === "events" && (
          <EventsView
            events={events} now={now} accent={accent} categories={categories}
            onAdd={addEvent} onComplete={completeEvent} onDelete={deleteEvent}
            onAddCategory={addCategory} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory}
          />
        )}
        {active === "tasks" && (
          <TasksView tasks={tasks} accent={accent} onAdd={addTask} onMove={moveTask} onDelete={deleteTask} onToggleDone={toggleTaskDone} />
        )}
        {active === "settings" && (
          <SettingsView settings={settings} onUpdate={setSettings} onClearData={clearAllData} accent={accent} />
        )}
      </div>

      <BottomNav active={active} setActive={setActive} accent={accent} />

      {selectedDate && (
        <DateSheet
          date={selectedDate} notes={notes} events={events} categories={categories}
          onAddNote={addNote} onDeleteNote={deleteNote}
          onClose={() => setSelectedDate(null)} accent={accent}
        />
      )}

      <Toast message={toast} />
      <SplashScreen visible={showSplash} />
    </div>
  );
}
