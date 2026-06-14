"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Trash2, LogOut, Loader2, ChevronRight } from "lucide-react";
import { uploadResume, listResumes, deleteResume, runAnalysis } from "@/lib/api";
import { Resume } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [selectedResume, setSelectedResume] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const fetchResumes = useCallback(async () => {
    try {
      const { data } = await listResumes();
      setResumes(data);
    } catch {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchResumes();
  }, [fetchResumes, router]);

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      await uploadResume(file);
      await fetchResumes();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
      if (selectedResume === id) setSelectedResume(null);
    } catch {}
  };

  const handleAnalyse = async () => {
    if (!selectedResume || !targetRole.trim()) return;
    setAnalysing(true);
    setError("");
    try {
      const { data } = await runAnalysis(selectedResume, targetRole.trim());
      sessionStorage.setItem("analysisResult", JSON.stringify(data));
      router.push("/analysis");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Analysis failed. Check your API key.");
    } finally {
      setAnalysing(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-indigo-400">AI Resume Analyser</span>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-gray-400">Upload your resume and select a target role to get started</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer
            ${dragOver ? "border-indigo-500 bg-indigo-950/20" : "border-gray-700 hover:border-gray-600"}`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-gray-400">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-500" />
              <p className="text-lg font-medium">Drop your resume here</p>
              <p className="text-sm text-gray-500">PDF, DOCX or TXT — max 5MB</p>
            </div>
          )}
        </div>

        {/* Resume List */}
        {resumes.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Your Resumes</h2>
            <div className="space-y-2">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  onClick={() => setSelectedResume(resume.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition
                    ${selectedResume === resume.id
                      ? "border-indigo-500 bg-indigo-950/30"
                      : "border-gray-800 bg-gray-900 hover:border-gray-700"}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{resume.filename}</p>
                      <p className="text-xs text-gray-500">{(resume.raw_text_length / 1000).toFixed(1)}k chars</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(resume.id); }}
                    className="p-2 text-gray-600 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role Input + Analyse */}
        {selectedResume && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">What role are you targeting?</h2>
              <p className="text-sm text-gray-500">Pick a role below or type your own</p>
            </div>

            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Or type a custom role — e.g. Machine Learning Engineer"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm"
            />

            <button
              onClick={handleAnalyse}
              disabled={analysing || !targetRole.trim()}
              className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold transition text-lg"
            >
              {analysing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Analysing with Groq AI...</>
              ) : (
                <>Analyse Resume <ChevronRight className="w-5 h-5" /></>
              )}
            </button>
            {analysing && (
              <p className="text-center text-sm text-gray-500">This takes 15–30 seconds — Groq AI is reading your resume carefully</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
