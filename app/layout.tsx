import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yusheng266186-beep.github.io/zhiliang-huixi/"),
  title: "质量慧析｜高中考试质量分析系统",
  description: "导入考试Excel，查看年级、班级、学科、学生、上线与小题分析并生成报告。",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "质量慧析｜高中考试质量分析系统",
    description: "把复杂成绩转化为清晰决策。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1733, height: 909, alt: "质量慧析数据分析系统" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "质量慧析｜高中考试质量分析系统",
    description: "把复杂成绩转化为清晰决策。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
