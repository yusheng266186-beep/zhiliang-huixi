import { CLASS_PROFILES, relevantSubjects } from "./class-config";
import type { GradeDataset, ItemResponse, QuestionMeta, StudentScore, SubjectName, Threshold } from "./types";

const exams = ["入口", "2册", "3册", "4册"];
const subjectBase: Partial<Record<SubjectName, number>> = {
  语文: 98, 数学: 82, 英语: 86, 日语: 91, 物理: 49, 历史: 55, 化学: 68, 生物: 70, 政治: 72, 地理: 73,
};

const pseudo = (classNo: number, student: number, exam: number, subject = 0) =>
  ((classNo * 37 + student * 19 + exam * 29 + subject * 17) % 21) - 10;

export function createDemoDataset(): GradeDataset {
  const scores: StudentScore[] = [];
  const thresholds: Threshold[] = [];
  exams.forEach((exam, examIndex) => {
    (["物理类", "历史类"] as const).forEach((track) => {
      const subjects: SubjectName[] = track === "物理类"
        ? ["语文", "数学", "英语", "物理", "化学", "生物"]
        : ["语文", "数学", "英语", "历史", "政治", "地理"];
      const topSubjects = Object.fromEntries(subjects.map((subject) => [subject, (subjectBase[subject] ?? 60) + 8])) as Partial<Record<SubjectName, number>>;
      const undergraduateSubjects = Object.fromEntries(subjects.map((subject) => [subject, (subjectBase[subject] ?? 60) - 2])) as Partial<Record<SubjectName, number>>;
      topSubjects.日语 = topSubjects.英语;
      undergraduateSubjects.日语 = undergraduateSubjects.英语;
      if (track === "物理类") {
        topSubjects.地理 = topSubjects.生物;
        undergraduateSubjects.地理 = undergraduateSubjects.生物;
      }
      thresholds.push({
        exam,
        track,
        topTotal: track === "物理类" ? 490 + examIndex * 2 : 500 + examIndex,
        undergraduateTotal: track === "物理类" ? 414 + examIndex * 2 : 416 + examIndex,
        topSubjects,
        undergraduateSubjects,
      });
    });

    Object.values(CLASS_PROFILES).forEach((profile) => {
      for (let student = 1; student <= 28; student += 1) {
        const boost = profile.type === "华英班" ? 70 : profile.type === "直播班" ? 36 : profile.type === "美术班" ? -45 : profile.type === "体育班" ? -25 : 0;
        const subjects: StudentScore["subjects"] = {};
        relevantSubjects(profile).forEach((subject, subjectIndex) => {
          subjects[subject] = Math.max(20, (subjectBase[subject] ?? 60) + boost / 8 + examIndex * 2 + pseudo(profile.classNo, student, examIndex, subjectIndex));
        });
        const total = Object.values(subjects).reduce((sum, value) => sum + (value ?? 0), 0) + pseudo(profile.classNo, student, examIndex) * 1.4;
        scores.push({
          exam,
          rawExam: `${exam}${profile.track === "物理类" ? "物" : "历"}`,
          school: "示例学校",
          classNo: profile.classNo,
          name: `学生${profile.classNo}-${String(student).padStart(2, "0")}`,
          track: profile.track,
          classType: profile.type,
          combination: profile.combination,
          total: Number(total.toFixed(1)),
          cityRank: Math.max(1, Math.round(6500 - total * 8 + student * 3)),
          schoolRank: (profile.classNo - 1) * 28 + student,
          subjects,
        });
      }
    });
  });

  const questions: QuestionMeta[] = Array.from({ length: 12 }, (_, index) => ({
    question: `${index + 1}题`,
    maxScore: index < 8 ? 3 : 6,
    knowledge: ["信息提取", "逻辑推理", "概念辨析", "综合应用"][index % 4],
  }));
  const questionBanks: Record<string, QuestionMeta[]> = {};
  const itemResponses: ItemResponse[] = [];
  ["语文", "数学", "英语", "日语", "物理", "历史", "化学", "生物", "政治", "地理"].forEach((subject) => {
    questionBanks[`${subject}::4册`] = questions;
    scores.filter((score) => score.exam === "4册" && score.subjects[subject as SubjectName] !== undefined).forEach((score, studentIndex) => {
      itemResponses.push({
        subject: subject as SubjectName,
        exam: "4册",
        classNo: score.classNo,
        name: score.name,
        scores: questions.map((question, questionIndex) => Math.max(0, (question.maxScore ?? 3) - Math.abs(pseudo(score.classNo, studentIndex, 3, questionIndex)) % 3)),
      });
    });
  });

  return {
    id: "demo",
    sourceName: "示例数据（请导入真实工作簿）",
    importedAt: "2026-01-01T00:00:00.000Z",
    school: "示例学校",
    exams,
    scores,
    thresholds,
    questionBanks,
    itemResponses,
    issues: [{ level: "info", message: "当前显示匿名示例数据，导入工作簿后将自动替换。" }],
    sheets: ["学生基础", "教师名单", "语文", "数学", "英语", "物理", "历史"],
  };
}
