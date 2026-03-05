import { useEffect, useState, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { gsap } from "gsap";
import {
  Plus, FileText, Send, Sparkles,
  Bot, User, Loader2, Command,
  Zap, Copy, Check, Eye, X
} from "lucide-react";

const API = "http://localhost:8000";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sidebarRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => { fetchDocuments(); }, []);

  useEffect(() => {
    gsap.fromTo(sidebarRef.current, { x: -70, opacity: 0 }, { x: 0, opacity: 1, duration: 1.1, ease: "power3.out" });
  }, []);

  useEffect(() => {
    if (showPreview) {
      gsap.fromTo(previewRef.current, { x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "expo.out" });
    }
  }, [showPreview]);

  const fetchDocuments = async () => {
    const res = await axios.get(`${API}/documents`);
    setDocuments(res.data);
  };

  // --- UPDATED: Fetch real content from backend ---
  const handleSelectDoc = async (doc) => {
    setSelectedDoc(doc.id);
    setLoading(true);
    try {
      const res = await axios.get(`${API}/documents/${doc.id}/preview`, {
        responseType: 'text' // We expect the raw file content
      });
      setDocPreview(res.data);
      setShowPreview(true);
    } catch (err) {
      console.error("Preview failed", err);
      setDocPreview("This file type (e.g. PDF) cannot be previewed as raw text. The RAG Bot can still read it though!");
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
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ask`, { question: input, document_id: selectedDoc });
      setMessages(prev => [...prev, { role: "assistant", content: res.data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Could not connect to the bot." }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#020203] text-zinc-300 font-sans overflow-hidden antialiased">
      {/* --- Sidebar --- */}
      <aside ref={sidebarRef} className="w-72 border-r border-white/5 bg-zinc-950/30 backdrop-blur-3xl flex flex-col z-50">
        <div className="p-6 pb-8 flex items-center gap-4">
          <div className="p-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl text-indigo-400">
            <Bot size={18} />
          </div>
          <span className="font-bold tracking-tight text-white text-lg">RAG Bot</span>
        </div>

        <div className="px-5 mb-8">
          <label className="group flex items-center justify-center gap-3 w-full py-3 bg-white text-black rounded-xl cursor-pointer hover:bg-zinc-200 transition-all text-xs font-bold shadow-lg">
            <Plus size={16} />
            <span>Upload File</span>
            <input type="file" className="hidden" onChange={handleUpload} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <p className="px-3 mb-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Documents</p>
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleSelectDoc(doc)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all border ${selectedDoc === doc.id
                ? "bg-white/5 border-white/10 text-white shadow-lg"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                }`}
            >
              <FileText size={16} className={selectedDoc === doc.id ? "text-indigo-400" : "opacity-30"} />
              <span className="truncate flex-1 text-left font-medium text-sm">{doc.filename}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* --- Main Viewport --- */}
      <main className="flex-1 flex flex-row relative bg-[#020203]">
        <div className={`flex-1 flex flex-col transition-all duration-500`}>
          <nav className="h-16 border-b border-white/5 flex items-center px-10 justify-between bg-black/20 backdrop-blur-xl z-20">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Chat Interface</span>
            <div className="flex items-center gap-4">
              {selectedDoc && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${showPreview ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
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

          <div ref={chatContainerRef} className="flex-1 overflow-y-auto pt-10 pb-40 px-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-30">
                  <Bot size={48} className="mb-4 text-indigo-500" />
                  <h2 className="text-xl font-medium text-white">RAG Bot is ready</h2>
                  <p className="text-sm mt-2">Upload and select a file to start chatting</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-6 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-900 border-white/10 text-white"}`}>
                    {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className={`flex flex-col gap-2 max-w-[85%] relative ${msg.role === "user" ? "items-end" : ""}`}>
                    <div className={`rounded-2xl px-6 py-4 border relative ${msg.role === "user" ? "bg-zinc-100 text-black border-white" : "bg-zinc-900/40 text-zinc-200 border-white/5 backdrop-blur-md"}`}>
                      {msg.role === "assistant" && (
                        <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight">RAG Bot Response</span>
                          <button onClick={() => copyToClipboard(msg.content, i)} className="text-zinc-500 hover:text-white transition-colors p-1">
                            {copiedIndex === i ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                      <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed font-light">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-700 px-2">
                      {msg.role === "user" ? "User" : "RAG Bot"}
                    </span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-6 items-center">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={18} /></div>
                  <span className="text-[10px] font-bold text-indigo-400 animate-pulse uppercase tracking-widest">Thinking...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Box */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8 z-40">
            <div className="relative bg-zinc-900/80 border border-white/10 backdrop-blur-[40px] rounded-[2.5rem] p-2 pr-4 shadow-2xl transition-all duration-500">
              <div className="flex items-center gap-4">
                <div className="pl-6 text-zinc-600"><Zap size={18} className={input.trim() ? "text-indigo-400" : ""} /></div>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Ask a question..."
                  disabled={!selectedDoc}
                  className="flex-1 bg-transparent border-none text-zinc-100 focus:ring-0 focus:outline-none outline-none resize-none py-5 text-[15px] placeholder-zinc-800 font-medium"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !selectedDoc || loading}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${input.trim() ? "bg-white text-black shadow-xl" : "bg-zinc-800/50 text-zinc-700"}`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Document Preview Panel --- */}
        {showPreview && (
          <div ref={previewRef} className="w-[450px] border-l border-white/10 bg-zinc-950/50 backdrop-blur-2xl flex flex-col z-30">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-white">Document Source</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 min-h-full">
                <pre className="whitespace-pre-wrap text-[13px] text-zinc-400 font-mono leading-relaxed">
                  {docPreview || "Loading document data..."}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .prose p { margin-bottom: 0.75rem; }
      `}</style>
    </div>
  );
}