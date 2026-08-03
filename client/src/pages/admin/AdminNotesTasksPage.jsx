import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatchJson, apiPost } from "../../api.js";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return String(iso).slice(0, 16); }
}

function isDueClose(due_at) {
  if (!due_at) return false;
  const diff = new Date(due_at) - Date.now();
  return diff > 0 && diff < 86_400_000 * 2;
}

function isDueOver(due_at) {
  if (!due_at) return false;
  return new Date(due_at) < Date.now();
}

export default function AdminNotesTasksPage() {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTaskBody, setNewTaskBody] = useState("");
  const [newDue, setNewDue] = useState("");
  const [editNoteId, setEditNoteId] = useState(null);
  const [editNoteBody, setEditNoteBody] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [noteTab, setNoteTab] = useState("notes"); // notes | tasks

  const load = useCallback(() => {
    setMsg(null);
    Promise.all([apiGet("/api/admin/internal-notes"), apiGet("/api/admin/tasks")])
      .then(([n, t]) => {
        setNotes(Array.isArray(n) ? n : []);
        setTasks(Array.isArray(t) ? t : []);
      })
      .catch(() => setMsg("بارگذاری ناموفق بود."));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNote = async (e) => {
    e.preventDefault();
    const body = newNote.trim();
    if (!body) return;
    setBusy(true); setMsg(null);
    try {
      await apiPost("/api/admin/internal-notes", { body });
      setNewNote("");
      load();
    } catch (err) { setMsg(err.message || String(err)); }
    finally { setBusy(false); }
  };

  const saveEditNote = async (id) => {
    const body = editNoteBody.trim();
    if (!body) return;
    setBusy(true); setMsg(null);
    try {
      await apiPatchJson(`/api/admin/internal-notes/${id}`, { body });
      setEditNoteId(null);
      load();
    } catch (err) { setMsg(err.message || String(err)); }
    finally { setBusy(false); }
  };

  const removeNote = async (id) => {
    if (!window.confirm("این یادداشت حذف شود؟")) return;
    setBusy(true);
    try { await apiDelete(`/api/admin/internal-notes/${id}`); load(); }
    catch (err) { setMsg(err.message || String(err)); }
    finally { setBusy(false); }
  };

  const addTask = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true); setMsg(null);
    try {
      await apiPost("/api/admin/tasks", { title, body: newTaskBody.trim() || undefined, due_at: newDue.trim() || undefined });
      setNewTitle(""); setNewTaskBody(""); setNewDue("");
      load();
    } catch (err) { setMsg(err.message || String(err)); }
    finally { setBusy(false); }
  };

  const toggleTask = async (id, done) => {
    try { await apiPatchJson(`/api/admin/tasks/${id}`, { done: !done }); load(); }
    catch (err) { setMsg(err.message || String(err)); }
  };

  const removeTask = async (id) => {
    if (!window.confirm("این کار حذف شود؟")) return;
    try { await apiDelete(`/api/admin/tasks/${id}`); load(); }
    catch (err) { setMsg(err.message || String(err)); }
  };

  const openTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  return (
    <>
      {/* Page header */}
      <div className="panel-page-title">
        <div>
          <h2>یادد��شت‌ها و کارها</h2>
          <p>فقط برای تیم سوپرادمین — در سایت عمومی نمایش داده نمی‌شود</p>
        </div>
        <Link to="/admin" className="pact-btn pact-btn--ghost">
          <i className="fa-solid fa-arrow-right" /> بازگشت به داشبورد
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {[["notes", `یادداشت‌ها (${notes.length})`, "fa-sticky-note"], ["tasks", `کارها (${openTasks.length} باز)`, "fa-list-check"]].map(([key, label, icon]) => (
          <button key={key} type="button" onClick={() => setNoteTab(key)} style={{
            padding: "0.55rem 1.1rem", borderRadius: 10, border: "1.5px solid",
            fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: "0.4rem",
            background: noteTab === key ? "#6366f1" : "#fff",
            color: noteTab === key ? "#fff" : "#475569",
            borderColor: noteTab === key ? "#6366f1" : "#e2e8f0",
          }}>
            <i className={`fa-solid ${icon}`} style={{ fontSize: "0.85rem" }} />
            {label}
          </button>
        ))}
      </div>

      {msg && <div className="panel-form-msg panel-form-msg--error" style={{ marginBottom: "1rem" }}>{msg}</div>}

      {/* ── NOTES TAB ── */}
      {noteTab === "notes" && (
        <div className="panel-cols" style={{ alignItems: "start" }}>

          {/* Add note form */}
          <div className="panel-card">
            <div className="panel-card__head">
              <h3 className="panel-card__title">
                <i className="fa-solid fa-pen" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                یادداشت جدید
              </h3>
            </div>
            <div className="panel-card__body">
              <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.5 }}>
                فقط در این پنل ذخیره می‌شود؛ برای هماهنگی تیم سوپرادمین. در سایت عمومی نمایش داده نمی‌شود.
              </p>
              <form onSubmit={addNote}>
                <div className="pfield">
                  <label htmlFor="admin-new-note">متن یادداشت</label>
                  <textarea
                    id="admin-new-note"
                    rows={5}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="یادداشت خود را اینجا بنویسید…"
                  />
                </div>
                <div className="panel-form-actions">
                  <button type="submit" className="pbtn pbtn--primary" disabled={busy || !newNote.trim()}>
                    {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
                    افزودن یادداشت
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Notes list */}
          <div className="panel-card">
            <div className="panel-card__head">
              <h3 className="panel-card__title">
                <i className="fa-solid fa-clock-rotate-left" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                یادداشت‌ها
              </h3>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{notes.length} مورد</span>
            </div>
            {notes.length === 0 ? (
              <div style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
                <i className="fa-regular fa-sticky-note" style={{ fontSize: "2rem", color: "#e2e8f0", display: "block", marginBottom: "0.5rem" }} />
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>هنوز یادداشتی نیست.</p>
              </div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="panel-note-card">
                  {editNoteId === n.id ? (
                    <>
                      <div className="pfield" style={{ marginBottom: "0.75rem" }}>
                        <textarea
                          rows={5}
                          value={editNoteBody}
                          onChange={(e) => setEditNoteBody(e.target.value)}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="button" className="pact-btn pact-btn--primary" disabled={busy} onClick={() => saveEditNote(n.id)}>ذخیره</button>
                        <button type="button" className="pact-btn pact-btn--ghost" disabled={busy} onClick={() => setEditNoteId(null)}>انصراف</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="panel-note-card__body">{n.body}</p>
                      <p className="panel-note-card__meta">{formatDate(n.updated_at || n.created_at)}</p>
                      <div className="panel-note-card__actions">
                        <button type="button" className="pact-btn pact-btn--ghost" disabled={busy}
                          onClick={() => { setEditNoteId(n.id); setEditNoteBody(n.body || ""); }}>
                          <i className="fa-solid fa-pen" /> ویرایش
                        </button>
                        <button type="button" className="pact-btn pact-btn--danger" disabled={busy} onClick={() => removeNote(n.id)}>
                          <i className="fa-solid fa-trash" /> حذف
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {noteTab === "tasks" && (
        <div className="panel-cols" style={{ alignItems: "start" }}>

          {/* Add task form */}
          <div className="panel-card">
            <div className="panel-card__head">
              <h3 className="panel-card__title">
                <i className="fa-solid fa-plus" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                افزودن کار جدید
              </h3>
            </div>
            <div className="panel-card__body">
              <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#94a3b8" }}>
                کارهای باز بالاتر نمایش داده می‌شوند؛ با تیک زدن به «انجام‌شده» می‌روند.
              </p>
              <form onSubmit={addTask} style={{ display: "flex", flexDirection: "column" }}>
                <div className="pfield">
                  <label htmlFor="admin-task-title">عنوان کار *</label>
                  <input
                    id="admin-task-title"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="مثلاً پیگیری آگهی X"
                    dir="auto"
                    required
                  />
                </div>
                <div className="pfield" style={{ marginTop: "1rem" }}>
                  <label htmlFor="admin-task-body">جزئیات (اختیاری)</label>
                  <textarea
                    id="admin-task-body"
                    rows={2}
                    value={newTaskBody}
                    onChange={(e) => setNewTaskBody(e.target.value)}
                    placeholder="توضیحات بیشتر…"
                  />
                </div>
                <div className="pfield" style={{ marginTop: "1rem" }}>
                  <label htmlFor="admin-task-due">سررسید (اختیاری)</label>
                  <input
                    id="admin-task-due"
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="panel-form-actions">
                  <button type="submit" className="pbtn pbtn--primary" disabled={busy || !newTitle.trim()}>
                    {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
                    افزودن کار
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Task list */}
          <div>
            {/* Open tasks */}
            <div className="panel-card" style={{ marginBottom: "1rem" }}>
              <div className="panel-card__head">
                <h3 className="panel-card__title">
                  <i className="fa-regular fa-circle" style={{ marginInlineEnd: "0.5rem", color: "#818cf8" }} />
                  کارهای باز
                </h3>
                <span className="pbadge pbadge--blue">{openTasks.length}</span>
              </div>
              {openTasks.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center" }}>
                  <i className="fa-solid fa-party-horn" style={{ fontSize: "1.5rem", color: "#a5b4fc", display: "block", marginBottom: "0.4rem" }} />
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>همه کارها انجام شده‌اند!</p>
                </div>
              ) : (
                openTasks.map((t) => (
                  <div key={t.id} className="panel-task-item">
                    <input
                      type="checkbox"
                      className="panel-task-cb"
                      checked={false}
                      onChange={() => toggleTask(t.id, false)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="panel-task__title">{t.title}</p>
                      {t.body ? <p className="panel-task__body">{t.body}</p> : null}
                      {t.due_at ? (
                        <p className="panel-task__due" style={{ color: isDueOver(t.due_at) ? "#dc2626" : isDueClose(t.due_at) ? "#f59e0b" : "#818cf8" }}>
                          <i className="fa-solid fa-calendar-days" style={{ marginInlineEnd: "0.3rem" }} />
                          سررسید: {t.due_at}
                          {isDueOver(t.due_at) ? " — گذشته!" : isDueClose(t.due_at) ? " — نزدیک!" : ""}
                        </p>
                      ) : null}
                    </div>
                    <button type="button" className="pact-btn pact-btn--danger" onClick={() => removeTask(t.id)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Done tasks */}
            {doneTasks.length > 0 && (
              <div className="panel-card">
                <div className="panel-card__head">
                  <h3 className="panel-card__title" style={{ color: "#94a3b8" }}>
                    <i className="fa-solid fa-circle-check" style={{ marginInlineEnd: "0.5rem", color: "#10b981" }} />
                    انجام‌شده‌ها
                  </h3>
                  <span className="pbadge pbadge--green">{doneTasks.length}</span>
                </div>
                {doneTasks.map((t) => (
                  <div key={t.id} className="panel-task-item panel-task-item--done">
                    <input
                      type="checkbox"
                      className="panel-task-cb"
                      checked={true}
                      onChange={() => toggleTask(t.id, true)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="panel-task__title panel-task__title--done">{t.title}</p>
                      {t.body ? <p className="panel-task__body">{t.body}</p> : null}
                    </div>
                    <button type="button" className="pact-btn pact-btn--ghost" style={{ fontSize: "0.72rem" }} onClick={() => removeTask(t.id)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
