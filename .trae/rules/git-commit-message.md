---
alwaysApply: true
scene: git_message
---

# Git Commit Message 规范

本项目采用 **Conventional Commits** 规范，确保提交历史清晰、可自动化生成 Changelog。

## 格式

```plain
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

- **type**：必填，表示提交类型。
- **scope**：可选，表示影响范围，用英文括号包裹。
- **description**：必填，简短描述变更内容，使用英文或中文均可，建议首字母小写，结尾不加句号。
- **body**：可选，详细描述变更原因、上下文等。
- **footer**：可选，关联 Issue（如 `Closes #123`）或标注破坏性变更（`BREAKING CHANGE:`）。
```plain

## 注意事项

1. **语言**：description、body 使用中文，技术细节可夹杂英文名词。