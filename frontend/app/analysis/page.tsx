"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalysisResult, RoadmapPhase, SkillGap, WritingImprovement } from "@/lib/types";
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import Link from "next/link";

function ScoreCard({ score, label, color }: { score: number; label: string; color: string }) {
  const barWidth = `${score}%`;
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <span className="text-5xl font-bold" style={{ color }}>{score}</span>
      <span className="text-sm text-gray-400 font-medium">{label}</span>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: barWidth, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-600">out of 100</span>
    </div>
  );
}

function importanceColor(imp: string) {
  if (imp === "critical") return "text-red-400 bg-red-900/20 border-red-800";
  if (imp === "important") return "text-yellow-400 bg-yellow-900/20 border-yellow-800";
  return "text-blue-400 bg-blue-900/20 border-blue-800";
}

function AnalysisContent() {
  const router = useRouter();
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [openPhase, setOpenPhase] = useState<number | null>(0);

  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResult");
    if (!raw) { router.push("/dashboard"); return; }
    try {
      setData(JSON.parse(raw));
    } catch {
      router.push("/dashboard");
    }
  }, [router]);

  if (!data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400">Loading results...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold text-indigo-400">AI Resume Analyser</span>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Header */}
        <div>
          <div className="inline-block px-3 py-1 text-xs bg-indigo-900/40 text-indigo-300 rounded-full border border-indigo-800 mb-3">
            {data.target_role}
          </div>
          <h1 className="text-3xl font-bold mb-2">Your Analysis Results</h1>
          <p className="text-gray-400">{data.summary}</p>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center">
            <ScoreCard score={data.ats_score} label="ATS Score" color="#6366f1" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center">
            <ScoreCard score={data.strength_score} label="Strength Score" color="#10b981" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center">
            <ScoreCard score={data.match_percentage} label="Role Match" color="#f59e0b" />
          </div>
        </div>

        {/* Skills */}
        {(() => {
          const roleNotRecognised = data.extracted_skills.length > 0 && data.matched_skills.length === 0 && data.missing_skills.length === 0;
          if (roleNotRecognised) {
            return (
              <div className="bg-gray-900 border border-yellow-800/50 rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-3 bg-yellow-900/20 border border-yellow-800 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-300 font-medium">Role not recognised for skill matching</p>
                    <p className="text-yellow-400/70 text-sm mt-0.5">
                      Try one of: <span className="font-medium">Software Engineer, AI Engineer, Data Analyst, Web Developer, Cybersecurity Analyst</span>
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-3">Skills found in your resume:</p>
                  <div className="flex flex-wrap gap-2">
                    {data.extracted_skills.map((s) => (
                      <span key={s} className="px-3 py-1 bg-indigo-900/20 border border-indigo-800 text-indigo-300 text-sm rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" /> Matched Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.matched_skills.length > 0 ? data.matched_skills.map((s) => (
                    <span key={s} className="px-3 py-1 bg-green-900/20 border border-green-800 text-green-300 text-sm rounded-full">{s}</span>
                  )) : (
                    <span className="text-sm text-gray-500">No skills matched the role requirements</span>
                  )}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {data.missing_skills.length === 0
                    ? <CheckCircle className="w-5 h-5 text-green-400" />
                    : <XCircle className="w-5 h-5 text-red-400" />
                  } Missing Skills
                </h2>
                {data.missing_skills.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">You have all the required skills — great job!</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.missing_skills.map((s) => (
                      <span key={s} className="px-3 py-1 bg-red-900/20 border border-red-800 text-red-300 text-sm rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Strengths</h2>
            <ul className="space-y-2">
              {data.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Weaknesses</h2>
            <ul className="space-y-2">
              {data.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />{w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ATS Feedback */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">ATS Improvement Tips</h2>
          <ul className="space-y-3">
            {data.ats_feedback.map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300 bg-gray-800/50 rounded-xl p-3">
                <span className="text-indigo-400 font-bold shrink-0">{i + 1}.</span>{tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Skill Gaps */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Skill Gap Details</h2>
          {data.missing_skills.length === 0 || data.skill_gaps.length === 0 ? (
            <div className="flex items-center gap-3 bg-green-900/20 border border-green-800 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-green-300 font-medium">No skill gaps detected!</p>
                <p className="text-green-400/70 text-sm mt-0.5">Your resume already covers the key requirements for this role.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.skill_gaps.map((gap: SkillGap, i) => (
                <div key={i} className={`border rounded-xl p-4 ${importanceColor(gap.importance)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{gap.skill}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${importanceColor(gap.importance)}`}>
                      {gap.importance}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {gap.resources.map((r, j) => (
                      <span key={j} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roadmap */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Your Personalised Learning Roadmap</h2>
          <div className="space-y-3">
            {data.roadmap.map((phase: RoadmapPhase) => (
              <div key={phase.phase} className="border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenPhase(openPhase === phase.phase ? null : phase.phase)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-sm font-bold flex items-center justify-center shrink-0">
                      {phase.phase}
                    </span>
                    <div>
                      <p className="font-medium">{phase.title}</p>
                      <p className="text-xs text-gray-500">{phase.duration_weeks} weeks</p>
                    </div>
                  </div>
                  {openPhase === phase.phase ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {openPhase === phase.phase && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700 pt-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Goals</p>
                      <ul className="space-y-1">{phase.goals.map((g, i) => <li key={i} className="text-sm text-gray-300">• {g}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Skills to Learn</p>
                      <div className="flex flex-wrap gap-1">{phase.skills_to_learn.map((s, i) => <span key={i} className="text-xs bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded border border-indigo-800">{s}</span>)}</div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Courses</p>
                      <ul className="space-y-1">{phase.courses.map((c, i) => <li key={i} className="text-sm text-gray-300">• {c}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Projects</p>
                      <ul className="space-y-1">{phase.projects.map((p, i) => <li key={i} className="text-sm text-gray-300">• {p}</li>)}</ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Writing Improvements */}
        {data.writing_improvements && data.writing_improvements.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-1">Resume Writing Improvements</h2>
            <p className="text-sm text-gray-500 mb-5">AI-suggested rewrites for weak sentences found in your resume</p>
            <div className="space-y-5">
              {data.writing_improvements.map((item: WritingImprovement, i: number) => (
                <div key={i} className="rounded-xl border border-gray-700 overflow-hidden">
                  {/* Original */}
                  <div className="bg-red-950/30 border-b border-gray-700 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Original</span>
                    </div>
                    <p className="text-sm text-red-200/80 italic">&ldquo;{item.original}&rdquo;</p>
                  </div>
                  {/* Improved */}
                  <div className="bg-green-950/20 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Suggested Rewrite</span>
                    </div>
                    <p className="text-sm text-green-200/90">&ldquo;{item.improved}&rdquo;</p>
                  </div>
                  {/* Reason */}
                  <div className="bg-gray-800/40 px-4 py-2">
                    <p className="text-xs text-gray-400"><span className="text-indigo-400 font-medium">Why: </span>{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interview Questions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Interview Questions to Practise</h2>
          <ol className="space-y-3">
            {data.interview_questions.map((q, i) => (
              <li key={i} className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-4">
                <span className="text-indigo-400 font-bold text-sm shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-sm text-gray-200">{q}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return <AnalysisContent />;
}
