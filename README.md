# 知期（Cycle Compass）

知期是一款以隐私、本地记录和温柔提醒为核心的经期与周期追踪应用。项目当前以 Vite、React 和 TypeScript 构建前端，通过 IndexedDB 在用户设备上保存数据，并使用 Capacitor 打包 Android 应用，同时支持 PWA 安装体验。

应用重点不只是“预测下一次经期”，也包括把每天的身体状态、心情、症状和备注沉淀成可回顾的个人节奏。所有统计和预测都基于用户本地记录生成，不依赖云端账号或远程数据库。

## 当前状态

- 应用名称：知期
- Android 包名：`com.zhio.app`
- Android 当前版本：`1.2.4`
- Web 技术形态：React SPA + PWA
- 移动端形态：Capacitor Android
- 默认开发端口：`8080`

## 核心功能

- 初次引导：设置最近一次经期开始日期、平均周期长度和平均经期长度，也可以直接导入已有数据。
- 首页概览：显示当前周期阶段、距离下次经期的预计天数、今日心情快捷记录、最近记录和备份提醒。
- 每日记录：支持记录经期开始/结束、流量、颜色、疼痛程度、症状、心情和 200 字以内备注。
- 日历视图：按月查看已记录经期、预测经期、卵泡期、排卵期和黄体期，支持月份滑动、年份/月选择、回到今天和日期详情。
- 趋势分析：展示平均周期、平均经期、记录周期数、规律性评分、周期/经期长度图表、预测方法和历史回测结果。
- 数据管理：支持 JSON 导出备份、JSON 文件导入、粘贴导入，以及把旧记录整理成可导入 JSON 的提示词。
- 界面配置：支持切换日历阶段显示样式，包括柔和背景样式和日期下方纹理线样式。
- 移动体验：底部导航、页面滑动切换、Android 返回键处理、未保存记录确认、PWA 自动更新。

## 技术栈

- 构建工具：Vite 5
- 前端框架：React 18、TypeScript
- 路由与状态：React Router、TanStack Query
- UI 与样式：Tailwind CSS、shadcn/ui、Radix UI、lucide-react、Sonner
- 本地数据：IndexedDB，封装库为 `idb`
- 日期与统计：date-fns、自定义周期模型和预测工具
- 移动端：Capacitor 8、Android Gradle 工程
- PWA：vite-plugin-pwa
- 代码质量：ESLint、TypeScript 配置

## 目录结构

```text
src/
  components/              主要页面、底部导航、记录图标和通用 UI 组件
  hooks/                   周期数据读取、保存、备份与恢复逻辑
  lib/                     IndexedDB、周期计算、预测、备份状态和中文 UI 文案
  main.tsx                 React 入口
  App.tsx                  路由、全局交互和页面编排

public/
  decor/                   应用装饰图、图标和界面图片资源
  pwa-*.png                PWA 图标资源

android/                   Capacitor Android 工程
capacitor.config.ts        Capacitor 应用配置
vite.config.ts             Vite、PWA 和版本注入配置
```

## 本地开发

请先安装 Node.js 和 npm。Android 构建还需要本机已配置 JDK 与 Android SDK。

```sh
npm install
npm run dev
```

开发服务器默认运行在：

```text
http://localhost:8080
```

常用命令：

```sh
npm run lint
npm run build
npm run preview
```

## Android 构建

Web 产物需要先构建并同步到 Capacitor 工程：

```sh
npm run build
npx cap sync android
```

随后可以在 Android 工程中构建 APK：

```sh
cd android
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

Release APK 会按当前版本名生成类似 `zhiqi-v1.2.4-release.apk` 的文件名。

## 数据与隐私

知期的数据默认保存在浏览器或 WebView 的 IndexedDB 中，数据库名为 `mycycle-db`。应用会尝试请求浏览器持久化存储权限，减少数据被系统自动清理的风险。

导出的备份是 JSON 文件，包含：

- `settings`：引导状态、平均周期、平均经期、提醒与界面偏好。
- `cycles`：每段经期的开始日期和结束日期。
- `dailyLogs`：每日流量、颜色、疼痛、症状、心情和备注。

导入数据时，应用会规范化周期记录，兼容部分旧格式记录，并重新计算平均周期、平均经期和最近经期开始日期。请妥善保存导出的 JSON 备份文件。

## 预测与健康提示

周期预测优先使用用户已记录的历史周期；记录不足时使用设置里的平均周期和平均经期。预测工具会过滤明显异常的周期长度，并对偏长周期降低权重，以减少单次异常记录对预测结果的影响。

趋势页中的规律性评分和 FIGO 参考范围用于健康教育和个人观察，不能替代医生诊断。如果持续出现异常出血、严重疼痛、周期长期明显异常或其他不适，建议咨询专业医生。

## 开发备注

- 应用内显示版本号来自 `android/app/build.gradle` 的 `versionName`，由 Vite 在构建时注入为 `__APP_VERSION__`。
- 日历阶段显示依赖 `src/lib/cycle-engine.ts` 和 `src/lib/cycle-utils.ts`。
- 预测方法与回测逻辑位于 `src/lib/prediction-utils.ts`。
- 数据导出、导入、迁移和 IndexedDB schema 位于 `src/lib/db.ts`。
- 当前仓库未声明开源许可证，如需复用代码或素材，请先确认授权。

## 仓库归属说明

该仓库最初由我的 @unlit2878账号 创建，但我的 @maibang账号 是日常开发和维护使用的主要账号。@maibang账号 已被添加为该仓库的 collaborator，并负责大部分提交和持续维护工作。两个账号都属于我本人。
