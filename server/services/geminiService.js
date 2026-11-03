import { GoogleGenAI, Type } from '@google/genai';

const getAIClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in server environment variables.');
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

const MODEL_NAME = 'gemini-2.5-flash';

const safeParseJSON = (rawText) => {
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
};

export const generateNextInterviewQuestion = async ({
  jobRole,
  experienceLevel,
  interviewType,
  difficulty,
  preferredLanguage,
  previousQAPairs = [],
  resumeContext = '',
}) => {
  const ai = getAIClient();
  const historyContext =
    previousQAPairs.length > 0
      ? previousQAPairs
          .map(
            (item, idx) =>
              `Q${idx + 1}: ${item.questionText}\nCandidate Answer: ${item.userAnswer}\nScore: ${item.score || 'N/A'}/10`
          )
          .join('\n\n')
      : 'None yet (first question).';

  const prompt = `You are an elite interviewer conducting a ${interviewType} interview for a ${jobRole} (${experienceLevel}).
Preferred Language: ${preferredLanguage}
Base Difficulty: ${difficulty}
${resumeContext ? `Candidate Resume Details:\n${resumeContext.slice(0, 3000)}` : ''}

Session History:
${historyContext}

Directives:
1. Do NOT repeat previous questions.
2. Probe incomplete points or concrete architectural projects with a targeted follow-up (set isFollowUp = true).
3. If progressing to a new topic, adapt difficulty dynamically based on their answers.
4. Provide a subtle hint that coaches their thought structure without giving away the solution.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING },
          topic: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
          hint: { type: Type.STRING },
          isFollowUp: { type: Type.BOOLEAN },
        },
        required: ['questionText', 'topic', 'difficulty', 'hint', 'isFollowUp'],
      },
    },
  });

  return safeParseJSON(response.text);
};

export const evaluateCandidateAnswer = async ({
  jobRole,
  experienceLevel,
  questionText,
  topic,
  userAnswer,
}) => {
  const ai = getAIClient();
  const prompt = `Critically evaluate this interview response.
Job Role: ${jobRole} (${experienceLevel})
Topic: ${topic}
Question: "${questionText}"
Candidate Answer: "${userAnswer}"

Grade each criterion objectively from 1 to 10.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          technicalAccuracy: { type: Type.NUMBER },
          communicationSkills: { type: Type.NUMBER },
          answerRelevance: { type: Type.NUMBER },
          problemSolving: { type: Type.NUMBER },
          confidenceClarity: { type: Type.NUMBER },
          completeness: { type: Type.NUMBER },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvedSampleAnswer: { type: Type.STRING },
          conceptsToStudy: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'score',
          'technicalAccuracy',
          'communicationSkills',
          'answerRelevance',
          'problemSolving',
          'confidenceClarity',
          'completeness',
          'strengths',
          'weaknesses',
          'missingPoints',
          'improvementSuggestions',
          'improvedSampleAnswer',
          'conceptsToStudy',
        ],
      },
    },
  });

  return safeParseJSON(response.text);
};

export const generateSessionReport = async ({ jobRole, experienceLevel, qaList }) => {
  const ai = getAIClient();
  const transcript = qaList
    .map(
      (q, i) =>
        `Q${i + 1} [${q.topic}]: ${q.questionText}\nAnswer: ${q.userAnswer}\nScore: ${q.evaluation?.score || 0}/10`
    )
    .join('\n\n');

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Generate an executive post-interview debrief for a ${jobRole} (${experienceLevel}) candidate:\n\n${transcript}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executiveSummary: { type: Type.STRING },
          topStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          criticalGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          hiringRecommendation: {
            type: Type.STRING,
            enum: ['Strong Hire', 'Hire', 'Borderline - Needs Practice', 'No Hire Yet'],
          },
        },
        required: [
          'executiveSummary',
          'topStrengths',
          'criticalGaps',
          'recommendedTopics',
          'hiringRecommendation',
        ],
      },
    },
  });

  return safeParseJSON(response.text);
};

export const analyzeResumeWithAI = async ({ resumeText, targetJobRole }) => {
  const ai = getAIClient();
  const prompt = `Act as an expert Technical Recruiter & ATS parser. Analyze this resume for the role "${targetJobRole}":\n\n${resumeText.slice(0, 12000)}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          atsCompatibilityScore: { type: Type.NUMBER },
          keywordMatchPercentage: { type: Type.NUMBER },
          extractedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          parsedProjects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['title', 'summary', 'technologies'],
            },
          },
          experienceSummary: { type: Type.STRING },
          formattingFeedback: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ['pass', 'warning'] },
                message: { type: Type.STRING },
              },
              required: ['status', 'message'],
            },
          },
          grammarSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          bulletPointImprovements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                improved: { type: Type.STRING },
                impactExplanation: { type: Type.STRING },
              },
              required: ['original', 'improved', 'impactExplanation'],
            },
          },
          roleRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'overallScore',
          'atsCompatibilityScore',
          'keywordMatchPercentage',
          'extractedSkills',
          'missingKeywords',
          'parsedProjects',
          'experienceSummary',
          'formattingFeedback',
          'grammarSuggestions',
          'bulletPointImprovements',
          'roleRecommendations',
        ],
      },
    },
  });

  return safeParseJSON(response.text);
};

export const generateQuestionBank = async ({
  jobRole,
  experienceLevel,
  category,
  difficulty,
  count,
}) => {
  const ai = getAIClient();
  const prompt = `Generate ${count} high-signal interview questions for a ${jobRole} (${experienceLevel}) in category ${category} with difficulty ${difficulty}.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            topic: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
            interviewerIntent: { type: Type.STRING },
            expectedKeyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            sampleAnswer: { type: Type.STRING },
          },
          required: [
            'question',
            'topic',
            'difficulty',
            'interviewerIntent',
            'expectedKeyPoints',
            'sampleAnswer',
          ],
        },
      },
    },
  });

  return safeParseJSON(response.text);
};

export const generateLearningRecommendations = async ({
  targetJobRole,
  weakestSkills,
  recentMissedConcepts,
}) => {
  const ai = getAIClient();
  const prompt = `Create a targeted study plan for a ${targetJobRole}. Identified weaknesses: ${weakestSkills.join(', ') || 'System Design'}. Missed concepts: ${recentMissedConcepts.join(', ') || 'Tradeoffs'}.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topicsToStudy: { type: Type.ARRAY, items: { type: Type.STRING } },
          technicalConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          communicationTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          practicePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['topicsToStudy', 'technicalConcepts', 'communicationTips', 'practicePrompts'],
      },
    },
  });

  return safeParseJSON(response.text);
};
