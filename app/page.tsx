"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LineChart as LineChartIcon,
  LoaderCircle,
  Medal,
  Menu,
  Printer,
  School,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CLASS_PROFILES, getClassProfile, relevantSubjects } from "./lib/class-config";
import { average, classSummaries, criticalStudents, filterScores, getThreshold, subjectSummaries } from "./lib/analytics";
import { createDemoDataset } from "./lib/demo";
import { parseGradeWorkbook } from "./lib/parser";
import { loadLatestDataset, saveLatestDataset } from "./lib/storage";
import type { GradeDataset, StudentScore, SubjectName, Track } from "./lib/types";

type ViewId = "dashboard" | "grade" | "classes" | "subjects" | "students" | "online" | "items" | "history" | "reports" | "settings";
type ReportType = "年级质量分析" | "班级成绩分析" | "学科质量分析" | "上线与临界生";
const REPORT_TYPES: ReportType[] = ["年级质量分析", "班级成绩分析", "学科质量分析", "上线与临界生"];

const navItems: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "年级驾驶舱", icon: LayoutDashboard },
  { id: "grade", label: "年级总成绩", icon: GraduationCap },
  { id: "classes", label: "班级横向对比", icon: UsersRound },
  { id: "subjects", label: "学科分析", icon: BarChart3 },
  { id: "students", label: "学生画像", icon: UserRoundSearch },
  { id: "online", label: "上线与临界生", icon: Target },
  { id: "items", label: "小题与知识点", icon: BookOpenCheck },
  { id: "history", label: "历次考试", icon: LineChartIcon },
  { id: "reports", label: "报告中心", icon: ClipboardList },
  { id: "settings", label: "规则与班型", icon: Settings },
];

const TIER_COLORS = { top: "#F59E0B", undergraduate: "#10B981", neutral: "#94A3B8" } as const;
const COLORS = [TIER_COLORS.top, TIER_COLORS.undergraduate, TIER_COLORS.neutral, "#176B87", "#665A9E"];
const format1 = (value: number) => value.toFixed(1);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const cnDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

function StatCard({ icon: Icon, label, value, note, tone = "blue" }: { icon: typeof Target; label: string; value: string; note: string; tone?: string }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon"><Icon size={20} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><BarChart3 size={34} /><p>{text}</p></div>;
}

function StatusTag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" | "neutral" | "blue" }) {
  return <span className={`status-tag ${tone}`}>{children}</span>;
}

function TierLegend() {
  return <div className="tier-legend" aria-label="一本和本科颜色说明"><span className="top"><i />一本/特控</span><span className="undergraduate"><i />本科</span></div>;
}

function ReportBody({ dataset, exam, track, classNo, reportType, reportId = "report-content" }: { dataset: GradeDataset; exam: string; track: Track | "全部"; classNo: number | "全部"; reportType: ReportType; reportId?: string }) {
  const rows = filterScores(dataset, exam, track, classNo);
  const classes = classSummaries(dataset, exam, track).filter((item) => classNo === "全部" || item.classNo === classNo);
  const critical = criticalStudents(dataset, exam, track, classNo);
  const topCritical = critical.filter((item) => item.criticalTiers.includes("一本"));
  const undergraduateCritical = critical.filter((item) => item.criticalTiers.includes("本科"));
  const subjects = subjectSummaries(dataset, exam, track, classNo);
  const avg = average(rows.map((row) => row.total));
  const top = rows.filter((row) => {
    const line = getThreshold(dataset, exam, row.track)?.topTotal;
    return typeof line === "number" && row.total >= line;
  }).length;
  const undergraduate = rows.filter((row) => {
    const line = getThreshold(dataset, exam, row.track)?.undergraduateTotal;
    return typeof line === "number" && row.total >= line;
  }).length;
  const strongest = [...subjects].sort((a, b) => b.undergraduateEffectiveRate - a.undergraduateEffectiveRate)[0];
  const weakest = [...subjects].sort((a, b) => a.undergraduateEffectiveRate - b.undergraduateEffectiveRate)[0];

  return (
    <div className="report-paper" id={reportId}>
      <div className="report-brand">荣县一中 · 高2024级</div>
      <h1>{exam}考试 · {reportType}报告</h1>
      <p className="report-meta">范围：{track}{classNo === "全部" ? " · 全部班级" : ` · ${classNo}班`}　生成方式：系统即时生成</p>
      <div className="report-kpis">
        <div><span>参考人数</span><b>{rows.length}</b></div>
        <div><span>平均分</span><b>{format1(avg)}</b></div>
        <div className="report-tier-top"><span>特控/一本上线</span><b>{top}</b></div>
        <div className="report-tier-undergraduate"><span>本科上线</span><b>{undergraduate}</b></div>
      </div>
      <h2>一、总体情况</h2>
      <p>本次纳入分析学生{rows.length}人，平均分{format1(avg)}分。特控/一本上线{top}人，本科上线{undergraduate}人；一本线下20分以内临界学生{topCritical.length}人，本科线下20分以内临界学生{undergraduateCritical.length}人。</p>
      <h2>二、班级表现</h2>
      <table><thead><tr><th>班级</th><th>班型</th><th>人数</th><th>平均分</th><th>一本上线</th><th>本科上线</th></tr></thead>
        <tbody>{classes.map((item) => <tr key={item.classNo}><td>{item.classNo}班</td><td>{item.type}</td><td>{item.count}</td><td>{format1(item.average)}</td><td>{item.topCount}</td><td>{item.undergraduateCount}</td></tr>)}</tbody>
      </table>
      <h2>三、学科诊断</h2>
      <p>{strongest ? `${strongest.subject}本科有效上线率相对较高（${percent(strongest.undergraduateEffectiveRate)}）` : "暂无有效分数据"}；{weakest ? `${weakest.subject}本科有效上线率相对较低（${percent(weakest.undergraduateEffectiveRate)}），建议优先复盘。` : ""}</p>
      <table><thead><tr><th>学科</th><th>参考人数</th><th>平均分</th><th>一本有效人数/率</th><th>本科有效人数/率</th></tr></thead>
        <tbody>{subjects.map((item) => <tr key={item.subject}><td>{item.subject}</td><td>{item.count}</td><td>{format1(item.average)}</td><td>{item.topEffectiveCount} / {percent(item.topEffectiveRate)}</td><td>{item.undergraduateEffectiveCount} / {percent(item.undergraduateEffectiveRate)}</td></tr>)}</tbody>
      </table>
      <h2>四、临界生关注</h2>
      <p>建议班主任与任课教师重点关注以下靠线学生，优先补强其差距最大的学科。</p>
      <table><thead><tr><th>临界类型</th><th>班级</th><th>姓名</th><th>总分</th><th>一本差</th><th>本科差</th><th>优先补强</th></tr></thead>
        <tbody>{critical.slice(0, 20).map((item) => <tr key={`${item.classNo}-${item.name}`}><td>{item.criticalTiers.join("、")}</td><td>{item.classNo}班</td><td>{item.name}</td><td>{format1(item.total)}</td><td>{item.topDiff === null ? "—" : format1(item.topDiff)}</td><td>{item.undergraduateDiff === null ? "—" : format1(item.undergraduateDiff)}</td><td>{item.weakSubjects.slice(0, 2).map((weak) => weak.subject).join("、") || "待分析"}</td></tr>)}</tbody>
      </table>
      <div className="report-footer">数据来源：{dataset.sourceName} · 系统依据导入成绩重新计算</div>
    </div>
  );
}

export default function Home() {
  const [dataset, setDataset] = useState<GradeDataset>(() => createDemoDataset());
  const [view, setView] = useState<ViewId>("dashboard");
  const [exam, setExam] = useState("4册");
  const [track, setTrack] = useState<Track | "全部">("物理类");
  const [classNo, setClassNo] = useState<number | "全部">("全部");
  const [subject, setSubject] = useState<SubjectName>("语文");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentScore | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<"word" | "pdf" | null>(null);
  const [reportType, setReportType] = useState<ReportType>("年级质量分析");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLatestDataset().then((saved) => {
      if (saved) {
        setDataset(saved);
        setExam(saved.exams.includes("4册") ? "4册" : saved.exams.at(-1) ?? "");
      }
    }).catch(() => undefined);
  }, []);

  const activeScores = useMemo(() => filterScores(dataset, exam, track, classNo), [dataset, exam, track, classNo]);
  const allClassSummaries = useMemo(() => classSummaries(dataset, exam, track), [dataset, exam, track]);
  const currentClassSummaries = useMemo(() => allClassSummaries.filter((item) => classNo === "全部" || item.classNo === classNo), [allClassSummaries, classNo]);
  const subjects = useMemo(() => subjectSummaries(dataset, exam, track, classNo), [dataset, exam, track, classNo]);
  const activeSubject = subjects.some((item) => item.subject === subject) ? subject : subjects[0]?.subject ?? subject;
  const critical = useMemo(() => criticalStudents(dataset, exam, track, classNo), [dataset, exam, track, classNo]);
  const topCritical = useMemo(() => critical.filter((item) => item.criticalTiers.includes("一本")), [critical]);
  const undergraduateCritical = useMemo(() => critical.filter((item) => item.criticalTiers.includes("本科")), [critical]);
  const gradeAverage = average(activeScores.map((row) => row.total));
  const topCount = activeScores.filter((row) => {
    const line = getThreshold(dataset, exam, row.track)?.topTotal;
    return typeof line === "number" && row.total >= line;
  }).length;
  const undergraduateCount = activeScores.filter((row) => {
    const line = getThreshold(dataset, exam, row.track)?.undergraduateTotal;
    return typeof line === "number" && row.total >= line;
  }).length;
  const expectedSubjectCells = activeScores.reduce((sum, row) => sum + relevantSubjects(getClassProfile(row.classNo)).length, 0);
  const presentSubjectCells = activeScores.reduce((sum, row) => sum + relevantSubjects(getClassProfile(row.classNo)).filter((item) => typeof row.subjects[item] === "number").length, 0);
  const subjectCompleteness = expectedSubjectCells ? presentSubjectCells / expectedSubjectCells : 0;
  const activeTracks = [...new Set(activeScores.map((row) => row.track))];
  const completeThresholdTracks = activeTracks.filter((item) => {
    const line = getThreshold(dataset, exam, item);
    return typeof line?.topTotal === "number" && typeof line?.undergraduateTotal === "number";
  }).length;
  const thresholdCompleteness = activeTracks.length ? completeThresholdTracks / activeTracks.length : 0;
  const dataQualityScore = activeScores.length ? Math.round(subjectCompleteness * 72 + thresholdCompleteness * 28) : 0;
  const datasetIssues = dataset.issues ?? [];
  const warningCount = datasetIssues.filter((item) => item.level === "warning" || item.level === "error").length;
  const classOptions = [...new Set(dataset.scores.filter((row) => row.exam === exam && (track === "全部" || row.track === track)).map((row) => row.classNo))].sort((a, b) => a - b);
  const searchedStudents = activeScores.filter((row) => !studentQuery || row.name.includes(studentQuery)).slice(0, 80);

  const historyData = dataset.exams.map((examName) => {
    const rows = filterScores(dataset, examName, track, classNo);
    return {
      exam: examName,
      average: Number(average(rows.map((row) => row.total)).toFixed(1)),
      top: rows.filter((row) => {
        const line = getThreshold(dataset, examName, row.track)?.topTotal;
        return typeof line === "number" && row.total >= line;
      }).length,
      undergraduate: rows.filter((row) => {
        const line = getThreshold(dataset, examName, row.track)?.undergraduateTotal;
        return typeof line === "number" && row.total >= line;
      }).length,
    };
  });

  const itemSourceSubject: SubjectName = activeSubject === "日语"
    ? "英语"
    : activeSubject === "地理" && (classNo === 9 || (classNo === "全部" && track === "物理类"))
      ? "生物"
      : activeSubject;
  const itemKey = `${itemSourceSubject}::${exam}`;
  const questionBank = (dataset.questionBanks ?? {})[itemKey] ?? [];
  const itemRows = (dataset.itemResponses ?? []).filter((row) => row.subject === activeSubject && row.exam === exam && (classNo === "全部" || row.classNo === classNo));
  const itemStats = itemRows.length ? questionBank.map((question, index) => {
    const values = itemRows.map((row) => row.scores[index]).filter((value): value is number => typeof value === "number");
    const avg = average(values);
    return { question: question.question, knowledge: question.knowledge || "未标注", maxScore: question.maxScore, average: avg, rate: question.maxScore ? avg / question.maxScore : 0 };
  }) : [];

  async function handleImport(file?: File) {
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const parsed = await parseGradeWorkbook(file);
      setDataset(parsed);
      const defaultExam = parsed.exams.includes("4册") ? "4册" : parsed.exams.at(-1) ?? "";
      setExam(defaultExam);
      setTrack("物理类");
      setClassNo("全部");
      setSelectedStudent(null);
      let storageNote = "";
      try {
        await saveLatestDataset(parsed);
      } catch {
        storageNote = " 但浏览器未能永久保存，本次打开期间仍可继续分析。";
      }
      const parsedWarningCount = parsed.issues.filter((item) => item.level === "warning" || item.level === "error").length;
      setImportMessage(`导入完成：识别${parsed.scores.length.toLocaleString()}条成绩、${parsed.exams.length}次考试${parsedWarningCount ? `，有${parsedWarningCount}项数据提醒可在“规则与班型”查看` : "，数据检查通过"}。${storageNote}`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败，请检查工作簿格式。" );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function exportWord() {
    setExporting("word");
    try {
      const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType } = await import("docx");
      const rows = filterScores(dataset, exam, track, classNo);
      const criticalRows = criticalStudents(dataset, exam, track, classNo);
      const topCriticalRows = criticalRows.filter((item) => item.criticalTiers.includes("一本"));
      const undergraduateCriticalRows = criticalRows.filter((item) => item.criticalTiers.includes("本科"));
      const classes = currentClassSummaries;
      const subjectRows = subjectSummaries(dataset, exam, track, classNo);
      const doc = new Document({
      styles: { default: { document: { run: { font: "Microsoft YaHei", size: 21 } } } },
      sections: [{
        children: [
          new Paragraph({ text: `${exam}考试 · ${reportType}报告`, heading: HeadingLevel.TITLE }),
          new Paragraph({ children: [new TextRun(`范围：${track}${classNo === "全部" ? " · 全部班级" : ` · ${classNo}班`}　数据来源：${dataset.sourceName}`)] }),
          new Paragraph({ text: "一、总体情况", heading: HeadingLevel.HEADING_1 }),
          new Paragraph(`参考${rows.length}人，平均分${format1(average(rows.map((row) => row.total)))}分，特控/一本上线${topCount}人，本科上线${undergraduateCount}人；一本临界生${topCriticalRows.length}人，本科临界生${undergraduateCriticalRows.length}人。`),
          new Paragraph({ text: "二、班级表现", heading: HeadingLevel.HEADING_1 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            new TableRow({ children: ["班级", "班型", "人数", "平均分", "一本上线", "本科上线"].map((value) => new TableCell({ children: [new Paragraph(value)] })) }),
            ...classes.map((item) => new TableRow({ children: [`${item.classNo}班`, item.type, String(item.count), format1(item.average), String(item.topCount), String(item.undergraduateCount)].map((value) => new TableCell({ children: [new Paragraph(value)] })) })),
          ] }),
          new Paragraph({ text: "三、学科有效上线", heading: HeadingLevel.HEADING_1 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            new TableRow({ children: ["学科", "平均分", "一本有效人数/率", "本科有效人数/率"].map((value) => new TableCell({ children: [new Paragraph(value)] })) }),
            ...subjectRows.map((item) => new TableRow({ children: [item.subject, format1(item.average), `${item.topEffectiveCount} / ${percent(item.topEffectiveRate)}`, `${item.undergraduateEffectiveCount} / ${percent(item.undergraduateEffectiveRate)}`].map((value) => new TableCell({ children: [new Paragraph(value)] })) })),
          ] }),
          new Paragraph({ text: "四、临界生名单", heading: HeadingLevel.HEADING_1 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            new TableRow({ children: ["临界类型", "班级", "姓名", "总分", "一本差", "本科差", "优先补强"].map((value) => new TableCell({ children: [new Paragraph(value)] })) }),
            ...criticalRows.slice(0, 40).map((item) => new TableRow({ children: [item.criticalTiers.join("、"), `${item.classNo}班`, item.name, format1(item.total), item.topDiff === null ? "—" : format1(item.topDiff), item.undergraduateDiff === null ? "—" : format1(item.undergraduateDiff), item.weakSubjects.slice(0, 2).map((weak) => weak.subject).join("、")].map((value) => new TableCell({ children: [new Paragraph(value)] })) })),
          ] }),
        ],
      }],
    });
      const blob = await Packer.toBlob(doc);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${exam}-${classNo === "全部" ? track : `${classNo}班`}-${reportType}.docx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setImportMessage("Word报告已生成并开始下载。");
    } catch (error) {
      setImportMessage(error instanceof Error ? `Word导出失败：${error.message}` : "Word导出失败，请重试。");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      await document.fonts.ready;
      const target = document.getElementById("export-report-content");
      if (!target) throw new Error("未找到报告内容");
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 7;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const maxSlicePixels = contentHeight * canvas.width / contentWidth;
      const targetRect = target.getBoundingClientRect();
      const canvasScale = canvas.width / targetRect.width;
      const protectedRanges = Array.from(target.querySelectorAll("h1, h2, p, tr, .report-kpis, .report-footer")).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: Math.max(0, (rect.top - targetRect.top) * canvasScale),
          bottom: Math.min(canvas.height, (rect.bottom - targetRect.top) * canvasScale),
        };
      });
      const compactToSinglePage = canvas.height > maxSlicePixels && canvas.height <= maxSlicePixels * 1.12;
      if (compactToSinglePage) {
        const naturalHeightMm = canvas.height * contentWidth / canvas.width;
        const scale = contentHeight / naturalHeightMm;
        const compactWidth = contentWidth * scale;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (pageWidth - compactWidth) / 2, margin, compactWidth, contentHeight, undefined, "FAST");
      }
      let sliceStart = 0;
      let pageIndex = 0;
      while (!compactToSinglePage && sliceStart < canvas.height - 2) {
        const desiredEnd = Math.min(canvas.height, sliceStart + maxSlicePixels);
        let sliceEnd = desiredEnd;
        if (desiredEnd < canvas.height) {
          const crossing = protectedRanges.find((range) => range.top < desiredEnd && range.bottom > desiredEnd && range.top > sliceStart + maxSlicePixels * 0.45);
          if (crossing) sliceEnd = crossing.top;
        }
        if (sliceEnd <= sliceStart + 20) sliceEnd = desiredEnd;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceEnd - sliceStart);
        const context = sliceCanvas.getContext("2d");
        if (!context) throw new Error("无法创建PDF分页画布");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        context.drawImage(canvas, 0, sliceStart, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        if (pageIndex > 0) pdf.addPage();
        const sliceHeightMm = sliceCanvas.height * contentWidth / sliceCanvas.width;
        pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, contentWidth, sliceHeightMm, undefined, "FAST");
        sliceStart = sliceEnd;
        pageIndex += 1;
      }
      pdf.save(`${exam}-${classNo === "全部" ? track : `${classNo}班`}-${reportType}.pdf`);
      setImportMessage("PDF报告已生成并开始下载。");
    } catch (error) {
      setImportMessage(error instanceof Error ? `PDF导出失败：${error.message}` : "PDF导出失败，请重试。");
    } finally {
      setExporting(null);
    }
  }

  const renderDashboard = () => {
    const rankData = [...currentClassSummaries].sort((a, b) => b.undergraduateRate - a.undergraduateRate).map((item) => ({ name: `${item.classNo}班`, 平均分: Number(item.average.toFixed(1)), 一本率: Number((item.topRate * 100).toFixed(1)), 本科率: Number((item.undergraduateRate * 100).toFixed(1)) }));
    const pieData = [{ name: "一本上线", value: topCount }, { name: "本科上线（未一本）", value: Math.max(0, undergraduateCount - topCount) }, { name: "本科线下", value: Math.max(0, activeScores.length - undergraduateCount) }];
    const bestConversionClass = [...currentClassSummaries].sort((a, b) => b.undergraduateRate - a.undergraduateRate)[0];
    return <>
      <div className="hero-strip">
        <div><span className="eyebrow">EXAM QUALITY OVERVIEW</span><h1>{exam}考试 · {track}质量驾驶舱</h1><p>从年级概况下钻到班级、学科、学生和小题，所有结论均由导入数据重新计算。</p></div>
        <button className="primary-button" onClick={() => fileRef.current?.click()}><Upload size={18} />导入新工作簿</button>
      </div>
      <div className="stat-grid">
        <StatCard icon={UsersRound} label="参考人数" value={activeScores.length.toLocaleString()} note={`${currentClassSummaries.length}个班级纳入分析`} />
        <StatCard icon={Medal} label="年级平均分" value={format1(gradeAverage)} note={`最高分${activeScores.length ? format1(Math.max(...activeScores.map((row) => row.total))) : "—"}`} tone="teal" />
        <StatCard icon={Target} label="特控/一本上线" value={`${topCount}人`} note={`上线率${percent(activeScores.length ? topCount / activeScores.length : 0)}`} tone="orange" />
        <StatCard icon={CheckCircle2} label="本科上线" value={`${undergraduateCount}人`} note={`一本临界${topCritical.length}人 · 本科临界${undergraduateCritical.length}人`} tone="green" />
      </div>
      <div className={`quality-strip ${warningCount ? "has-warning" : "is-good"}`}>
        <div className="quality-score" style={{ "--quality": `${dataQualityScore * 3.6}deg` } as React.CSSProperties}><ShieldCheck size={19} /><b>{dataQualityScore}</b></div>
        <div><span>数据质量与容错状态</span><strong>{warningCount ? `${warningCount}项提醒，已自动降级处理` : "数据结构完整，可放心分析"}</strong><small>学科完整度{percent(subjectCompleteness)} · 分数线完整度{percent(thresholdCompleteness)} · 缺失项不会按0分计算</small></div>
        <button onClick={() => setView("settings")}>查看数据质检<ArrowUpRight size={15} /></button>
      </div>
      <div className="dashboard-grid">
        <Panel title="班级一本 / 本科上线率" subtitle="橙色为一本，绿色为本科；同组柱可直接比较转化空间" action={<TierLegend />} className="span-2">
          {rankData.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={rankData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7edf0" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} /><Tooltip cursor={{ fill: "rgba(23,107,135,.05)" }} /><Legend /><Bar dataKey="一本率" fill={TIER_COLORS.top} radius={[7, 7, 2, 2]} animationDuration={900} /><Bar dataKey="本科率" fill={TIER_COLORS.undergraduate} radius={[7, 7, 2, 2]} animationDuration={1100} /></BarChart></ResponsiveContainer></div> : <EmptyState text="当前筛选范围没有班级数据" />}
        </Panel>
        <Panel title="上线结构" subtitle="按当前分数线自动计算">
          <div className="pie-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={3} animationDuration={1000}>{pieData.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer><div className="pie-center"><b>{activeScores.length}</b><span>总人数</span></div></div>
        </Panel>
        <Panel title="学科有效上线" subtitle="一本 / 本科双口径">
          <div className="subject-list">{subjects.slice(0, 8).map((item) => <button key={item.subject} onClick={() => { setSubject(item.subject); setView("subjects"); }}><span>{item.subject}</span><div className="dual-progress"><i className="top" style={{ width: `${Math.min(100, item.topEffectiveRate * 100)}%` }} /><i className="undergraduate" style={{ width: `${Math.min(100, item.undergraduateEffectiveRate * 100)}%` }} /></div><b><em>一本{percent(item.topEffectiveRate)}</em><em>本科{percent(item.undergraduateEffectiveRate)}</em></b></button>)}</div>
        </Panel>
        <Panel title="本次考试智能洞察" subtitle="根据当前筛选范围实时生成" className="span-2">
          <div className="insight-cards"><div><TrendingUp /><p><b>上线转化空间</b><span>本科上线比一本上线多{Math.max(0, undergraduateCount - topCount)}人，可重点跟踪一本临界生。</span></p></div><div><Sparkles /><p><b>班级亮点</b><span>{bestConversionClass ? `${bestConversionClass.classNo}班本科上线率${percent(bestConversionClass.undergraduateRate)}，当前范围表现较优。` : "暂无班级数据"}</span></p></div><div><ShieldCheck /><p><b>数据可信度</b><span>{dataQualityScore >= 95 ? "核心字段完整，分析结果可信度较高。" : "部分字段缺失，系统已按模块降级并保留有效结论。"}</span></p></div></div>
        </Panel>
        <Panel title="临界生预警" subtitle="总分线下20分以内" action={<button className="text-button" onClick={() => setView("online")}>查看全部</button>} className="span-2">
          <div className="compact-table"><table><thead><tr><th>类型</th><th>班级</th><th>姓名</th><th>总分</th><th>一本差</th><th>本科差</th><th>优先补强</th></tr></thead><tbody>{critical.slice(0, 8).map((item) => <tr key={`${item.classNo}-${item.name}`}><td>{item.criticalTiers.join("、")}</td><td>{item.classNo}班</td><td>{item.name}</td><td>{format1(item.total)}</td><td className={(item.topDiff ?? 0) < 0 ? "negative" : "positive"}>{item.topDiff === null ? "—" : format1(item.topDiff)}</td><td>{item.undergraduateDiff === null ? "—" : format1(item.undergraduateDiff)}</td><td>{item.weakSubjects.slice(0, 2).map((weak) => weak.subject).join("、") || "待分析"}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    </>;
  };

  const renderGrade = () => <Panel title="年级总成绩表" subtitle={`共${activeScores.length}名学生，可按总分、市排名、校排名查看`} action={<StatusTag tone="blue">{track}</StatusTag>}>
    <div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="搜索学生姓名" /></div><span>当前显示前80条，可通过班级筛选缩小范围</span></div>
    <div className="data-table"><table><thead><tr><th>校名</th><th>班级</th><th>姓名</th><th>班型</th><th>组合</th><th>总分</th><th>一本差</th><th>本科差</th><th>市排名</th><th>校排名</th>{["语文", "数学", "英语", "日语", "物理", "历史", "化学", "生物", "政治", "地理"].map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{[...searchedStudents].sort((a, b) => b.total - a.total).map((row) => { const line = getThreshold(dataset, exam, row.track); return <tr key={`${row.classNo}-${row.name}`} onClick={() => { setSelectedStudent(row); setView("students"); }}><td>{dataset.school}</td><td>{row.classNo}班</td><td className="student-link">{row.name}</td><td>{row.classType}</td><td>{row.combination}</td><td><b>{format1(row.total)}</b></td><td>{typeof line?.topTotal === "number" ? format1(row.total - line.topTotal) : "—"}</td><td>{typeof line?.undergraduateTotal === "number" ? format1(row.total - line.undergraduateTotal) : "—"}</td><td>{row.cityRank ?? "—"}</td><td>{row.schoolRank ?? "—"}</td>{["语文", "数学", "英语", "日语", "物理", "历史", "化学", "生物", "政治", "地理"].map((item) => <td key={item}>{row.subjects[item as SubjectName] === undefined ? "—" : format1(row.subjects[item as SubjectName]!)}</td>)}</tr>; })}</tbody></table></div>
  </Panel>;

  const renderClasses = () => {
    const data = currentClassSummaries.map((item) => ({ name: `${item.classNo}班`, 平均分: Number(item.average.toFixed(1)), 一本率: Number((item.topRate * 100).toFixed(1)), 本科率: Number((item.undergraduateRate * 100).toFixed(1)) }));
    return <div className="two-column">
      <Panel title="班级横向对比" subtitle="平均分及一本/本科上线率，建议优先在同班型内比较" action={<TierLegend />} className="span-2"><div className="chart-box tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} /><Tooltip cursor={{ fill: "rgba(23,107,135,.05)" }} /><Legend /><Bar yAxisId="left" dataKey="平均分" fill="#176B87" radius={[6, 6, 2, 2]} animationDuration={800} /><Bar yAxisId="right" dataKey="一本率" fill={TIER_COLORS.top} radius={[6, 6, 2, 2]} animationDuration={1000} /><Bar yAxisId="right" dataKey="本科率" fill={TIER_COLORS.undergraduate} radius={[6, 6, 2, 2]} animationDuration={1200} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="班级指标排名" subtitle="点击班级进入该班分析" className="span-2"><div className="data-table"><table><thead><tr><th>班级</th><th>类别</th><th>班型</th><th>人数</th><th>平均分</th><th>一本人数/率</th><th>本科人数/率</th><th>操作</th></tr></thead><tbody>{[...currentClassSummaries].sort((a, b) => b.average - a.average).map((item, index) => <tr key={item.classNo}><td><b>{index + 1}. {item.classNo}班</b></td><td>{item.track}</td><td>{item.type}</td><td>{item.count}</td><td>{format1(item.average)}</td><td>{item.topCount} / {percent(item.topRate)}</td><td>{item.undergraduateCount} / {percent(item.undergraduateRate)}</td><td><button className="table-action" onClick={() => setClassNo(item.classNo)}>只看该班</button></td></tr>)}</tbody></table></div></Panel>
    </div>;
  };

  const renderSubjects = () => {
    const selected = subjects.find((item) => item.subject === activeSubject) ?? subjects[0];
    const classData = currentClassSummaries.map((item) => ({ name: `${item.classNo}班`, average: Number((item.subjectAverages[activeSubject] ?? 0).toFixed(1)) })).filter((item) => item.average > 0);
    return <div className="two-column">
      <Panel title="学科选择" subtitle="切换学科查看班级横向差异"><div className="subject-pills">{subjects.map((item) => <button className={activeSubject === item.subject ? "active" : ""} onClick={() => setSubject(item.subject)} key={item.subject}>{item.subject}<span>{format1(item.average)}</span></button>)}</div></Panel>
      <div className="mini-stat-row"><StatCard icon={BarChart3} label={`${selected?.subject ?? activeSubject}平均分`} value={selected ? format1(selected.average) : "—"} note={`最高分${selected ? format1(selected.max) : "—"}`} /><StatCard icon={Target} label="一本学科有效" value={`${selected?.topEffectiveCount ?? 0}人`} note={`有效线${selected?.topEffectiveLine ? format1(selected.topEffectiveLine) : "未设置"} · ${percent(selected?.topEffectiveRate ?? 0)}`} tone="orange" /><StatCard icon={CheckCircle2} label="本科学科有效" value={`${selected?.undergraduateEffectiveCount ?? 0}人`} note={`有效线${selected?.undergraduateEffectiveLine ? format1(selected.undergraduateEffectiveLine) : "未设置"} · ${percent(selected?.undergraduateEffectiveRate ?? 0)}`} tone="green" /></div>
      <Panel title={`${activeSubject}班级横向对比`} subtitle="只比较实际参加该学科的班级" className="span-2"><div className="chart-box tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={classData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={["dataMin - 8", "dataMax + 5"]} /><Tooltip cursor={{ fill: "rgba(23,107,135,.05)" }} /><Bar dataKey="average" name="平均分" fill="#3AA6B9" radius={[7, 7, 2, 2]} animationDuration={1000} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="各学科概览" subtitle="一本与本科有效上线双口径" className="span-2"><div className="data-table"><table><thead><tr><th>学科</th><th>参考人数</th><th>平均分</th><th>最高分</th><th>一本有效分</th><th>一本人数/率</th><th>本科有效分</th><th>本科人数/率</th></tr></thead><tbody>{subjects.map((item) => <tr key={item.subject}><td><b>{item.subject}</b></td><td>{item.count}</td><td>{format1(item.average)}</td><td>{format1(item.max)}</td><td>{item.topEffectiveLine ? format1(item.topEffectiveLine) : "未设置"}</td><td>{item.topEffectiveCount} / {percent(item.topEffectiveRate)}</td><td>{item.undergraduateEffectiveLine ? format1(item.undergraduateEffectiveLine) : "未设置"}</td><td>{item.undergraduateEffectiveCount} / {percent(item.undergraduateEffectiveRate)}</td></tr>)}</tbody></table></div></Panel>
    </div>;
  };

  const renderStudents = () => {
    const selected = selectedStudent && activeScores.some((row) => row.classNo === selectedStudent.classNo && row.name === selectedStudent.name)
      ? selectedStudent
      : [...activeScores].sort((a, b) => b.total - a.total)[0] ?? null;
    if (!selected) return <EmptyState text="当前范围没有学生数据" />;
    const history = dataset.scores.filter((row) => row.classNo === selected.classNo && row.name === selected.name).map((row) => ({ exam: row.exam, total: row.total, 市排名: row.cityRank }));
    const threshold = getThreshold(dataset, exam, selected.track);
    const subjectData = relevantSubjects(getClassProfile(selected.classNo)).map((item) => ({ subject: item, score: selected.subjects[item] ?? 0, topLine: threshold?.topSubjects[item] ?? 0, undergraduateLine: threshold?.undergraduateSubjects[item] ?? 0 }));
    return <div className="student-layout">
      <Panel title="学生检索" subtitle="点击姓名查看完整画像"><div className="search-box full"><Search size={16} /><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="输入学生姓名" /></div><div className="student-results">{searchedStudents.slice(0, 20).map((row) => <button className={selected.name === row.name && selected.classNo === row.classNo ? "active" : ""} onClick={() => setSelectedStudent(row)} key={`${row.classNo}-${row.name}`}><span>{row.name}<small>{row.classNo}班 · {row.classType}</small></span><b>{format1(row.total)}</b></button>)}</div></Panel>
      <div className="student-main">
        <div className="student-hero"><div className="avatar">{selected.name.slice(-1)}</div><div><span>{selected.classNo}班 · {selected.combination} · {selected.classType}</span><h1>{selected.name}</h1><p>{exam}总分 {format1(selected.total)} · 市排名 {selected.cityRank ?? "—"} · 校排名 {selected.schoolRank ?? "—"}</p></div><div className="student-status">{typeof threshold?.topTotal === "number" && selected.total >= threshold.topTotal ? <StatusTag tone="warn">一本上线</StatusTag> : typeof threshold?.undergraduateTotal === "number" && selected.total >= threshold.undergraduateTotal ? <StatusTag tone="good">本科上线</StatusTag> : <StatusTag tone="bad">重点关注</StatusTag>}</div></div>
        <div className="two-column">
          <Panel title="历次考试走势" subtitle="总分变化"><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="exam" /><YAxis domain={["dataMin - 20", "dataMax + 20"]} /><Tooltip /><Line type="monotone" dataKey="total" stroke="#176B87" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div></Panel>
          <Panel title="学科上线诊断" subtitle="个人分数与一本、本科有效分对照" action={<TierLegend />}><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={subjectData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" /><YAxis /><Tooltip cursor={{ fill: "rgba(23,107,135,.05)" }} /><Legend /><Bar dataKey="score" name="个人分数" fill="#176B87" radius={[6, 6, 2, 2]} animationDuration={700} /><Bar dataKey="topLine" name="一本有效分" fill={TIER_COLORS.top} radius={[6, 6, 2, 2]} animationDuration={950} /><Bar dataKey="undergraduateLine" name="本科有效分" fill={TIER_COLORS.undergraduate} radius={[6, 6, 2, 2]} animationDuration={1150} /></BarChart></ResponsiveContainer></div></Panel>
        </div>
        <Panel title="学科明细" subtitle="分别显示距离一本、本科有效分的差值"><div className="student-subject-grid">{subjectData.map((item) => { const topDiff = item.topLine ? item.score - item.topLine : null; const undergraduateDiff = item.undergraduateLine ? item.score - item.undergraduateLine : null; return <div key={item.subject}><span>{item.subject}</span><b>{format1(item.score)}</b><small className={topDiff !== null && topDiff < 0 ? "negative" : "positive"}>一本 {topDiff === null ? "未设置" : `${topDiff >= 0 ? "+" : ""}${format1(topDiff)}`}</small><small className={undergraduateDiff !== null && undergraduateDiff < 0 ? "negative" : "positive"}>本科 {undergraduateDiff === null ? "未设置" : `${undergraduateDiff >= 0 ? "+" : ""}${format1(undergraduateDiff)}`}</small></div>; })}</div></Panel>
      </div>
    </div>;
  };

  const renderOnline = () => <div className="two-column">
    <Panel title="上线结构与临界区间" subtitle="一本与本科临界生分别统计" action={<TierLegend />}><div className="online-summary"><div className="tier-top"><span>特控/一本上线</span><b>{topCount}</b><small>{percent(activeScores.length ? topCount / activeScores.length : 0)}</small></div><div className="tier-undergraduate"><span>本科上线</span><b>{undergraduateCount}</b><small>{percent(activeScores.length ? undergraduateCount / activeScores.length : 0)}</small></div><div className="tier-top"><span>一本线下10分</span><b>{topCritical.filter((row) => (row.topDiff ?? -999) >= -10).length}</b><small>优先冲一本</small></div><div className="tier-top"><span>一本线下20分</span><b>{topCritical.length}</b><small>一本临界</small></div><div className="tier-undergraduate"><span>本科线下10分</span><b>{undergraduateCritical.filter((row) => (row.undergraduateDiff ?? -999) >= -10).length}</b><small>优先保本科</small></div><div className="tier-undergraduate"><span>本科线下20分</span><b>{undergraduateCritical.length}</b><small>本科临界</small></div></div></Panel>
    <Panel title="班级上线完成情况" subtitle="双轨进度条：橙色一本，绿色本科" action={<TierLegend />}><div className="class-online-list">{currentClassSummaries.map((item) => <div key={item.classNo}><b>{item.classNo}班</b><span>{item.type}</span><div className="dual-progress"><i className="top" style={{ width: `${item.topRate * 100}%` }} /><i className="undergraduate" style={{ width: `${item.undergraduateRate * 100}%` }} /></div><strong><em>一本 {item.topCount}人 · {percent(item.topRate)}</em><em>本科 {item.undergraduateCount}人 · {percent(item.undergraduateRate)}</em></strong></div>)}</div></Panel>
    <Panel title="临界生与薄弱学科" subtitle="一本/本科分开标识，点击学生进入个人画像" className="span-2"><div className="data-table"><table><thead><tr><th>临界类型</th><th>班级</th><th>姓名</th><th>总分</th><th>一本差</th><th>本科差</th><th>薄弱学科</th><th>建议</th></tr></thead><tbody>{critical.map((item) => <tr key={`${item.classNo}-${item.name}`} onClick={() => { setSelectedStudent(item); setView("students"); }}><td>{item.criticalTiers.map((tier) => <StatusTag key={tier} tone={tier === "一本" ? "warn" : "good"}>{tier}</StatusTag>)}</td><td>{item.classNo}班</td><td className="student-link">{item.name}</td><td>{format1(item.total)}</td><td className={(item.topDiff ?? 0) < 0 ? "negative" : "positive"}>{item.topDiff === null ? "—" : format1(item.topDiff)}</td><td className={(item.undergraduateDiff ?? 0) < 0 ? "negative" : "positive"}>{item.undergraduateDiff === null ? "—" : format1(item.undergraduateDiff)}</td><td>{item.weakSubjects.slice(0, 3).map((weak) => `${weak.subject}${format1(weak.diff)}`).join("、") || "—"}</td><td><StatusTag tone="warn">重点跟踪</StatusTag></td></tr>)}</tbody></table></div></Panel>
  </div>;

  const renderItems = () => {
    const lowItems = [...itemStats].sort((a, b) => a.rate - b.rate);
    const chartData = itemStats.map((item) => ({ name: item.question, 得分率: Number((item.rate * 100).toFixed(1)) }));
    const emptyItemText = classNo === 7 && activeSubject === "日语"
      ? "源表的英语小题表未包含7班日语答题记录，系统不会将缺失数据按0分计算"
      : "这次考试尚未识别到该学科的小题数据";
    return <div className="two-column">
      <Panel title="小题分析条件" subtitle="选择学科和班级后自动重算"><div className="subject-pills">{subjects.map((item) => <button className={activeSubject === item.subject ? "active" : ""} onClick={() => setSubject(item.subject)} key={item.subject}>{item.subject}</button>)}</div><div className="item-summary"><div><span>识别题目</span><b>{questionBank.length}</b></div><div><span>答题记录</span><b>{itemRows.length}</b></div><div><span>平均得分率</span><b>{itemStats.length ? percent(average(itemStats.map((item) => item.rate))) : "—"}</b></div></div></Panel>
      <Panel title="薄弱知识点" subtitle="按小题得分率从低到高"><div className="weak-list">{lowItems.slice(0, 6).map((item, index) => <div key={`${item.question}-${index}`}><span className="rank">{index + 1}</span><div><b>{item.knowledge}</b><small>{item.question} · 均分{format1(item.average)}/{item.maxScore ?? "—"}</small></div><strong>{percent(item.rate)}</strong></div>)}</div></Panel>
      <Panel title={`${activeSubject}小题得分率`} subtitle="低于60%的题目以橙色提示" className="span-2">{chartData.length ? <div className="chart-box tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={58} /><YAxis unit="%" domain={[0, 100]} /><Tooltip cursor={{ fill: "rgba(23,107,135,.05)" }} /><Bar dataKey="得分率" radius={[6, 6, 2, 2]} animationDuration={1000}>{chartData.map((item, index) => <Cell key={index} fill={item.得分率 < 60 ? "#F97316" : item.得分率 >= 80 ? "#10B981" : "#3AA6B9"} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState text={emptyItemText} />}</Panel>
      <Panel title="小题明细" subtitle="分值、知识点、平均得分和得分率" className="span-2"><div className="data-table"><table><thead><tr><th>题号</th><th>知识点</th><th>满分</th><th>平均分</th><th>得分率</th><th>诊断</th></tr></thead><tbody>{itemStats.map((item) => <tr key={item.question}><td>{item.question}</td><td>{item.knowledge}</td><td>{item.maxScore ?? "—"}</td><td>{format1(item.average)}</td><td>{percent(item.rate)}</td><td><StatusTag tone={item.rate >= .75 ? "good" : item.rate >= .6 ? "neutral" : "warn"}>{item.rate >= .75 ? "掌握较好" : item.rate >= .6 ? "基本掌握" : "重点补弱"}</StatusTag></td></tr>)}</tbody></table></div></Panel>
    </div>;
  };

  const renderHistory = () => <div className="two-column">
    <Panel title="历次考试年级趋势" subtitle="平均分与上线人数变化" action={<TierLegend />} className="span-2"><div className="chart-box tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={historyData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="exam" /><YAxis yAxisId="score" domain={["dataMin - 20", "dataMax + 20"]} /><YAxis yAxisId="count" orientation="right" /><Tooltip /><Legend /><Line yAxisId="score" type="monotone" dataKey="average" name="平均分" stroke="#176B87" strokeWidth={3} animationDuration={700} /><Line yAxisId="count" type="monotone" dataKey="top" name="一本上线" stroke={TIER_COLORS.top} strokeWidth={3} animationDuration={950} /><Line yAxisId="count" type="monotone" dataKey="undergraduate" name="本科上线" stroke={TIER_COLORS.undergraduate} strokeWidth={3} animationDuration={1150} /></LineChart></ResponsiveContainer></div></Panel>
    <Panel title="考试节点对比" subtitle="当前筛选范围"><div className="history-cards">{historyData.map((item, index) => <div key={item.exam}><span>{item.exam}</span><b>{format1(item.average)}</b><small>平均分</small><em className={index > 0 && item.average >= historyData[index - 1].average ? "positive" : "negative"}>{index === 0 ? "基准" : `${item.average >= historyData[index - 1].average ? "+" : ""}${format1(item.average - historyData[index - 1].average)}`}</em></div>)}</div></Panel>
    <Panel title="增值观察" subtitle="平均分与一本/本科上线转化"><div className="insight-list"><div><CheckCircle2 /><p><b>平均分变化</b><span>{historyData.length > 1 ? `较${historyData[historyData.length - 2].exam}${historyData.at(-1)!.average >= historyData[historyData.length - 2].average ? "提高" : "下降"}${format1(Math.abs(historyData.at(-1)!.average - historyData[historyData.length - 2].average))}分` : "暂无对比考试"}</span></p></div><div><Medal /><p><b>一本上线变化</b><span>{historyData.length > 1 ? `较上次${historyData.at(-1)!.top - historyData[historyData.length - 2].top >= 0 ? "增加" : "减少"}${Math.abs(historyData.at(-1)!.top - historyData[historyData.length - 2].top)}人` : "暂无对比考试"}</span></p></div><div><Target /><p><b>本科上线变化</b><span>{historyData.length > 1 ? `较上次${historyData.at(-1)!.undergraduate - historyData[historyData.length - 2].undergraduate >= 0 ? "增加" : "减少"}${Math.abs(historyData.at(-1)!.undergraduate - historyData[historyData.length - 2].undergraduate)}人` : "暂无对比考试"}</span></p></div><div><AlertTriangle /><p><b>使用建议</b><span>切换班级后，可查看单班历次考试变化。</span></p></div></div></Panel>
  </div>;

  const renderReports = () => <div className="report-layout">
    <Panel title="报告模板" subtitle="当前筛选条件将自动带入报告"><div className="report-types">{REPORT_TYPES.map((name) => <button className={reportType === name ? "active" : ""} key={name} onClick={() => setReportType(name)}><FileText size={19} /><span>{name}</span><small>已可生成</small></button>)}</div><div className="export-actions"><button className="primary-button" onClick={exportWord} disabled={exporting !== null}>{exporting === "word" ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}{exporting === "word" ? "正在生成" : "导出Word"}</button><button className="secondary-button" onClick={exportPdf} disabled={exporting !== null}>{exporting === "pdf" ? <LoaderCircle className="spin" size={17} /> : <Printer size={17} />}{exporting === "pdf" ? "正在生成" : "导出PDF"}</button></div><p className="export-note">点击后直接下载Word或PDF文件；报告包含一本/本科上线、双口径临界生和学科有效上线分析。</p></Panel>
    <div className="report-preview"><div className="preview-label">报告预览</div><ReportBody dataset={dataset} exam={exam} track={track} classNo={classNo} reportType={reportType} /></div>
  </div>;

  const renderSettings = () => <div className="two-column">
    <Panel title="班型与选科规则" subtitle="已按本届1—16班情况预置" className="span-2"><div className="data-table"><table><thead><tr><th>班级</th><th>类别</th><th>选科组合</th><th>班型</th><th>外语口径</th><th>源表自动转换</th><th>比较建议</th></tr></thead><tbody>{Object.values(CLASS_PROFILES).map((item) => <tr key={item.classNo}><td>{item.classNo}班</td><td>{item.track}</td><td>{item.combination}</td><td>{item.type}</td><td>{item.classNo === 7 ? "日语" : "英语"}</td><td>{item.classNo === 7 ? "英语列 → 日语" : item.classNo === 9 ? "生物列 → 地理" : "按原列"}</td><td>{[1, 2, 10].includes(item.classNo) ? "班型内+全年级双口径" : [15, 16].includes(item.classNo) ? "专项口径" : "同类别平行班"}</td></tr>)}</tbody></table></div></Panel>
    <Panel title="当前数据健康度" subtitle="缺失数据按模块降级，不会拖垮整个系统" action={<StatusTag tone={dataQualityScore >= 95 ? "good" : dataQualityScore >= 80 ? "warn" : "bad"}>{dataQualityScore}分</StatusTag>}><div className="quality-detail"><div><span>学科字段完整度</span><b>{percent(subjectCompleteness)}</b><i><em style={{ width: `${subjectCompleteness * 100}%` }} /></i></div><div><span>一本/本科线完整度</span><b>{percent(thresholdCompleteness)}</b><i><em style={{ width: `${thresholdCompleteness * 100}%` }} /></i></div><div><span>当前有效成绩</span><b>{activeScores.length.toLocaleString()}条</b><small>缺失单科显示“—”，不计入均分分母</small></div><div><span>数据提醒</span><b>{warningCount}项</b><small>错误阻止覆盖旧数据，警告仅关闭受影响模块</small></div></div></Panel>
    <Panel title="当前考试分数线" subtitle={`${exam} · 分类别设置`}><div className="threshold-cards">{(["物理类", "历史类"] as Track[]).map((item) => { const line = getThreshold(dataset, exam, item); return <div key={item}><b>{item}</b><span>特控/一本线<strong>{line?.topTotal ?? "未设置"}</strong></span><span>本科线<strong>{line?.undergraduateTotal ?? "未设置"}</strong></span></div>; })}</div></Panel>
    <Panel title="导入质量检查" subtitle="问题按严重程度列出，其他可用模块继续工作" className="span-2"><div className="issue-list">{datasetIssues.length ? datasetIssues.map((issue, index) => <div key={index} className={issue.level}><span>{issue.level === "error" ? <X size={16} /> : issue.level === "warning" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}</span><p>{issue.message}</p></div>) : <div className="success-state"><CheckCircle2 />未发现明显数据问题</div>}</div></Panel>
  </div>;

  const renderView = () => {
    switch (view) {
      case "dashboard": return renderDashboard();
      case "grade": return renderGrade();
      case "classes": return renderClasses();
      case "subjects": return renderSubjects();
      case "students": return renderStudents();
      case "online": return renderOnline();
      case "items": return renderItems();
      case "history": return renderHistory();
      case "reports": return renderReports();
      case "settings": return renderSettings();
    }
  };

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><div className="brand-mark"><School /></div><div><strong>质量慧析</strong><span>高2024级成绩分析系统</span></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X /></button></div>
        <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); setMenuOpen(false); }}><Icon size={18} /><span>{label}</span>{id === "online" && critical.length > 0 && <em>{critical.length}</em>}</button>)}</nav>
        <div className="sidebar-footer"><FileSpreadsheet size={18} /><div><span>当前数据源</span><b title={dataset.sourceName}>{dataset.sourceName}</b></div></div>
      </aside>
      {menuOpen && <button className="overlay" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} />}
      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="打开菜单"><Menu /></button>
          <div className="filters">
            <label><span>考试</span><div><select value={exam} onChange={(event) => setExam(event.target.value)}>{dataset.exams.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></div></label>
            <label><span>类别</span><div><select value={track} onChange={(event) => { setTrack(event.target.value as Track | "全部"); setClassNo("全部"); }}><option>全部</option><option>物理类</option><option>历史类</option></select><ChevronDown size={15} /></div></label>
            <label><span>班级</span><div><select value={classNo} onChange={(event) => setClassNo(event.target.value === "全部" ? "全部" : Number(event.target.value))}><option>全部</option>{classOptions.map((item) => <option value={item} key={item}>{item}班</option>)}</select><ChevronDown size={15} /></div></label>
          </div>
          <div className="topbar-actions"><div className="data-badge"><span className={dataset.id === "demo" ? "demo" : "live"} />{dataset.id === "demo" ? "示例数据" : `${dataset.school} · 已保存`}</div><button className="quick-export" onClick={exportWord} disabled={exporting !== null} title="导出当前筛选范围的Word报告"><FileText size={16} />Word</button><button className="quick-export" onClick={exportPdf} disabled={exporting !== null} title="导出当前筛选范围的PDF报告"><Printer size={16} />PDF</button><button className="import-button" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}{importing ? "正在解析" : "导入Excel"}</button></div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={(event) => handleImport(event.target.files?.[0])} />
        </header>
        {importMessage && <div className={`import-message ${importMessage.includes("失败") || importMessage.includes("没有找到") || importMessage.includes("无法") ? "error" : importMessage.includes("提醒") || importMessage.includes("未能保存") ? "warning" : "success"}`}><span>{importMessage}</span><button onClick={() => setImportMessage(null)}><X size={15} /></button></div>}
        <div className="content"><div className="view-stage" key={`${view}-${exam}-${track}-${classNo}`}>{renderView()}</div></div>
        <div className="export-report-host" aria-hidden="true"><ReportBody dataset={dataset} exam={exam} track={track} classNo={classNo} reportType={reportType} reportId="export-report-content" /></div>
        <footer className="app-footer"><span>数据仅保存在本机浏览器中 · 缺失字段自动降级处理</span><span>导入于 {cnDate(dataset.importedAt)}</span></footer>
      </main>
    </div>
  );
}
