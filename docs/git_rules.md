# Zasady pracy na GitHubie – Transcendence

## 📋 Spis treści

- [Branching](#branching)
- [Workflow](#workflow)
- [Pull Request](#pull-request)
- [Commity](#commity)

---

## Branching

### Struktura branchy

- **`main`** – tylko stabilny kod (brak commitów bezpośrednich)
- **`develop`** – branch roboczy zespołu
- **`typ/*`** – każda funkcjonalność osobno  
  - Przykład: `typ/auth-login`

---

## Workflow

1. **Start z `develop`**
2. **Tworzysz `feature/*`**
3. **Małe, logiczne commity**
4. **Pull Request → `develop`**
5. **Review → merge**

### ⚠️ Ważne uwagi

> **Uwaga 1:** Nie mergujemy `feature/*` do `main` bezpośrednio!

> **Uwaga 2:** Przed mergem `feature/*` do `develop` zrób rebase na `develop`, aby uniknąć konfliktów.

> **Uwaga 3:** Regularnie aktualizuj swój `feature/*` z `develop`, aby być na bieżąco.

> **Uwaga 4:** Używaj opisowych nazw branchy i commitów, aby ułatwić zrozumienie zmian.

---

## Pull Request

### Zasady

- **Jedna funkcjonalność = jeden PR**
- **Wymagane 2 approve:**
  - Tech Lead
  - 1 dowolny członek zespołu
- **PR musi mieć opis**

### 📘 Dodatkowe zasoby

- [Code Review - zasady i dobre praktyki](https://www.notion.so/zasady-code-review-good-practices-2d074a5f4559809cafa7f5e8cfb4581a)

---

## Commity

### Format

```bash
git commit -m "typ" -m "krótki opis"
```

### Typy commitów

| Typ | Opis |
|-----|------|
| `feature:` | Nowa funkcja |
| `fix:` | Poprawka błędu |
| `refactor:` | Porządki w kodzie |
| `docs:` | Dokumentacja |
| `test:` | Testy |
| `chore:` | Konfiguracja |

### Przykłady

```bash
git commit -m "feature" -m "dodano logowanie użytkownika"
git commit -m "fix" -m "naprawiono błąd walidacji emaila"