# 链接扫描基准

用于观察 `buildLinkGraph` 在较大 Markdown 知识库上的时间和内存量级，不作为跨机器性能承诺。

## 结果

测试日期：2026-08-24

环境：Apple M5、16 GB 内存、arm64、macOS 26.6、Node.js 24.15.0。

| 笔记数 | 内部链接 | 扫描耗时 | 峰值 RSS | 扫描 RSS 增量 |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 1,000 | 58.0 ms | 103.7 MB | 17.6 MB |
| 10,000 | 10,000 | 1,377.6 ms | 163.5 MB | 88.9 MB |

每篇合成笔记包含标题、二级标题、块 ID 和一条内部链接；四分之一使用 Obsidian WikiLink，其余使用标准 Markdown 链接。扫描结果必须满足零断链和零缺失引用才计入结果。

## 复现

```bash
npm install
npm run benchmark:links
```

脚本分别启动独立进程，在系统临时目录生成 1K 和 10K 测试库，完成后立即删除。输出字段：

- `elapsedMs`：仅构建链接图的墙钟时间，不含生成测试库。
- `peakRssMb`：该 Node.js 进程的峰值常驻内存。
- `rssDeltaMb`：扫描结束 RSS 减去扫描开始 RSS。

结果会随硬件、Node.js 版本、文件系统缓存、平均笔记长度、目录深度和 WikiLink 比例变化。
