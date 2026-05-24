# 🧹 Poetser

Eerlijke verdeling van weekendpoetsbeurten voor ouders van school.

## Wat doet het?

Aan het begin van het schooljaar ontvangt elke ouder een overzicht van de weekends waarop ze de klas van hun kind poetsen. Poetser genereert dat rooster automatisch op basis van een leerlingenlijst, met twee verdeelmethoden en aandacht voor gezinnen met meerdere kinderen op school.

## Functies

- **Import** van leerlingenlijst via `.xlsx`, `.xls` of `.csv` — kolomtoewijzing via drag-and-drop interface
- **Klassenbeheer** met automatische sortering (Peuter → Kleuter → Lager → Middelbaar) en handmatige volgorde via pijltjes
- **Ouders & kinderen** — gewicht per gezin wordt live berekend
- **Kalender** — schooljaar, vakanties, beschikbare poetsdag(en) per weekend (vr/za/zo), verplichte dagen
- **Twee verdeelmethoden** (naast elkaar te vergelijken):
  - *Methode 1 — inverse gewicht*: meer kinderen op school = minder beurten
  - *Methode 2 — per leerling gelijk*: elk gezin komt even vaak poetsen; een 3-kindgezin poetst 3 klassen per bezoek
- **Compactie**: gezinnen met kinderen in meerdere klassen krijgen hun beurten zoveel mogelijk op hetzelfde weekend
- **Rooster** als afdrukbaar grid: rijen = weekends, kolommen = klassen, cel = naam kind + ouder + dag
- **Statistieken** per ouder: doel, werkelijk aantal, afwijking

## Technisch

- React 18 + TypeScript + Vite
- Tailwind CSS v3
- Volledig offline — alle data blijft lokaal in de browser (`localStorage`)
- Geen backend, geen accounts

## Aan de slag

```bash
npm install
npm run dev
```

Open `http://localhost:5173` en begin met importeren via het **📥 Importeren** tabblad.

Een testbestand met 231 fictieve leerlingen (11 klassen, realistische gezinsdemografie) staat in `public/leerlingenlijst-dummy.xlsx`.

## Organisatie

Dit project maakt deel uit van de [steinerscholen](https://github.com/steinerscholen) GitHub-organisatie.
