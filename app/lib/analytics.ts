import { getClassProfile, relevantSubjects } from "./class-config";
import type { ClassSummary, GradeDataset, StudentScore, SubjectName, SubjectSummary, Threshold, Track } from "./types";

export const average = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const getThreshold = (dataset: GradeDataset, exam: string, track: Track): Threshold | undefined =>
  dataset.thresholds.find((threshold) => threshold.exam === exam && threshold.track === track);

export const filterScores = (
  dataset: GradeDataset,
  exam: string,
  track: Track | "全部",
  classNo: number | "全部" = "全部",
) => dataset.scores.filter((score) =>
  score.exam === exam &&
  (track === "全部" || score.track === track) &&
  (classNo === "全部" || score.classNo === classNo),
);

export const classSummaries = (
  dataset: GradeDataset,
  exam: string,
  track: Track | "全部",
): ClassSummary[] => {
  const rows = filterScores(dataset, exam, track);
  const groups = new Map<number, StudentScore[]>();
  rows.forEach((score) => groups.set(score.classNo, [...(groups.get(score.classNo) ?? []), score]));
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([classNo, students]) => {
    const profile = getClassProfile(classNo);
    const threshold = getThreshold(dataset, exam, profile.track);
    const topCount = typeof threshold?.topTotal === "number" ? students.filter((student) => student.total >= threshold.topTotal).length : 0;
    const undergraduateCount = typeof threshold?.undergraduateTotal === "number"
      ? students.filter((student) => student.total >= threshold.undergraduateTotal).length
      : 0;
    const subjectAverages: ClassSummary["subjectAverages"] = {};
    relevantSubjects(profile).forEach((subject) => {
      const values = students.map((student) => student.subjects[subject]).filter((value): value is number => typeof value === "number");
      if (values.length) subjectAverages[subject] = average(values);
    });
    return {
      classNo,
      label: profile.label,
      track: profile.track,
      type: profile.type,
      count: students.length,
      average: average(students.map((student) => student.total)),
      topCount,
      undergraduateCount,
      topRate: students.length ? topCount / students.length : 0,
      undergraduateRate: students.length ? undergraduateCount / students.length : 0,
      subjectAverages,
    };
  });
};

export const subjectSummaries = (
  dataset: GradeDataset,
  exam: string,
  track: Track | "全部",
  classNo: number | "全部",
): SubjectSummary[] => {
  const rows = filterScores(dataset, exam, track, classNo);
  const subjects = [...new Set(rows.flatMap((row) => Object.keys(row.subjects) as SubjectName[]))];
  return subjects.map((subject) => {
    const values = rows.map((row) => row.subjects[subject]).filter((value): value is number => typeof value === "number");
    const topLines = rows.map((row) => getThreshold(dataset, exam, row.track)?.topSubjects[subject]).filter((value): value is number => typeof value === "number");
    const undergraduateLines = rows.map((row) => getThreshold(dataset, exam, row.track)?.undergraduateSubjects[subject]).filter((value): value is number => typeof value === "number");
    const topEffectiveLine = topLines.length ? average(topLines) : null;
    const undergraduateEffectiveLine = undergraduateLines.length ? average(undergraduateLines) : null;
    // 跨物理类/历史类筛选时，每名学生都按自己类别的学科有效分判断，不能用两条线的平均值判定。
    const topEffectiveCount = rows.filter((row) => {
      const value = row.subjects[subject];
      const line = getThreshold(dataset, exam, row.track)?.topSubjects[subject];
      return typeof value === "number" && typeof line === "number" && value >= line;
    }).length;
    const undergraduateEffectiveCount = rows.filter((row) => {
      const value = row.subjects[subject];
      const line = getThreshold(dataset, exam, row.track)?.undergraduateSubjects[subject];
      return typeof value === "number" && typeof line === "number" && value >= line;
    }).length;
    return {
      subject,
      count: values.length,
      average: average(values),
      max: values.length ? Math.max(...values) : 0,
      topEffectiveCount,
      topEffectiveRate: values.length ? topEffectiveCount / values.length : 0,
      topEffectiveLine,
      undergraduateEffectiveCount,
      undergraduateEffectiveRate: values.length ? undergraduateEffectiveCount / values.length : 0,
      undergraduateEffectiveLine,
      effectiveCount: undergraduateEffectiveCount,
      effectiveRate: values.length ? undergraduateEffectiveCount / values.length : 0,
      effectiveLine: undergraduateEffectiveLine,
    };
  });
};

export const criticalStudents = (
  dataset: GradeDataset,
  exam: string,
  track: Track | "全部",
  classNo: number | "全部",
) => filterScores(dataset, exam, track, classNo).map((student) => {
  const threshold = getThreshold(dataset, exam, student.track);
  const topDiff = threshold?.topTotal === null || threshold?.topTotal === undefined ? null : student.total - threshold.topTotal;
  const undergraduateDiff = threshold?.undergraduateTotal === null || threshold?.undergraduateTotal === undefined
    ? null
    : student.total - threshold.undergraduateTotal;
  const relevant = relevantSubjects(getClassProfile(student.classNo));
  const subjectDiffs = (tier: "一本" | "本科") => relevant.map((subject) => {
    const score = student.subjects[subject];
    const line = tier === "一本" ? threshold?.topSubjects[subject] : threshold?.undergraduateSubjects[subject];
    return typeof score === "number" && typeof line === "number" ? { subject, diff: score - line } : null;
  }).filter((item): item is { subject: SubjectName; diff: number } => Boolean(item)).sort((a, b) => a.diff - b.diff);
  const criticalTiers: Array<"一本" | "本科"> = [];
  if (topDiff !== null && topDiff >= -20 && topDiff < 0) criticalTiers.push("一本");
  if (undergraduateDiff !== null && undergraduateDiff >= -20 && undergraduateDiff < 0) criticalTiers.push("本科");
  const topWeakSubjects = subjectDiffs("一本");
  const undergraduateWeakSubjects = subjectDiffs("本科");
  return {
    ...student,
    topDiff,
    undergraduateDiff,
    criticalTiers,
    topWeakSubjects,
    undergraduateWeakSubjects,
    weakSubjects: criticalTiers.includes("一本") ? topWeakSubjects : undergraduateWeakSubjects,
  };
}).filter((student) =>
  student.criticalTiers.length > 0,
).sort((a, b) => Math.max(b.topDiff ?? -999, b.undergraduateDiff ?? -999) - Math.max(a.topDiff ?? -999, a.undergraduateDiff ?? -999));

export const criticalStudentsByTier = (
  dataset: GradeDataset,
  exam: string,
  track: Track | "全部",
  classNo: number | "全部",
  tier: "一本" | "本科",
) => criticalStudents(dataset, exam, track, classNo).filter((student) => student.criticalTiers.includes(tier));
