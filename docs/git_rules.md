# GitHub Workflow Rules – Transcendence

## 📋 Table of Contents

- [Branching](#branching)
- [Workflow](#workflow)
- [Pull Request](#pull-request)
- [Commits](#commits)

---

## Branching

### Branch Structure

- **`main`** – stable code only (no direct commits)
- **`develop`** – team's working branch
- **`type/*`** – each feature separately
  - Example: `feature/auth-login`

---

## Workflow

1. **Start from `develop`**
2. **Create `feature/*`**
3. **Small, logical commits**
4. **Pull Request → `develop`**
5. **Review → merge**

### ⚠️ Important Notes

> **Note 1:** Do not merge `feature/*` directly into `main`!

> **Note 2:** Before merging `feature/*` into `develop`, rebase onto
> `develop` to avoid conflicts.

> **Note 3:** Regularly update your `feature/*` from `develop` to stay
> up to date.

> **Note 4:** Use descriptive branch and commit names to make changes
> easier to understand.

---

## Pull Request

### Rules

- **One feature = one PR**
- **2 approvals required:**
  - Tech Lead
  - 1 other team member
- **PR must have a description**

### 📘 Additional Resources

- [Code Review - Rules and Best Practices](https://www.notion.so/zasady-code-review-good-practices-2d074a5f4559809cafa7f5e8cfb4581a)

---

## Commits

### Format

```bash
git commit -m "type" -m "short description"
```

### Commit Types

| Type        | Description        |
|-------------|--------------------|
| `feature:`  | New feature        |
| `fix:`      | Bug fix            |
| `refactor:` | Code cleanup       |
| `docs:`     | Documentation      |
| `test:`     | Tests              |
| `chore:`    | Configuration      |

### Examples

```bash
git commit -m "feature" -m "added user login"
git commit -m "fix" -m "fixed email validation bug"
```
