import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPatchJson, apiPost } from "../../api.js";

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

  const load = useCallback(() => {
    setMsg(null);
    Promise.all([apiGet("/api/admin/internal-notes"), apiGet("/api/admin/tasks")])
      .then(([n, t]) => {
        setNotes(Array.isArray(n) ? n : []);
        setTasks(Array.isArray(t) ? t : []);
      })
      .catch(() => setMsg("بارگذاری ناموفق بود."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async (e) => {
    e.preventDefault();
    const body = newNote.trim();
    if (!body) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/internal-notes", { body });
      setNewNote("");
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const saveEditNote = async (id) => {
    const body = editNoteBody.trim();
    if (!body) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiPatchJson(`/api/admin/internal-notes/${id}`, { body });
      setEditNoteId(null);
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (id) => {
    if (!window.confirm("این یادداشت حذف شود؟")) return;
    setBusy(true);
    try {
      await apiDelete(`/api/admin/internal-notes/${id}`);
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiPost("/api/admin/tasks", {
        title,
        body: newTaskBody.trim() || undefined,
        due_at: newDue.trim() || undefined,
      });
      setNewTitle("");
      setNewTaskBody("");
      setNewDue("");
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleTask = async (id, done) => {
    try {
      await apiPatchJson(`/api/admin/tasks/${id}`, { done: !done });
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    }
  };

  const removeTask = async (id) => {
    if (!window.confirm("این کار حذف شود؟")) return;
    try {
      await apiDelete(`/api/admin/tasks/${id}`);
      load();
    } catch (err) {
      setMsg(err.message || String(err));
    }
  };

  return (
    <>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: "var(--space-md)" }}>
        <Link to="/admin">← داشبورد</Link>
      </p>

      <section className="dashboard-panel">
        <h2>یادداشت‌های داخلی</h2>
        <p className="field-hint">
          فقط در این پنل ذخیره می‌شود؛ برای هماهنگی تیم سوپرادمین. در سایت عمومی نمایش داده نمی‌شود.
        </p>
        <form onSubmit={addNote} className="form-grid" style={{ maxWidth: "40rem", marginTop: "1rem" }}>
          <div className="field field--block">
            <label htmlFor="admin-new-note">یادداشت جدید</label>
            <textarea
              id="admin-new-note"
              rows={4}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="متن یادداشت…"
            />
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !newNote.trim()}>
              افزودن یادداشت
            </button>
          </div>
        </form>

        <ul className="admin-notes-list" style={{ listStyle: "none", padding: 0, margin: "1.25rem 0 0" }}>
          {notes.map((n) => (
            <li
              key={n.id}
              className="dashboard-panel"
              style={{
                marginBottom: "0.75rem",
                padding: "1rem",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {editNoteId === n.id ? (
                <>
                  <textarea
                    rows={5}
                    value={editNoteBody}
                    onChange={(e) => setEditNoteBody(e.target.value)}
                    style={{ width: "100%", marginBottom: "0.5rem" }}
                  />
                  <div className="dashboard-actions dashboard-actions--inline">
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => saveEditNote(n.id)}>
                      ذخیره
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy}
                      onClick={() => setEditNoteId(null)}
                    >
                      انصراف
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 0.5rem", whiteSpace: "pre-wrap" }}>{n.body}</p>
                  <p className="field-hint" dir="ltr" style={{ margin: 0 }}>
                    به‌روز: {n.updated_at || n.created_at}
                  </p>
                  <div className="dashboard-actions dashboard-actions--inline" style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditNoteId(n.id);
                        setEditNoteBody(n.body || "");
                      }}
                    >
                      ویرایش
                    </button>
                    <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => removeNote(n.id)}>
                      حذف
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {!notes.length ? <p className="field-hint">هنوز یادداشتی نیست.</p> : null}
      </section>

      <section className="dashboard-panel" style={{ marginTop: "1.5rem" }}>
        <h2>کارها (چک‌لیست)</h2>
        <p className="field-hint">کارهای باز بالاتر نمایش داده می‌شوند؛ با تیک زدن به «انجام‌شده» می‌روند.</p>
        <form onSubmit={addTask} className="form-grid" style={{ maxWidth: "40rem", marginTop: "1rem" }}>
          <div className="field field--block">
            <label htmlFor="admin-task-title">عنوان کار</label>
            <input
              id="admin-task-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثلاً پیگیری آگهی X"
              dir="auto"
            />
          </div>
          <div className="field field--block">
            <label htmlFor="admin-task-body">جزئیات (اختیاری)</label>
            <textarea
              id="admin-task-body"
              rows={2}
              value={newTaskBody}
              onChange={(e) => setNewTaskBody(e.target.value)}
            />
          </div>
          <div className="field field--block">
            <label htmlFor="admin-task-due">سررسید (اختیاری)</label>
            <input
              id="admin-task-due"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="dashboard-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !newTitle.trim()}>
              افزودن کار
            </button>
          </div>
        </form>

        <ul style={{ listStyle: "none", padding: 0, margin: "1.25rem 0 0" }}>
          {tasks.map((t) => (
            <li
              key={t.id}
              className="dashboard-panel"
              style={{
                marginBottom: "0.5rem",
                padding: "0.75rem 1rem",
                border: "1px solid rgba(0,0,0,0.08)",
                opacity: t.done ? 0.75 : 1,
              }}
            >
              <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!t.done}
                  onChange={() => toggleTask(t.id, !!t.done)}
                  style={{ marginTop: "0.35rem" }}
                />
                <span style={{ flex: 1 }}>
                  <strong style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</strong>
                  {t.body ? (
                    <span style={{ display: "block", marginTop: "0.35rem", whiteSpace: "pre-wrap" }} className="field-hint">
                      {t.body}
                    </span>
                  ) : null}
                  {t.due_at ? (
                    <span className="field-hint" dir="ltr" style={{ display: "block", marginTop: "0.25rem" }}>
                      سررسید: {t.due_at}
                    </span>
                  ) : null}
                </span>
              </label>
              <div className="dashboard-actions dashboard-actions--inline" style={{ marginTop: "0.5rem" }}>
                <button type="button" className="btn btn--ghost" onClick={() => removeTask(t.id)}>
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!tasks.length ? <p className="field-hint">کاری ثبت نشده است.</p> : null}
      </section>

      {msg ? (
        <p className="field-hint" style={{ color: "#b71c1c", marginTop: "1rem" }}>
          {msg}
        </p>
      ) : null}
    </>
  );
}
