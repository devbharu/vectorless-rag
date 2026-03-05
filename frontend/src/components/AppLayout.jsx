import { useEffect, useState, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { gsap } from "gsap";
import {
  Plus, FileText, Send, Sparkles,
  Bot, User, Loader2,
  Zap, Copy, Check, Eye, X, LogOut,
  MessageSquare, Trash2, ChevronDown, Clock, UserCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

export default function App({ onLogout, username }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocName, setSelectedDocName] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  // Chat history state
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("documents"); // "documents" | "history"

  // User dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    if (onLogout) onLogout();
    navigate("/login");
  };
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sidebarRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
    fetchSessions();
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    gsap.fromTo(sidebarRef.current,
      { x: -70, opacity: 0 },
      { x: 0, opacity: 1, duration: 1.1, ease: "power3.out" }
    );
  }, []);

  useEffect(() => {
    if (showPreview && previewRef.current) {
      gsap.fromTo(previewRef.current,
        { x: 300, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: "expo.out" }
      );
    }
  }, [showPreview]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchDocuments = async () => {
    const res = await axios.get(`${API}/documents`);
    setDocuments(res.data);
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API}/chat/sessions`, { withCredentials: true });
      setChatSessions(res.data);
    } catch { /* ignore if not logged in */ }
  };

  const createSession = async (docFilename) => {
    const res = await axios.post(
      `${API}/chat/sessions`,
      { title: "New Chat", document_filename: docFilename },
      { withCredentials: true }
    );
    setCurrentSessionId(res.data.id);
    fetchSessions();
    return res.data.id;
  };

  const saveMessage = async (sessionId, role, content) => {
    await axios.post(
      `${API}/chat/sessions/${sessionId}/messages`,
      { role, content },
      { withCredentials: true }
    );
  };

  const loadSession = async (session) => {
    try {
      const res = await axios.get(
        `${API}/chat/sessions/${session.id}/messages`,
        { withCredentials: true }
      );
      setMessages(res.data.messages);
      setCurrentSessionId(session.id);
      setSidebarTab("documents");
    } catch (err) {
      console.error("Failed to load session", err);
    }
  };

  const deleteSession = async (sessionId) => {
    await axios.delete(`${API}/chat/sessions/${sessionId}`, { withCredentials: true });
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
    fetchSessions();
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSidebarTab("documents");
  };

  const handleSelectDoc = async (doc) => {
    setSelectedDoc(doc.id);
    setSelectedDocName(doc.filename);
    setLoading(true);

    // Revoke previous blob URL if any
    if (docPreview && previewType === "pdf") {
      URL.revokeObjectURL(docPreview);
    }

    const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
    try {
      if (isPdf) {
        const res = await axios.get(`${API}/documents/${doc.id}/preview`, {
          responseType: "blob",
        });
        const blobUrl = URL.createObjectURL(res.data);
        setDocPreview(blobUrl);
        setPreviewType("pdf");
      } else {
        const res = await axios.get(`${API}/documents/${doc.id}/preview`, {
          responseType: "text",
        });
        setDocPreview(res.data);
        setPreviewType("text");
      }
      setShowPreview(true);
    } catch (err) {
      console.error("Preview failed", err);
      setDocPreview(null);
      setPreviewType(null);
    }

    // Start a new chat session for this document
    if (!currentSessionId) {
      await createSession(doc.filename);
    }
    setLoading(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    await axios.post(`${API}/upload`, formData);
    setLoading(false);
    fetchDocuments();
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedDoc || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Ensure we have a session
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession(selectedDocName || "Unknown");
    }

    try {
      // Save user message
      await saveMessage(sessionId, "user", input);

      const res = await axios.post(`${API}/ask`, {
        question: input,
        document_id: selectedDoc,
      });
      const answer = res.data.answer;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);

      // Save assistant message
      await saveMessage(sessionId, "assistant", answer);
      fetchSessions();
    } catch (err) {
      const errMsg = "Error: Could not connect to the bot.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errMsg },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#020203] text-zinc-300 font-sans overflow-hidden antialiased">

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        className="w-72 border-r border-white/5 bg-zinc-950/30 backdrop-blur-3xl flex flex-col z-50"
      >
        {/* Logo */}
        <div className="p-6 pb-4 flex items-center gap-4">
          <div className="p-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl text-indigo-400">
            <Bot size={18} />
          </div>
          <span className="font-bold tracking-tight text-white text-lg">RAG Bot</span>
        </div>

        {/* Action buttons row */}
        <div className="px-5 mb-4 flex gap-2">
          <label className="group flex items-center justify-center gap-2 flex-1 py-2.5 bg-white text-black rounded-xl cursor-pointer hover:bg-zinc-200 transition-all text-xs font-bold shadow-lg">
            <Plus size={14} />
            <span>Upload</span>
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
          <button
            onClick={startNewChat}
            className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-zinc-900 border border-white/10 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-all text-xs font-bold"
          >
            <MessageSquare size={14} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Sidebar tabs */}
        <div className="px-5 mb-3 flex gap-1 bg-zinc-900/50 mx-5 rounded-lg p-1">
          <button
            onClick={() => setSidebarTab("documents")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
              sidebarTab === "documents"
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setSidebarTab("history")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
              sidebarTab === "history"
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            History
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {sidebarTab === "documents" ? (
            <>
              <p className="px-3 mb-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Documents
              </p>
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all border ${selectedDoc === doc.id
                    ? "bg-white/5 border-white/10 text-white shadow-lg"
                    : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                >
                  <FileText
                    size={16}
                    className={selectedDoc === doc.id ? "text-indigo-400" : "opacity-30"}
                  />
                  <span className="truncate flex-1 text-left font-medium text-sm">
                    {doc.filename}
                  </span>
                </button>
              ))}
              {documents.length === 0 && (
                <p className="px-3 text-xs text-zinc-600 italic">No documents uploaded yet</p>
              )}
            </>
          ) : (
            <>
              <p className="px-3 mb-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Chat History
              </p>
              {chatSessions.map((s) => (
                <div
                  key={s.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border group cursor-pointer ${
                    currentSessionId === s.id
                      ? "bg-white/5 border-white/10 text-white shadow-lg"
                      : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  }`}
                  onClick={() => loadSession(s)}
                >
                  <Clock size={14} className="opacity-30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    {s.document_filename && (
                      <p className="text-[10px] text-zinc-600 truncate">{s.document_filename}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {chatSessions.length === 0 && (
                <p className="px-3 text-xs text-zinc-600 italic">No conversations yet</p>
              )}
            </>
          )}
        </div>

        {/* User profile area */}
        <div className="p-4 border-t border-white/5 relative" ref={userMenuRef}>
          {showUserMenu && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs font-bold text-white">{username || "User"}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Logged in</p>
              </div>
              <button
                onClick={() => { setSidebarTab("history"); setShowUserMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Clock size={14} />
                <span>Chat History</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          )}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <UserCircle size={18} className="text-indigo-400" />
            </div>
            <span className="flex-1 text-left text-sm font-medium text-zinc-300 truncate">
              {username || "User"}
            </span>
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
          </button>
        </div>
      </aside>

      {/* ── Main Viewport ── */}
      <main className="flex-1 flex flex-row relative bg-[#020203]">
        <div className="flex-1 flex flex-col transition-all duration-500">

          {/* Navbar */}
          <nav className="h-16 border-b border-white/5 flex items-center px-10 justify-between bg-black/20 backdrop-blur-xl z-20">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Chat Interface
            </span>
            <div className="flex items-center gap-4">
              {selectedDoc && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${showPreview
                    ? "bg-indigo-500 border-indigo-400 text-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                >
                  <Eye size={14} />
                  {showPreview ? "Close Preview" : "Preview Document"}
                </button>
              )}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-400">
                <Sparkles size={14} className="text-indigo-400" />
                <span>AI Online</span>
              </div>
            </div>
          </nav>

          {/* Chat area */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto pt-10 pb-44 px-8 custom-scrollbar"
          >
            <div className="max-w-3xl mx-auto space-y-8">

              {/* Empty state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-30">
                  <Bot size={48} className="mb-4 text-indigo-500" />
                  <h2 className="text-xl font-medium text-white">RAG Bot is ready</h2>
                  <p className="text-sm mt-2">Upload and select a file to start chatting</p>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-6 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${msg.role === "user"
                      ? "bg-white text-black border-white"
                      : "bg-zinc-900 border-white/10 text-white"
                      }`}
                  >
                    {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`flex flex-col gap-2 max-w-[85%] relative ${msg.role === "user" ? "items-end" : ""
                      }`}
                  >
                    <div
                      className={`rounded-2xl px-6 py-4 border relative ${msg.role === "user"
                        ? "bg-zinc-100 text-black border-white"
                        : "bg-zinc-900/40 text-zinc-200 border-white/5 backdrop-blur-md"
                        }`}
                    >
                      {/* Assistant header */}
                      {msg.role === "assistant" && (
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight">
                            RAG Bot Response
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.content, i)}
                            className="text-zinc-500 hover:text-white transition-colors p-1"
                          >
                            {copiedIndex === i ? (
                              <Check size={14} className="text-green-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      )}

                      {/* ── Markdown renderer ── */}
                      {msg.role === "assistant" ? (
                        <div className="rag-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-[15px] leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    <span className="text-[10px] font-bold text-zinc-700 px-2">
                      {msg.role === "user" ? "User" : "RAG Bot"}
                    </span>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-6 items-center">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 animate-pulse uppercase tracking-widest">
                    Thinking...
                  </span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* ── Input Box ── */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8 z-40">
            <div className="relative bg-zinc-900/80 border border-white/10 backdrop-blur-[40px] rounded-[2.5rem] p-2 pr-4 shadow-2xl transition-all duration-500">
              <div className="flex items-center gap-4">
                <div className="pl-6 text-zinc-600">
                  <Zap size={18} className={input.trim() ? "text-indigo-400" : ""} />
                </div>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    (e.preventDefault(), sendMessage())
                  }
                  placeholder={
                    selectedDoc ? "Ask a question..." : "Select a document first..."
                  }
                  disabled={!selectedDoc}
                  className="flex-1 bg-transparent border-none text-zinc-100 focus:ring-0 focus:outline-none outline-none resize-none py-5 text-[15px] placeholder-zinc-700 font-medium"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !selectedDoc || loading}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${input.trim() && selectedDoc
                    ? "bg-white text-black shadow-xl hover:bg-zinc-200"
                    : "bg-zinc-800/50 text-zinc-700 cursor-not-allowed"
                    }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Document Preview Panel ── */}
        {showPreview && (
          <div
            ref={previewRef}
            className="w-[450px] border-l border-white/10 bg-zinc-950/50 backdrop-blur-2xl flex flex-col z-30"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-white">
                  Document Source
                </span>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4 custom-scrollbar">
              {previewType === "pdf" && docPreview ? (
                <iframe
                  src={docPreview}
                  title="PDF Preview"
                  style={{ width: "100%", height: "100%", border: "none", borderRadius: "12px", background: "#fff" }}
                />
              ) : (
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 min-h-full overflow-y-auto custom-scrollbar" style={{ maxHeight: "100%" }}>
                  <pre className="whitespace-pre-wrap text-[13px] text-zinc-400 font-mono leading-relaxed">
                    {docPreview || "Loading document data..."}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Global Styles ── */}
      <style jsx global>{`
        /* Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }

        /* ── ChatGPT-style Markdown ── */
        .rag-markdown { font-size: 15px; line-height: 1.75; color: #d4d4d8; }

        .rag-markdown h1 { font-size: 1.5rem; font-weight: 700; color: #fff; margin: 1.25rem 0 0.6rem; }
        .rag-markdown h2 { font-size: 1.25rem; font-weight: 700; color: #fff; margin: 1.1rem 0 0.5rem; }
        .rag-markdown h3 { font-size: 1.05rem; font-weight: 600; color: #e4e4e7; margin: 1rem 0 0.4rem; }

        .rag-markdown p { margin-bottom: 0.85rem; }

        .rag-markdown strong { color: #fff; font-weight: 600; }
        .rag-markdown em { color: #a1a1aa; font-style: italic; }

        .rag-markdown ul { list-style: disc; padding-left: 1.5rem; margin: 0.6rem 0 0.85rem; }
        .rag-markdown ol { list-style: decimal; padding-left: 1.5rem; margin: 0.6rem 0 0.85rem; }
        .rag-markdown li { margin-bottom: 0.35rem; color: #d4d4d8; }
        .rag-markdown li::marker { color: #6366f1; }

        .rag-markdown code {
          background: rgba(99,102,241,0.12);
          color: #a5b4fc;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 13px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .rag-markdown pre {
          background: #0f0f14;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .rag-markdown pre code {
          background: transparent;
          color: #a5b4fc;
          padding: 0;
          font-size: 13px;
        }

        .rag-markdown blockquote {
          border-left: 3px solid #6366f1;
          background: rgba(99,102,241,0.06);
          padding: 0.6rem 1rem;
          border-radius: 0 8px 8px 0;
          margin: 0.75rem 0;
          color: #a1a1aa;
          font-style: italic;
        }

        .rag-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 13px;
        }
        .rag-markdown th {
          background: #18181b;
          color: #fff;
          font-weight: 600;
          padding: 9px 14px;
          text-align: left;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .rag-markdown td {
          padding: 8px 14px;
          border: 1px solid rgba(255,255,255,0.06);
          color: #d4d4d8;
        }
        .rag-markdown tr:nth-child(even) td { background: rgba(255,255,255,0.02); }

        .rag-markdown hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 1.5rem 0;
        }

        .rag-markdown a {
          color: #818cf8;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .rag-markdown a:hover { color: #a5b4fc; }
      `}</style>
    </div>
  );
}