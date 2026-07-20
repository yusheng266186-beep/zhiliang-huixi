import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "质量慧析｜高中考试质量分析系统",
  description: "导入考试Excel，查看年级、班级、学科、学生、上线与小题分析并生成报告。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

