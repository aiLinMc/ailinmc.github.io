本次「作业历史」目录整理记录（2026-06 修复）
================================================

1) 被移出网站目录的文件（全部备份在 .audit\backup\，确认无误后可连同 .audit 一起删除）
   history\七下\第十一周\生物\homework.pdf   —— 该周多出的第二个 PDF（整目录备份为 backup\history\七下\第十一周\生物\）
   history\九上\第十周\homework.docx          —— 与 PDF/PNG 无关的 Word 文件
   history\八上\第十九周\a7r39-uy2db-001.png  —— 第 1 页单页图（已并入长图）
   history\八上\第十九周\a7r39-uy2db-002.png  —— 第 2 页单页图（已并入长图）
   history\八上\第十九周\homework.jpg         —— 旧的 2 页长图（JPEG，已用 PDF 重新导出为 PNG）

2) 重命名
   history\九下\第五周\gomework.pdf -> homework.pdf
   history\九下\第五周\gomework.png -> homework.png

3) 重新生成/补全的图片（均由对应 homework.pdf 导出，PNG）
   八上\第八周\homework.png    补全，1 页 @300dpi  2481x3508
   八下\第二周\homework.png    补全，1 页 @300dpi  2481x3508
   八下\第十八周\homework.png  补全，1 页 @300dpi  2481x3508
   八下\第八周\homework.png    替换，2 页长图 @150dpi  1241x3508
   八上\第十九周\homework.png  替换，2 页长图 @150dpi  1241x3508

4) 删除的空目录
   history\九上\第二十一周   （网站已同步去掉该入口）
   history\八上\第五周       （本来就没有作业素材，网站也未收录）

5) 网站入口调整 history_junior.html
   九上 weeks: range(1,21) -> range(1,20)   去掉不存在的第二十一周
   七上 weeks: range(2,19) -> range(2,20)   补上已有素材的第二十周

回滚办法：把 .audit\backup\ 下的文件按原相对路径拷回即可。

================================================
第二轮：作业历史全面改为「只有图片」
================================================

1) 七年级补图（七上 19 周、七下 20 周，共 39 张 homework.png）
   - 单页 PDF -> 300dpi，2481x3508
   - 多页 PDF -> 150dpi 长图，1241x3508（七上第二周/第四周、七下第十一周/第二十周）
   与八九年级原有规范一致。

2) 删除所有 PDF
   - history\ 下 112 个 homework.pdf 全部删除
   - latest\homework.pdf 删除
   注意：这些 PDF 原本都在 git 跟踪中，可用 `git checkout -- history latest` 恢复。

3) 页面改动
   - history_junior.html：卡片只保留「PNG 图片」按钮；去掉 hasPng 字段；
     移除 history_junior_pdf-download.js 引用
   - homework_junior.html：最新作业区去掉「下载PDF」按钮（标题改为「查看作业」）；
     移除 homework_junior_pdf-download.js 引用
   - 删除 javascript\homework\history_junior_pdf-download.js
   - 删除 javascript\homework\homework_junior_pdf-download.js

   遗留：css\homework\history_junior.css 里 .download-link.pdf 的样式已无元素使用，
   保留不影响显示，需要的话可以删掉。

================================================
第三轮：补录九下第十七、十八周
================================================
   - 九下\第十七周：PDF 4 页 -> 150dpi 长图 1241x7016（4.90 MB）
   - 九下\第十八周：PDF 1 页 -> 300dpi 图片 2481x3508（0.56 MB）
   - 两个源 PDF 已备份到 .audit\backup\history\九下\ 并移出网站目录
   - history_junior.html 九下 weeks 增加 17、18，卡片总数 112 -> 114


