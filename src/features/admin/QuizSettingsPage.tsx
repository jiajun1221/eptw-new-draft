import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "../../domain/types";
import { readTutorialResources, saveTutorialResources, TUTORIAL_CATEGORIES, type TutorialCategory, type TutorialResource } from "../../domain/tutorialStore";
import AdminActionButtons from "./AdminActionButtons";

export type QuizQuestion = { id: string; prompt: string; options: string[]; correctIndex: number };
export type QuizConfig = { questionsPerAttempt: number; maxAttempts: number; passPercentage: number; questions: QuizQuestion[] };
const QUIZ_CONFIG_KEY = "eptw-quiz-config:v1";
const DEFAULT_QUESTIONS: QuizQuestion[] = [
  { id: "approval", prompt: "What must happen before controlled work begins?", options: ["The permit must be approved", "A verbal agreement is enough", "Approval can happen after work starts"], correctIndex: 0 },
  { id: "change", prompt: "What should you do if site conditions change?", options: ["Continue and report it later", "Stop work and reassess the permit", "Ignore the change if work is nearly complete"], correctIndex: 1 },
  { id: "closure", prompt: "When can a permit be closed?", options: ["At any time by the requestor", "After completion checks and authorised confirmation", "Automatically at the end of a shift"], correctIndex: 1 },
];
export const DEFAULT_QUIZ_CONFIG: QuizConfig = { questionsPerAttempt: 3, maxAttempts: 3, passPercentage: 100, questions: DEFAULT_QUESTIONS };

export function readQuizConfig(): QuizConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(QUIZ_CONFIG_KEY) ?? "null") as Partial<QuizConfig> | null;
    if (!stored?.questions?.length) return DEFAULT_QUIZ_CONFIG;
    const questions = stored.questions.filter((question) => question.prompt && question.options?.length >= 2 && question.correctIndex >= 0 && question.correctIndex < question.options.length);
    if (!questions.length) return DEFAULT_QUIZ_CONFIG;
    return { questions, questionsPerAttempt: Math.max(1, Math.min(questions.length, Number(stored.questionsPerAttempt) || DEFAULT_QUIZ_CONFIG.questionsPerAttempt)), maxAttempts: Math.max(1, Number(stored.maxAttempts) || DEFAULT_QUIZ_CONFIG.maxAttempts), passPercentage: Math.max(1, Math.min(100, Number(stored.passPercentage) || DEFAULT_QUIZ_CONFIG.passPercentage)) };
  } catch { return DEFAULT_QUIZ_CONFIG; }
}
function saveQuizConfig(config: QuizConfig) { localStorage.setItem(QUIZ_CONFIG_KEY, JSON.stringify(config)); }
const emptyQuestion = () => ({ prompt: "", options: ["", "", "", ""], correctIndex: 0 });
const todayLabel = () => `Updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}`;
const emptyTutorial = (order: number) => ({ order, title: "", category: "Getting started" as TutorialCategory, updateInfo: todayLabel(), fileName: "", videoDataUrl: "" });

export default function QuizSettingsPage({ user }: { user: User }) {
  const [config, setConfig] = useState(readQuizConfig);
  const [form, setForm] = useState(emptyQuestion);
  const [editingId, setEditingId] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [tutorials, setTutorials] = useState(readTutorialResources);
  const [tutorialForm, setTutorialForm] = useState(() => emptyTutorial(readTutorialResources().length + 1));
  const [editingTutorialId, setEditingTutorialId] = useState<string>();
  const [showTutorialForm, setShowTutorialForm] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [activeTab, setActiveTab] = useState<"tutorial" | "quiz">("tutorial");
  if (!["SUPER_ADMIN", "USER_ADMIN"].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const persist = (next: QuizConfig, confirmation: string) => { saveQuizConfig(next); setConfig(next); setMessage(confirmation); };
  const saveSettings = (event: FormEvent) => { event.preventDefault(); persist({ ...config, questionsPerAttempt: Math.min(config.questionsPerAttempt, config.questions.length) }, "Quiz settings saved."); };
  const saveQuestion = (event: FormEvent) => {
    event.preventDefault();
    const options = form.options.map((option) => option.trim()).filter(Boolean);
    if (!form.prompt.trim() || options.length < 2 || form.correctIndex >= options.length) return;
    const question: QuizQuestion = { id: editingId ?? crypto.randomUUID(), prompt: form.prompt.trim(), options, correctIndex: form.correctIndex };
    const questions = editingId ? config.questions.map((item) => item.id === editingId ? question : item) : [...config.questions, question];
    persist({ ...config, questions }, editingId ? "Question updated." : "Question added to the pool.");
    setForm(emptyQuestion()); setEditingId(undefined); setShowForm(false);
  };
  const editQuestion = (question: QuizQuestion) => { setForm({ prompt: question.prompt, options: [...question.options, ...Array(Math.max(0, 4 - question.options.length)).fill("")], correctIndex: question.correctIndex }); setEditingId(question.id); setShowForm(true); setMessage(""); };
  const deleteQuestion = (question: QuizQuestion) => {
    if (config.questions.length === 1 || !window.confirm(`Delete “${question.prompt}”?`)) return;
    const questions = config.questions.filter((item) => item.id !== question.id);
    persist({ ...config, questions, questionsPerAttempt: Math.min(config.questionsPerAttempt, questions.length) }, "Question deleted.");
  };
  const openTutorialForm = (tutorial?: TutorialResource) => {
    setEditingTutorialId(tutorial?.id);
    setTutorialForm(tutorial ? { order: tutorial.order, title: tutorial.title, category: tutorial.category, updateInfo: tutorial.updateInfo, fileName: tutorial.fileName ?? "", videoDataUrl: tutorial.videoDataUrl ?? "" } : emptyTutorial(tutorials.length + 1));
    setVideoError(""); setMessage(""); setShowTutorialForm(true);
  };
  const selectVideo = (file?: File) => {
    setVideoError("");
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setVideoError("For this browser demo, upload a video smaller than 3 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setTutorialForm((current) => ({ ...current, fileName: file.name, videoDataUrl: String(reader.result ?? "") }));
    reader.onerror = () => setVideoError("The selected video could not be read. Try another file.");
    reader.readAsDataURL(file);
  };
  const saveTutorial = (event: FormEvent) => {
    event.preventDefault();
    if (!tutorialForm.title.trim() || !tutorialForm.updateInfo.trim() || !tutorialForm.fileName) { setVideoError("Add a title, update information, and video file."); return; }
    const resource: TutorialResource = { id: editingTutorialId ?? crypto.randomUUID(), ...tutorialForm, title: tutorialForm.title.trim(), updateInfo: tutorialForm.updateInfo.trim(), order: Math.max(1, Number(tutorialForm.order) || 1) };
    const next = (editingTutorialId ? tutorials.map((item) => item.id === editingTutorialId ? resource : item) : [...tutorials, resource]).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    try { saveTutorialResources(next); setTutorials(next); setShowTutorialForm(false); setEditingTutorialId(undefined); setMessage(editingTutorialId ? "Tutorial video updated." : "Tutorial video added."); }
    catch { setVideoError("The video is too large for browser storage. Choose a smaller file."); }
  };
  const deleteTutorial = (tutorial: TutorialResource) => {
    if (!window.confirm(`Delete “${tutorial.title}”?`)) return;
    const next = tutorials.filter((item) => item.id !== tutorial.id);
    saveTutorialResources(next); setTutorials(next); setMessage("Tutorial video deleted.");
  };

  return <div className={`page quiz-settings-page tab-${activeTab}`}>
    <header className="page-header"><div><span className="eyebrow">System management</span><h1>Tutorial &amp; Quiz</h1><p>Manage tutorial videos and the account-activation assessment in separate workspaces.</p></div><div className="tutorial-admin-actions">{activeTab === "tutorial" ? <button className="button primary" type="button" onClick={() => openTutorialForm()}>+ Add video</button> : <button className="button primary" type="button" onClick={() => { setForm(emptyQuestion()); setEditingId(undefined); setShowForm(true); setMessage(""); }}>+ Add question</button>}</div></header>
    <nav className="tutorial-quiz-tabs" role="tablist" aria-label="Tutorial and quiz management"><button type="button" role="tab" aria-selected={activeTab === "tutorial"} className={activeTab === "tutorial" ? "active" : ""} onClick={() => { setActiveTab("tutorial"); setShowForm(false); setMessage(""); }}>Tutorial</button><button type="button" role="tab" aria-selected={activeTab === "quiz"} className={activeTab === "quiz" ? "active" : ""} onClick={() => { setActiveTab("quiz"); setShowTutorialForm(false); setMessage(""); }}>Quiz</button></nav>
    {activeTab === "tutorial" && message && <p className="form-message success tutorial-tab-message" role="status">{message}</p>}
    {showTutorialForm && <form className="card tutorial-video-form" onSubmit={saveTutorial}><div className="site-form-head"><div><span className="settings-kicker">Tutorial library</span><h2>{editingTutorialId ? "Edit" : "Add"} tutorial video</h2><p>Set the card title, section, display order, update information, and video file.</p></div><button type="button" aria-label="Close video form" onClick={() => setShowTutorialForm(false)}>×</button></div><div className="tutorial-video-form-grid"><label>Title<input aria-label="Tutorial title" required value={tutorialForm.title} onChange={(event) => setTutorialForm({ ...tutorialForm, title: event.target.value })} placeholder="e.g. Introduction to ePTW" /></label><label>Section<select aria-label="Tutorial section" value={tutorialForm.category} onChange={(event) => setTutorialForm({ ...tutorialForm, category: event.target.value as TutorialCategory })}>{TUTORIAL_CATEGORIES.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label>Display order<input aria-label="Tutorial display order" type="number" min="1" required value={tutorialForm.order} onChange={(event) => setTutorialForm({ ...tutorialForm, order: Number(event.target.value) })} /></label><label>Update information<input aria-label="Tutorial update information" required value={tutorialForm.updateInfo} onChange={(event) => setTutorialForm({ ...tutorialForm, updateInfo: event.target.value })} placeholder="e.g. Updated 30 October 2026" /></label><label className="tutorial-video-upload">Video file<input aria-label="Tutorial video file" type="file" accept="video/*" onChange={(event) => selectVideo(event.target.files?.[0])} /><small>{tutorialForm.fileName || "MP4, WebM, or another browser-supported video format"}</small></label></div>{videoError && <p className="form-message error" role="alert">{videoError}</p>}<div className="site-form-actions"><button className="button ghost" type="button" onClick={() => setShowTutorialForm(false)}>Cancel</button><button className="button primary" type="submit">{editingTutorialId ? "Save video" : "Add video"}</button></div></form>}
    <section className="card tutorial-admin-card"><div className="quiz-pool-heading"><div><span className="settings-kicker">Tutorial library</span><h2>Tutorial videos</h2><p>Videos appear in this order on the Tutorial &amp; Quiz page.</p></div><b>{tutorials.length} videos</b></div><div className="tutorial-admin-table-wrap"><table className="tutorial-admin-table"><thead><tr><th>Order</th><th>Title</th><th>Section</th><th>Update information</th><th>Video</th><th>Action</th></tr></thead><tbody>{tutorials.map((tutorial) => <tr key={tutorial.id}><td><b>{String(tutorial.order).padStart(2, "0")}</b></td><td><strong>{tutorial.title}</strong></td><td><span className="tutorial-category">{tutorial.category}</span></td><td>{tutorial.updateInfo}</td><td>{tutorial.fileName ? <span className="tutorial-file-ready">● {tutorial.fileName}</span> : <span className="tutorial-file-missing">Not uploaded</span>}</td><td><AdminActionButtons label={tutorial.title} onEdit={() => openTutorialForm(tutorial)} onDelete={() => deleteTutorial(tutorial)} /></td></tr>)}</tbody></table></div></section>
    <section className="card quiz-config-card"><div><span className="settings-kicker">Quiz rules</span><h2>Assessment settings</h2><p>Questions are selected randomly from the pool for every new attempt.</p></div><form onSubmit={saveSettings}><label>Questions per attempt<input aria-label="Questions per attempt" type="number" min="1" max={config.questions.length} value={config.questionsPerAttempt} onChange={(event) => { setConfig({ ...config, questionsPerAttempt: Number(event.target.value) }); setMessage(""); }} /></label><label>Attempt limit<input aria-label="Attempt limit" type="number" min="1" max="20" value={config.maxAttempts} onChange={(event) => { setConfig({ ...config, maxAttempts: Number(event.target.value) }); setMessage(""); }} /></label><label>Pass mark (%)<input aria-label="Pass mark" type="number" min="1" max="100" value={config.passPercentage} onChange={(event) => { setConfig({ ...config, passPercentage: Number(event.target.value) }); setMessage(""); }} /></label><button className="button primary" type="submit">Save settings</button></form><div className="quiz-config-summary"><span><b>{config.questions.length}</b> questions in pool</span><span><b>{config.questionsPerAttempt}</b> randomly selected</span><span><b>{config.maxAttempts}</b> attempt{config.maxAttempts === 1 ? "" : "s"}</span></div>{message && <p className="form-message success" role="status">{message}</p>}</section>
    {showForm && <form className="card quiz-question-form" onSubmit={saveQuestion}><div className="site-form-head"><div><h2>{editingId ? "Edit" : "Add"} question</h2><p>Enter the question, answer choices, and correct answer.</p></div><button type="button" aria-label="Close question form" onClick={() => setShowForm(false)}>×</button></div><label className="quiz-question-prompt">Question<input aria-label="Question" required value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} /></label><div className="quiz-option-grid">{form.options.map((option, index) => <label key={index}>Answer {index + 1}{index > 1 && <small> Optional</small>}<input aria-label={`Answer ${index + 1}`} required={index < 2} value={option} onChange={(event) => setForm({ ...form, options: form.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /></label>)}</div><label>Correct answer<select aria-label="Correct answer" value={form.correctIndex} onChange={(event) => setForm({ ...form, correctIndex: Number(event.target.value) })}>{form.options.map((option, index) => option.trim() && <option value={index} key={index}>Answer {index + 1}: {option}</option>)}</select></label><div className="site-form-actions"><button className="button ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="button primary" type="submit">{editingId ? "Save question" : "Add to pool"}</button></div></form>}
    <section className="card quiz-pool-card"><div className="quiz-pool-heading"><div><h2>Question pool</h2><p>Each attempt uses a random selection from these questions.</p></div><b>{config.questions.length} total</b></div><table className="quiz-pool-table"><thead><tr><th>#</th><th>Question</th><th>Correct answer</th><th>Choices</th><th>Action</th></tr></thead><tbody>{config.questions.map((question, index) => <tr key={question.id}><td>{index + 1}</td><td><strong>{question.prompt}</strong></td><td>{question.options[question.correctIndex]}</td><td>{question.options.length}</td><td><AdminActionButtons label={question.prompt} onEdit={() => editQuestion(question)} onDelete={() => deleteQuestion(question)} /></td></tr>)}</tbody></table></section>
  </div>;
}
