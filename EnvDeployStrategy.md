# Workflow & Deployment Strategy

This document describes the branching model and the process for contributing, reviewing, and promoting code within this project.

## 1. Branching Model

We use a hierarchical branching strategy to ensure that the code is tested before it reaches the end users.

| Branch | Environment | Description |
|--------|-------------|-------------|
| `main` | Production | Contains the current, fully tested, "live" version of the application. Only stable code from `develop` is merged here. |
| `develop` | User Acceptance Testing | The integration branch. This is where all developers merge their features to test how they work together. |
| `feature/*` | Development | Temporary branches created for specific tasks (e.g., `feature/login-page`). Used for isolated development. |

## 2. Step-by-Step Development Process

### Phase 1: Starting Your Work

Before starting a new feature, always ensure your local environment is synced with the latest integrated code.

**Update your local develop branch:**

```bash
git checkout develop
git pull origin develop
```

**Create a new feature branch:**

```bash
git checkout -b feature/your-feature-name
```

### Phase 2: Committing Changes

Work on your feature and commit changes frequently with descriptive messages.

**Stage and commit:**

```bash
git add .
git commit -m "Brief description of what you changed"
```

**Push to GitHub:**

```bash
git push origin feature/your-feature-name
```

### Phase 3: Promotion for testing (Integration)

Once your feature is complete and tested locally, it needs to be integrated with the rest of the team's work.

1. **Open a Pull Request (PR):** Go to GitHub and open a PR from `feature/your-feature-name` into `develop`.
2. **Code Review:** At least 2 team members must review and approve the code. One reviewer must always be `dmodrzej` (Tech Lead/Architect).
3. **Merge:** Once approved by both reviewers, merge the PR into `develop`. This triggers the develop environment update.

### Phase 4: Promotion to Main (Production)

When the `develop` branch is confirmed stable and the team is ready for a release:

1. **Open a Pull Request (PR):** Create a PR from `develop` into `main`.
2. **Final Verification:** Ensure all tests pass on the `develop` environment.
3. **Merge:** Merge the PR into `main`. The production environment is now updated.

## 3. Staying Up to Date

If your teammates have merged new code into `develop` while you are still working on your feature, you should pull those changes to avoid large conflicts later.

**Run these commands on your feature branch:**

```bash
git fetch origin
git merge origin/develop
```