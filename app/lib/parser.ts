import * as XLSX from "xlsx";
import { ALL_SUBJECTS, getClassProfile, normalizeExam, relevantSubjects } from "./class-config";
import type { GradeDataset, ImportIssue, ItemResponse, QuestionMeta, StudentScore, SubjectName, Threshold, Track } from "./types";

type Row = unknown[];

const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const text = (value: unknown): string => String(value ?? "").trim();

const scoreOr = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const parsed = num(value);
    if (parsed !== null) return parsed;
  }
  return undefined;
};

const trackFromExam = (rawExam: string, classNo?: number): Track => {
  if (rawExam.includes("历")) return "历史类";
  if (rawExam.includes("物")) return "物理类";
  if (classNo) return getClassProfile(classNo, rawExam).track;
  return "未配置";
};

const subjectOrder = (track: Track): SubjectName[] =>
  track === "历史类"
    ? ["语文", "数学", "英语", "历史", "政治", "地理"]
    : ["语文", "数学", "英语", "物理", "化学", "生物"];

const parseThresholds = (rows: Row[]): Threshold[] => {
  const map = new Map<string, Threshold>();
  const ensure = (rawExam: string) => {
    const track = trackFromExam(rawExam);
    const exam = normalizeExam(rawExam);
    const key = `${exam}::${track}`;
    if (!map.has(key)) {
      map.set(key, {
        exam,
        track,
        topTotal: null,
        undergraduateTotal: null,
        topSubjects: {},
        undergraduateSubjects: {},
      });
    }
    return map.get(key)!;
  };

  rows.slice(4, 31).forEach((row) => {
    const topExam = text(row[1]);
    if (topExam && num(row[2]) !== null) {
      const threshold = ensure(topExam);
      threshold.topTotal = num(row[2]);
      subjectOrder(threshold.track).forEach((subject, index) => {
        const value = num(row[3 + index]);
        if (value !== null) threshold.topSubjects[subject] = value;
      });
      if (threshold.topSubjects.英语 !== undefined) threshold.topSubjects.日语 = threshold.topSubjects.英语;
      if (threshold.track === "物理类" && threshold.topSubjects.生物 !== undefined) threshold.topSubjects.地理 = threshold.topSubjects.生物;
    }

    const undergraduateExam = text(row[10]);
    if (undergraduateExam && num(row[11]) !== null) {
      const threshold = ensure(undergraduateExam);
      threshold.undergraduateTotal = num(row[11]);
      subjectOrder(threshold.track).forEach((subject, index) => {
        const value = num(row[12 + index]);
        if (value !== null) threshold.undergraduateSubjects[subject] = value;
      });
      if (threshold.undergraduateSubjects.英语 !== undefined) threshold.undergraduateSubjects.日语 = threshold.undergraduateSubjects.英语;
      if (threshold.track === "物理类" && threshold.undergraduateSubjects.生物 !== undefined) threshold.undergraduateSubjects.地理 = threshold.undergraduateSubjects.生物;
    }
  });

  return [...map.values()];
};

const parseScores = (rows: Row[], issues: ImportIssue[]) => {
  const headerIndex = rows.findIndex((row) => text(row[0]) === "考试" && text(row[2]) === "班级");
  const start = headerIndex >= 0 ? headerIndex + 1 : 33;
  const rawScores: StudentScore[] = [];
  const schoolCounts = new Map<string, number>();
  let incompleteRows = 0;
  let missingTotalRows = 0;
  let outOfRangeRows = 0;

  for (let index = start; index < rows.length; index += 1) {
    const row = rows[index];
    const rawExam = text(row[0]);
    const school = text(row[1]);
    const classNo = num(row[2]);
    const name = text(row[3]);
    const hasAnyIdentity = Boolean(rawExam || school || classNo !== null || name);
    if (!rawExam || !school || classNo === null || !name) {
      if (hasAnyIdentity) incompleteRows += 1;
      continue;
    }
    const total = scoreOr(row[5], row[4]);
    if (total === undefined) {
      missingTotalRows += 1;
      continue;
    }
    if (total < 0 || total > 750) outOfRangeRows += 1;

    const profile = getClassProfile(Math.trunc(classNo), rawExam);
    const foreign: SubjectName = profile.classNo === 7 ? "日语" : "英语";
    const subjects: StudentScore["subjects"] = {
      语文: scoreOr(row[10]),
      数学: scoreOr(row[13]),
      [foreign]: scoreOr(row[16]),
    };
    if (profile.track === "物理类") subjects.物理 = scoreOr(row[19]);
    if (profile.track === "历史类") subjects.历史 = scoreOr(row[19]);
    if (profile.combination.includes("化")) subjects.化学 = scoreOr(row[31], row[30]);
    if (profile.combination.includes("生")) subjects.生物 = scoreOr(row[35], row[34]);
    if (profile.combination.includes("政")) subjects.政治 = scoreOr(row[23], row[22]);
    if (profile.combination.includes("地")) {
      // 9班实际为物化地，但领导源表有时仍把地理成绩放在“生物”列。
      subjects.地理 = profile.classNo === 9
        ? scoreOr(row[35], row[34], row[27], row[26])
        : scoreOr(row[27], row[26]);
    }

    rawScores.push({
      exam: normalizeExam(rawExam),
      rawExam,
      school,
      classNo: Math.trunc(classNo),
      name,
      track: profile.track,
      classType: profile.type,
      combination: profile.combination,
      total,
      cityRank: num(row[7]),
      schoolRank: num(row[9]),
      subjects,
    });
    schoolCounts.set(school, (schoolCounts.get(school) ?? 0) + 1);
  }

  const preferredSchool = schoolCounts.has("荣县一中")
    ? "荣县一中"
    : [...schoolCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "未识别学校";
  const schoolScores = rawScores.filter((score) => score.school === preferredSchool);
  const scoreMap = new Map<string, StudentScore>();
  let duplicateRows = 0;
  schoolScores.forEach((score) => {
    const key = `${score.exam}::${score.classNo}::${score.name}`;
    if (scoreMap.has(key)) duplicateRows += 1;
    scoreMap.set(key, score);
  });
  const scores = [...scoreMap.values()];

  if (!scores.length) issues.push({ level: "error", message: "未在“学生基础”中识别到有效学生成绩。" });
  if ([...new Set(scores.map((score) => score.classNo))].some((classNo) => getClassProfile(classNo).type === "待配置" || classNo < 1 || classNo > 16)) {
    issues.push({ level: "warning", message: "存在17班及以后或未配置班级，请在班级设置中补充班型。" });
  }
  if (incompleteRows) issues.push({ level: "warning", message: `有${incompleteRows}行缺少考试、学校、班级或姓名，已跳过，不影响其他有效数据。` });
  if (missingTotalRows) issues.push({ level: "warning", message: `有${missingTotalRows}行缺少总分，已跳过；请检查源表总分列。` });
  if (duplicateRows) issues.push({ level: "info", message: `发现${duplicateRows}条同考试、同班级、同姓名的重复成绩，已自动保留最后一条。` });
  if (outOfRangeRows) issues.push({ level: "warning", message: `发现${outOfRangeRows}条总分超出0—750常规范围，系统已保留但建议核对。` });
  const expectedCells = scores.reduce((sum, score) => sum + relevantSubjects(getClassProfile(score.classNo)).length, 0);
  const subjectCellTotal = scores.reduce((sum, score) => sum + relevantSubjects(getClassProfile(score.classNo)).filter((subject) => typeof score.subjects[subject] === "number").length, 0);
  const subjectCompleteness = expectedCells ? subjectCellTotal / expectedCells : 0;
  if (subjectCompleteness < 0.98) issues.push({ level: "warning", message: `学科成绩完整度为${(subjectCompleteness * 100).toFixed(1)}%，缺失学科仅在相关分析中显示为“—”。` });
  const missingRankCount = scores.filter((score) => score.cityRank === null && score.schoolRank === null).length;
  if (missingRankCount) issues.push({ level: "info", message: `${missingRankCount}条成绩没有市排名和校排名，排名字段将显示为“—”，不影响分数分析。` });
  return { scores, preferredSchool };
};

const parseItems = (workbook: XLSX.WorkBook) => {
  const questionBanks: Record<string, QuestionMeta[]> = {};
  const itemResponses: ItemResponse[] = [];
  const subjectSheets = ALL_SUBJECTS.filter((subject) => subject !== "日语");

  subjectSheets.forEach((subject) => {
    const sheet = workbook.Sheets[subject];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, raw: true, defval: null });
    const metaColumns = new Map<string, number[]>();

    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 80); rowIndex += 1) {
      const row = rows[rowIndex];
      if (text(row[2]) !== "题号") continue;
      const exam = normalizeExam(row[1]);
      if (!exam) continue;
      const questions: QuestionMeta[] = [];
      const columns: number[] = [];
      for (let column = 3; column < row.length; column += 1) {
        const question = text(row[column]);
        if (!question || ["客观分", "主观分", "总分"].includes(question)) continue;
        columns.push(column);
        questions.push({
          question,
          maxScore: num(rows[rowIndex + 1]?.[column]),
          knowledge: text(rows[rowIndex + 2]?.[column]),
        });
      }
      if (questions.length) {
        questionBanks[`${subject}::${exam}`] = questions;
        metaColumns.set(exam, columns);
      }
    }

    for (const row of rows) {
      const rawExam = text(row[0]);
      const classNo = num(row[1]);
      const name = text(row[2]);
      if (!rawExam || classNo === null || !name) continue;
      const exam = normalizeExam(rawExam);
      const columns = metaColumns.get(exam);
      if (!columns?.length) continue;
      const scores = columns.map((column) => num(row[column]));
      if (!scores.some((score) => score !== null)) continue;
      const normalizedClassNo = Math.trunc(classNo);
      const normalizedSubject: SubjectName = normalizedClassNo === 7 && subject === "英语"
        ? "日语"
        : normalizedClassNo === 9 && subject === "生物"
          ? "地理"
          : subject;
      itemResponses.push({ subject: normalizedSubject, exam, classNo: normalizedClassNo, name, scores });
    }
  });

  return { questionBanks, itemResponses };
};

export async function parseGradeWorkbook(file: File): Promise<GradeDataset> {
  if (file.size > 120 * 1024 * 1024) throw new Error("工作簿超过120MB，为避免浏览器内存不足，请先删除无关图片或拆分历史数据后再导入。");
  const data = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", cellDates: true });
  } catch {
    throw new Error("工作簿无法读取，可能已损坏、被加密或不是有效的Excel文件；系统已保留原有数据。");
  }
  const issues: ImportIssue[] = [];
  let baseSheetName = "学生基础";
  let baseSheet = workbook.Sheets[baseSheetName];
  if (!baseSheet) {
    baseSheetName = workbook.SheetNames.find((sheetName) => {
      const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null, range: 0 });
      return rows.slice(0, 60).some((row) => text(row[0]) === "考试" && text(row[2]) === "班级");
    }) ?? "";
    baseSheet = baseSheetName ? workbook.Sheets[baseSheetName] : undefined;
    if (baseSheet) issues.push({ level: "info", message: `未找到“学生基础”工作表，已自动使用“${baseSheetName}”作为成绩数据表。` });
  }
  if (!baseSheet) throw new Error("没有找到包含“考试、班级、姓名、总分”的成绩工作表；系统已保留原有数据，请检查表头。" );
  const baseRows = XLSX.utils.sheet_to_json<Row>(baseSheet, { header: 1, raw: true, defval: null });
  const thresholds = parseThresholds(baseRows);
  const { scores, preferredSchool } = parseScores(baseRows, issues);
  const { questionBanks, itemResponses } = parseItems(workbook);
  const exams = [...new Set(scores.map((score) => score.exam))];

  if (!scores.length) throw new Error("工作簿中没有可用学生成绩；系统已保留原有数据，请检查考试、班级、姓名和总分列。" );
  if (!thresholds.length) issues.push({ level: "warning", message: "未识别到一本/本科分数线：成绩、均分和排名仍可查看，上线与临界生模块将暂不可用。" });
  const missingThresholds = exams.flatMap((exam) => (["物理类", "历史类"] as const).filter((track) =>
    scores.some((score) => score.exam === exam && score.track === track) &&
    !thresholds.some((threshold) => threshold.exam === exam && threshold.track === track && typeof threshold.topTotal === "number" && typeof threshold.undergraduateTotal === "number"),
  ).map((track) => `${exam}${track}`));
  if (missingThresholds.length) issues.push({ level: "warning", message: `以下考试缺少完整一本/本科线：${missingThresholds.slice(0, 8).join("、")}${missingThresholds.length > 8 ? "等" : ""}；相应上线分析将显示为0或未设置。` });
  if (!itemResponses.length) issues.push({ level: "warning", message: "未识别到小题明细，其他成绩分析仍可正常使用。" });
  const missingSubjectSheets = ["语文", "数学", "英语", "物理", "历史", "化学", "生物", "政治", "地理"].filter((subject) => !workbook.Sheets[subject]);
  if (missingSubjectSheets.length) issues.push({ level: "info", message: `未找到${missingSubjectSheets.join("、")}小题工作表，仅这些学科的小题分析不可用。` });
  issues.push({ level: "info", message: "已启用特殊口径：7班英语列按日语处理，9班生物列按地理处理。" });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sourceName: file.name,
    importedAt: new Date().toISOString(),
    school: preferredSchool,
    exams,
    scores,
    thresholds,
    questionBanks,
    itemResponses,
    issues,
    sheets: workbook.SheetNames,
  };
}
