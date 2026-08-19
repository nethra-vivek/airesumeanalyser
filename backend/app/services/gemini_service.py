from groq import Groq, RateLimitError
import json
import difflib
from fastapi import HTTPException
from app.config import settings
from app.utils.job_roles import JOB_ROLE_REQUIREMENTS

client = Groq(api_key=settings.groq_api_key)
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an expert career counselor and technical recruiter.
Always respond with valid JSON matching the exact schema requested.
Never include markdown fences, code blocks, or any extra text outside the JSON.
Return ONLY the raw JSON object."""


def _clean_json(text: str) -> str:
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return text.strip()


def _chat(prompt: str) -> str:
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=4096,
        )
        return response.choices[0].message.content
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Daily AI quota reached. Groq free tier allows 100,000 tokens/day. Please try again in a few hours."
        )


ROLE_ALIASES = {
    "Software Engineer": [
        "software engineer", "software developer", "backend developer", "backend engineer",
        "backend dev", "software dev", "swe", "full stack developer", "fullstack developer",
        "full-stack developer", "full stack engineer", "java developer", "python developer",
    ],
    "AI Engineer": [
        "ai engineer", "ml engineer", "machine learning engineer", "ai/ml engineer",
        "deep learning engineer", "nlp engineer", "data scientist", "artificial intelligence engineer",
        "ai developer", "ml developer", "research engineer",
    ],
    "Data Analyst": [
        "data analyst", "business analyst", "data analytics", "analytics engineer",
        "bi analyst", "business intelligence analyst", "reporting analyst",
    ],
    "Web Developer": [
        "web developer", "frontend developer", "front end developer", "front-end developer",
        "frontend engineer", "front end engineer", "react developer", "ui developer",
        "ui engineer", "nextjs developer", "javascript developer", "web dev",
    ],
    "Cybersecurity Analyst": [
        "cybersecurity analyst", "security analyst", "information security analyst",
        "cyber security analyst", "soc analyst", "security engineer", "infosec analyst",
        "penetration tester", "ethical hacker",
    ],
}


def _find_role_key(target_role: str) -> str:
    """Map any user-typed role to the closest JOB_ROLE_REQUIREMENTS key."""
    role_lower = target_role.lower().strip()

    # Build a flat lookup: normalised alias → role key
    all_candidates: dict[str, str] = {}
    for key in JOB_ROLE_REQUIREMENTS:
        all_candidates[key.lower()] = key
    for key, aliases in ROLE_ALIASES.items():
        for alias in aliases:
            all_candidates[alias.lower()] = key

    # 1. Exact match
    if role_lower in all_candidates:
        return all_candidates[role_lower]

    # 2. Fuzzy match against all known aliases (handles typos like "fronend")
    close = difflib.get_close_matches(role_lower, all_candidates.keys(), n=1, cutoff=0.6)
    if close:
        return all_candidates[close[0]]

    # 3. Substring / keyword fallback
    keyword_map = [
        (["frontend", "front end", "front-end", "web dev", "react dev", "ui dev", "javascript dev"], "Web Developer"),
        (["machine learning", "ml eng", "ai eng", "deep learning", "nlp", "data scien"], "AI Engineer"),
        (["data analyst", "business analyst", "bi analyst", "analytics"], "Data Analyst"),
        (["cyber", "security", "infosec", "pentest", "soc"], "Cybersecurity Analyst"),
        (["software", "backend", "fullstack", "full stack", "java dev", "python dev", "swe"], "Software Engineer"),
    ]
    for keywords, key in keyword_map:
        if any(kw in role_lower for kw in keywords):
            return key

    return ""  # Unrecognised role


def _normalize(s: str) -> str:
    """Normalize skill string for fuzzy comparison."""
    return s.lower().replace(".", "").replace("-", "").replace(" ", "").replace("_", "")


def _skill_in_resume(skill: str, extracted_normalized: list[str]) -> bool:
    """Check if a required skill appears in the extracted resume skills."""
    skill_norm = _normalize(skill)
    for e in extracted_normalized:
        # exact match or one contains the other (handles React vs React.js, Node vs Node.js)
        if skill_norm == e or skill_norm in e or e in skill_norm:
            return True
    return False


def _match_skills(extracted_skills: list[str], target_role: str):
    """
    Pure Python skill matching against role requirements.
    Returns (matched_skills, missing_skills, match_percentage, skill_gaps)
    """
    role_key = _find_role_key(target_role)
    role_req = JOB_ROLE_REQUIREMENTS.get(role_key, {})
    core = role_req.get("core_skills", [])
    important = role_req.get("important_skills", [])
    nice = role_req.get("nice_to_have", [])

    extracted_norm = [_normalize(s) for s in extracted_skills]

    matched = []
    missing = []

    # Check core + important skills (these affect match_percentage)
    for skill in core + important:
        if _skill_in_resume(skill, extracted_norm):
            matched.append(skill)
        else:
            missing.append(skill)

    total = len(core) + len(important)
    match_pct = round(len(matched) / total * 100) if total > 0 else 0

    # Build skill_gaps only from missing skills
    skill_gaps = []
    for skill in missing:
        importance = "critical" if skill in core else "important"
        skill_gaps.append({
            "skill": skill,
            "importance": importance,
            "resources": _get_resources(skill),
        })

    return matched, missing, match_pct, skill_gaps


def _get_resources(skill: str) -> list[str]:
    """Return learning resources for a skill."""
    resource_map = {
        "Python": ["Python for Everybody – Coursera", "Automate the Boring Stuff – automatetheboringstuff.com"],
        "Machine Learning": ["Machine Learning Specialization – Coursera (Andrew Ng)", "fast.ai – Practical Deep Learning"],
        "Deep Learning": ["Deep Learning Specialization – Coursera", "fast.ai – Practical Deep Learning"],
        "PyTorch": ["PyTorch Official Tutorials – pytorch.org", "Deep Learning with PyTorch – Udemy"],
        "TensorFlow": ["TensorFlow Developer Certificate – Coursera", "TensorFlow Official Tutorials"],
        "NLP": ["NLP Specialization – Coursera (DeepLearning.AI)", "Hugging Face NLP Course – huggingface.co"],
        "LLMs": ["LLM Bootcamp – Full Stack Deep Learning", "Hugging Face LLM Course"],
        "Docker": ["Docker Mastery – Udemy (Bret Fisher)", "Docker Official Getting Started Guide"],
        "Kubernetes": ["Kubernetes for Beginners – KodeKloud", "CKA Certification Course – Udemy"],
        "SQL": ["SQL for Data Science – Coursera", "Mode SQL Tutorial – mode.com/sql-tutorial"],
        "React": ["React Official Docs – react.dev", "Full Stack Open – fullstackopen.com"],
        "JavaScript": ["The Odin Project – theodinproject.com", "JavaScript.info – javascript.info"],
        "TypeScript": ["TypeScript Handbook – typescriptlang.org", "TypeScript Course – Scrimba"],
        "HTML": ["The Odin Project – theodinproject.com", "MDN Web Docs – developer.mozilla.org"],
        "CSS": ["CSS Tricks – css-tricks.com", "Kevin Powell CSS – YouTube"],
        "Node.js": ["Full Stack Open – fullstackopen.com", "The Odin Project – theodinproject.com"],
        "AWS": ["AWS Cloud Practitioner – AWS Training", "Ultimate AWS Certified Developer – Udemy"],
        "Git": ["Pro Git Book – git-scm.com", "GitHub Learning Lab – skills.github.com"],
        "Data Structures": ["DSA Course – freeCodeCamp YouTube", "LeetCode – leetcode.com"],
        "Algorithms": ["Algorithms Specialization – Coursera (Stanford)", "LeetCode – leetcode.com"],
        "System Design": ["System Design Primer – GitHub", "Grokking System Design – educative.io"],
        "REST APIs": ["REST API Tutorial – restfulapi.net", "Postman Learning Center – learning.postman.com"],
        "Tableau": ["Tableau Desktop Specialist – Tableau Public", "Tableau for Beginners – Udemy"],
        "Power BI": ["Microsoft Power BI – Microsoft Learn", "Power BI Desktop – Udemy"],
        "pandas": ["pandas Documentation – pandas.pydata.org", "Data Analysis with pandas – Kaggle Learn"],
        "Statistics": ["Statistics for Data Science – Coursera", "Khan Academy Statistics"],
    }
    default = [
        f"Search '{skill} tutorial' on YouTube",
        f"'{skill}' course on Coursera or Udemy",
    ]
    return resource_map.get(skill, default)


async def analyze_resume(resume_text: str, target_role: str) -> dict:
    """
    Hybrid approach:
    - Step 1 (AI): extract skills, ATS score, strength score, feedback
    - Step 2 (Python): deterministic skill matching and match_percentage
    - Step 3 (AI): generate summary AFTER knowing actual match_percentage
    """
    # Step 1 — AI extracts skills and scores (no summary yet)
    prompt = f"""Analyze this resume for the role of "{target_role}".

RESUME TEXT:
{resume_text}

Return ONLY a valid JSON object with this exact structure:
{{
  "extracted_skills": ["every technical skill, tool, language, framework, library, platform mentioned in the resume"],
  "ats_score": <integer 0-100, based on: keyword density, clear section headers, action verbs, quantified achievements>,
  "strength_score": <integer 0-100, based on: measurable impact, strong action verbs, relevant projects, leadership signals>,
  "ats_feedback": ["specific actionable tip 1", "tip 2", "tip 3", "tip 4"],
  "strengths": ["specific strength from this resume 1", "strength 2", "strength 3"],
  "weaknesses": ["specific weakness or gap 1", "weakness 2", "weakness 3"]
}}

Be thorough with extracted_skills — include everything mentioned anywhere in the resume."""

    ai_data = json.loads(_clean_json(_chat(prompt)))

    # Step 2 — Python does deterministic skill matching
    extracted = ai_data.get("extracted_skills", [])
    matched, missing, match_pct, skill_gaps = _match_skills(extracted, target_role)

    # Step 3 — Generate summary NOW that we know the actual match_percentage
    role_key = _find_role_key(target_role)
    match_label = (
        "strong match" if match_pct >= 75 else
        "good match" if match_pct >= 50 else
        "developing match" if match_pct >= 25 else
        "significant skill gap"
    )
    summary_prompt = f"""Write a 2-3 sentence honest summary of this candidate for the "{target_role}" role.

Key facts you MUST reflect accurately:
- Role match: {match_pct}% ({match_label}) — {"they match " + str(len(matched)) + " of the required skills" if role_key else "role not in our database"}
- Matched skills: {", ".join(matched[:6]) if matched else "none matched"}
- Missing skills: {", ".join(missing[:6]) if missing else "none" if role_key else "could not be determined"}
- ATS score: {ai_data.get("ats_score", 0)}/100
- Strength score: {ai_data.get("strength_score", 0)}/100

The summary MUST be consistent with these numbers. If match is below 50%, do NOT call them a "strong candidate". Be honest but constructive.
Return ONLY the summary text, no JSON, no quotes."""

    summary = _chat(summary_prompt).strip().strip('"')

    return {
        "ats_score": ai_data.get("ats_score", 60),
        "strength_score": ai_data.get("strength_score", 50),
        "match_percentage": match_pct,
        "extracted_skills": extracted,
        "matched_skills": matched,
        "missing_skills": missing,
        "skill_gaps": skill_gaps,
        "ats_feedback": ai_data.get("ats_feedback", []),
        "strengths": ai_data.get("strengths", []),
        "weaknesses": ai_data.get("weaknesses", []),
        "summary": summary,
    }


async def generate_roadmap(resume_text: str, target_role: str, missing_skills: list[str]) -> list[dict]:
    if not missing_skills:
        # No gaps — generate a polish/advancement roadmap
        prompt = f"""Create an advancement roadmap for a strong "{target_role}" candidate who already has the core skills.
Focus on: advanced specialization, leadership, system design, and staying current.

Return a JSON array of 3 roadmap phases:
[
  {{
    "phase": 1,
    "title": "<phase title>",
    "duration_weeks": <integer>,
    "goals": ["<goal 1>", "<goal 2>"],
    "skills_to_learn": ["<advanced skill 1>", "<skill 2>"],
    "projects": ["<project idea 1>", "<project idea 2>"],
    "courses": ["<specific course + platform>", "<specific resource>"]
  }}
]"""
    else:
        prompt = f"""Create a personalized learning roadmap for someone targeting "{target_role}".
Skills they need to learn: {', '.join(missing_skills[:12])}

Return a JSON array of 3-4 roadmap phases:
[
  {{
    "phase": 1,
    "title": "<phase title>",
    "duration_weeks": <integer>,
    "goals": ["<goal 1>", "<goal 2>"],
    "skills_to_learn": ["<skill 1>", "<skill 2>"],
    "projects": ["<concrete project idea 1>", "<project idea 2>"],
    "courses": ["<specific course name + platform>", "<specific resource>"]
  }}
]

Total 12-20 weeks. Use real course names (e.g. "CS50 on edX"). Prioritize high-impact skills first."""

    return json.loads(_clean_json(_chat(prompt)))


async def generate_writing_improvements(resume_text: str) -> list[dict]:
    prompt = f"""You are a professional resume writing coach. Read this resume and find 5 weak sentences that could be written better.

RESUME TEXT:
{resume_text[:4000]}

For each weak sentence:
- Copy the EXACT original sentence from the resume (word for word, do not shorten it)
- Rewrite it to be stronger: use powerful action verbs, add quantified impact, be specific
- Give a short reason (max 10 words) explaining the improvement

Focus on bullet points and job description lines. Skip contact info, section titles, and headers.

Return ONLY a valid JSON array with exactly this structure, no markdown, no extra text:
[
  {{
    "original": "exact sentence copied from resume",
    "improved": "rewritten stronger version with action verb and impact",
    "reason": "short reason for improvement"
  }},
  {{
    "original": "another exact sentence from resume",
    "improved": "its stronger rewritten version",
    "reason": "short reason"
  }}
]"""

    raw = _chat(prompt)
    cleaned = _clean_json(raw)
    result = json.loads(cleaned)
    # Ensure it's a list
    if isinstance(result, dict):
        result = [result]
    return result


async def generate_interview_questions(resume_text: str, target_role: str, difficulty: str = "mixed") -> list[str]:
    prompt = f"""Generate 10 interview questions for a "{target_role}" candidate based on their resume.

RESUME:
{resume_text[:3000]}

Mix: technical questions (role-specific), behavioral (STAR format), and resume-specific questions.

Return a JSON array of exactly 10 question strings.
["question 1", "question 2", ...]"""

    return json.loads(_clean_json(_chat(prompt)))
