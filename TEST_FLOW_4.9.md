# Test Flow 4.9 — Pełny Gameplay PvP i AI

## ✅ Precondition
- Strona logowania widoczna na `http://localhost:8080`
- Backend/Frontend/Nginx/Redis są `Up`
- Mock user ustawiony (jeśli potrzebny do quick test)

---

## 📋 TEST 1: AI Game Flow

### KROK 1.1 — Wejście do lobby
**Kliknij:** Żaden przycisk — powinieneś być już na GameBoard (lobby section)

**Sprawdź:**
- Widzisz nagłówek "Battleship — Game Board"
- Sekcja "Choose Game Mode" z dwoma przyciskami: "Play vs AI" i "Challenge Friend"
- Status message: "Place your ships on your board."

---

### KROK 1.2 — Tworzenie gry AI
**Kliknij:** Przycisk "Play vs AI" (zielony)

**Sprawdź:**
- Gra jest tworzona (może trwać 1-2 sekundy)
- Sekcja się zmienia na "Place Your Ships"
- Pojawiają się dwie plansze (po lewej — Twoja, po prawej — Przeciwnika)
- Po lewej widać interfejs do rozmieszczania statków (wybór rozmiaru, orientacji)
- Status message: np. "Statku o rozmiarze X umieścił"

---

### KROK 1.3 — Rozmieszczanie statków
**Plan:** Rozmieścić wszystkie statki (4+3+3+2+2+2+1+1+1+1 = 20 pól)

**Kliknij:** 
1. Wybierz rozmiar statku z dropdown (np. "Battleship (4)")
2. Ustaw orientację: "Horizontal" lub "Vertical"
3. Kliknij na pole na **Twojej planszy** (po lewej) — np. górny lewy róg (1,1)
4. Powtarzaj dla każdego statku

**Sprawdź po każdym statku:**
- Statek pojawia się na Twojej planszy (zielone pola)
- Status message aktualizuje się: np. "Battleship placed at (1, 1)."
- Licznik statków idzie w górę

**Po rozmieszczeniu wszystkich:**
- Status message: "All ships placed. Ready to start!"
- Przycisk "Start Game" się pojawia/włącza

---

### KROK 1.4 — Start gry i poczekalnia
**Kliknij:** Przycisk "Start Game" (lub "Ready")

**Sprawdź:**
- Sekcja zmienia się na "Waiting..."
- Widzisz spinner (ikona ładowania)
- Status message: "AI opponent ready. Starting game..." lub "Waiting for opponent to place ships..."
- Dla AI: powinno przejść do fazy "playing" prawie natychmiast
- Dla PvP: czekać aż drugi gracz rozstawi statki

---

### KROK 1.5 — Rozgrywka (Playing phase)
**Sprawdź UI:**
- Sekcja "Game Info" pojawia się z 3 kolumnami:
  - Game Status: "Active"
  - Current Turn: "Your Turn" (zielony kolor) lub "Opponent's Turn" (żółty)
  - Game Type: "vs AI"
- Obie plansze są widoczne
- **Po lewej (Twoja plansza):** zielone statki, brak możliwości klikania
- **Po prawej (Plansza AI):** ciemne pola, możliwość klikania (jeśli Twoja tura)

---

### KROK 1.6 — Oddaj strzały
**Kliknij:** Kliknij na losowe pola planszy AI (po prawej)

**Sprawdź po każdym strzale:**
- Pole zmienia kolor na **czerwony (HIT)** lub **szary (MISS)**
- Status message aktualizuje się:
  - Hit: `🎯 HIT at row X, col Y!`
  - Miss: `❌ MISS at row X, col Y.`
  - Hit & Sunk: `🎯 HIT AND SUNK at row X, col Y! Great shot!`
- Przełączenie tury: "Your turn" → "Opponent's turn" → "Your turn"
- Status message zmienia się na `⚔️ OPPONENT ATTACKS at row X, col Y!` (gdy AI strzela do Ciebie)

---

### KROK 1.7 — Koniec gry
**Czynność:** Kontynuuj oddawanie strzałów aż osiągniesz 20 trafień (wszystkie statki AI zatopione)

**Sprawdź:**
- Sekcja zmienia się na "Game Over"
- Status message: 
  - Jeśli wygrałeś: `You win! All enemy ships were sunk.`
  - Jeśli przegrałeś: `You lost. All your ships were sunk.`
- Pojawia się przycisk "Play Again"
- Brak możliwości klikania na plansze

---

### KROK 1.8 — Restart
**Kliknij:** Przycisk "Play Again"

**Sprawdź:**
- Powrót do lobby (sekcja "Choose Game Mode")
- Plansze resetują się

✅ **TEST 1 ZAKOŃCZONY: AI Game Flow**

---

## 📋 TEST 2: PvP Game Flow (Wymagane 2 przeglądarki/okna)

### SETUP
1. Otwórz **Okno A** (normalne): `http://localhost:8080` — Gracz 1
2. Otwórz **Okno B** (Incognito/nowy profil): `http://localhost:8080` — Gracz 2

---

### KROK 2.1 — Gracz 1 tworzy grę PvP
**Okno A — Kliknij:** "Challenge Friend"

**Sprawdź:**
- Pojawia się interfejs do rozmieszczania statków
- ID gry jest dostępne (u góry lub w komunikacie)
- Status: "Waiting for opponent to place ships..."

---

### KROK 2.2 — Gracz 2 dołącza do gry
**Okno B:**
- Jeśli system ma opcję "Join Game" — kliknij i wpisz ID gry z Okna A
- Lub: system powinien automatycznie pokazać oczekujące zaproszenia (jeśli masz to zaimplementowane)

**Sprawdź:**
- Gracz 2 widzi interfejs rozmieszczania statków
- Obie plansze są dostępne do rozmieszczenia

---

### KROK 2.3 — Obaj gracze rozmieszzczają statki
**Okno A:** Rozmieść statki (jak w KROKU 1.3)
**Okno B:** Rozmieść statki (jak w KROKU 1.3)

**Sprawdź:**
- Każdy gracz rozmieszcza niezależnie
- Brak błędów nakładających się statków
- Po rozmieszczeniu: przycisk "Start Game" włącza się

---

### KROK 2.4 — Obaj gracze klikają "Start Game"
**Okno A:** Kliknij "Start Game"
**Okno B:** Kliknij "Start Game"

**Sprawdź:**
- Oba okna przechodzą do fazy "waiting"
- Spinner + "Ships placed: ✓ (You) / ✓ (Opponent)"
- Po 1-2 sekundach: przejście do "playing"

---

### KROK 2.5 — Rozgrywka PvP
**Okno A (Gracz 1):**
1. Sprawdź: Current Turn = "Your Turn" (zielony)
2. Kliknij na pole planszy Gracza 2 (po prawej)

**Sprawdź:**
- Pole zmienia kolor
- Status message: `🎯 HIT...` lub `❌ MISS...`
- **Okno B (Gracz 2):**
  - Status message: `⚔️ OPPONENT ATTACKS at row X, col Y!`
  - Current Turn = "Your Turn" (zmienia się na zielony)

**Okno B (Gracz 2):**
1. Kliknij na pole planszy Gracza 1 (po prawej w Oknie B)

**Sprawdź:**
- Okno A widzi: `⚔️ OPPONENT ATTACKS...`
- Tur alternują się poprawnie

---

### KROK 2.6 — Koniec gry
**Czynność:** Kontynuuj naprzemienny gameplay aż jeden z graczy osiągnie 20 trafień

**Sprawdź:**
- Gracz który osiągnął 20 trafień widzi: `You win! All enemy ships were sunk.`
- Drugi gracz widzi: `You lost. All your ships were sunk.`
- Obie sekcje zmieniają się na "Game Over"
- Przycisk "Play Again" pojawia się u obu graczy

✅ **TEST 2 ZAKOŃCZONY: PvP Game Flow**

---

## 📋 TEST 3: Historia gry (Zapis w bazie)

### KROK 3.1 — Sprawdzenie historii (jeśli masz ekran historii)
**Po ukończeniu gry (AI lub PvP):**
- Wróć do menu / profilu
- Szukaj sekcji "Game History" lub "My Games"

**Sprawdź:**
- Gra pojawia się na liście
- Wynik (wygrana/przegrana)
- Data i czas gry
- Typ gry (vs AI / vs Friend)
- Statystyki (strzały, trafienia)

---

## 📋 CHECKLIST — PODSUMOWANIE

| Punkt | Test | Wynik | Notatki |
|-------|------|-------|---------|
| 1.1 | Lobby widoczne | ✅ / ❌ | |
| 1.2 | Tworzenie gry AI | ✅ / ❌ | |
| 1.3 | Rozmieszczanie statków | ✅ / ❌ | |
| 1.4 | Faza waiting → playing | ✅ / ❌ | |
| 1.5 | UI gry (plansze, info) | ✅ / ❌ | |
| 1.6 | Strzały, zmiana tur, komunikaty | ✅ / ❌ | |
| 1.7 | Koniec gry (end phase) | ✅ / ❌ | |
| 1.8 | Play Again → Lobby | ✅ / ❌ | |
| 2.1–2.6 | PvP flow | ✅ / ❌ | |
| 3.1 | Historia gry w bazie | ✅ / ❌ | Opcjonalnie |

---

## 🔍 Znane problemy do sprawdzenia

- [ ] Czy zmiana tur działa synchronnie w PvP?
- [ ] Czy strzały do tego samego pola są blokowane?
- [ ] Czy liczniki trafień/strzałów są zliczane poprawnie?
- [ ] Czy `endGame` jest wywoływany przy 20 trafieniach?
- [ ] Czy gra prawidłowo się zapisuje w bazie?
