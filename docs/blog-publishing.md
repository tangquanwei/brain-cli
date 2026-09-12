# 从 Notes 发布到 Blog

在 WebUI 的 **Notes** 中打开文章，点击 **发布到 Blog**。文章会写入 Hexo 的 `source/_posts/`，本地附件会复制到 `source/brain-assets/`。页面显示写入位置、附件数量和内部引用处理结果。

在 **设置 → Hexo Blog 目录（BLOG_DIR）** 中选择现有 Blog 目录。默认 `blog`，相对 Brain 工作区解析，也可填写绝对路径。目标目录需要已有 `_config.yml` 和 `source/_posts/`；自定义 Hexo `source_dir` 暂不支持。

```dotenv
BLOG_DIR=blog
```

- 保留标题、日期、标签、分类和正文；其他 Notes frontmatter 不导出。没有日期时使用笔记修改时间，后续发布保持该日期。
- 同一 vault 中同一路径的笔记使用稳定的文章文件名和 `brain/<标识>/` permalink。修改 Notes 后再点击即可更新；移动或重命名 Notes 会生成新的文章。
- 支持正文中的内联 Markdown 图片/附件链接和带路径的 WikiLink 附件。远程 URL 保留；本地路径必须在 Notes 内且不能经过符号链接。附件按内容寻址，旧附件不会自动删除。
- 内部 Markdown 笔记链接和 WikiLink 笔记引用转为可读文字，结果中提示数量；不会连带发布被引用笔记。引用式图片、HTML 图片和 frontmatter 封面不在附件转换范围，发布前请改成正文内联 Markdown 链接。
- Blog 文章被手动改动后，发布会报错并保留该副本。将改动合回 Notes，再将 Blog 副本移走或另存后重试。
- Notes 原文不变；此操作不执行 Git 提交、推送、Hexo 构建或线上部署。成功消息会明确显示“尚未部署上线”，后续沿用 Blog 原有发布流程。

开发入口：`web-ui/views/Notes.tsx` → `web-ui/api.ts` → `POST /api/publish` → `src/web/blogData.ts`。边界与更新行为见 `tests/blogData.test.ts`。
