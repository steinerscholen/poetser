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

## Tips

### Unieke oudernamen

Gebruik bij voorkeur een unieke naam per gezin — idealiter een combinatie van de familienamen van beide ouders. Zo vermijd je verwarring wanneer kinderen in hetzelfde gezin een verschillende familienaam dragen.

Een bekend voorbeeld zijn Scandinavische patroniemen: broer *Jacobsons* en zus *Jacobsone* zijn kinderen van dezelfde ouders. Als je hen apart invoert, lijken het twee aparte gezinnen. Door de oudernaam te combineren — bv. **Jacobsons-Jacobsone** of **Familie Jacobsons** — worden ze als één gezin herkend en krijgen ze het juiste gewicht in de verdeling.

De naam die je hier gebruikt hoeft niet overeen te komen met een officiële of juridische naam; het is puur een administratief label binnen Poetser.

## Organisatie

Dit project maakt deel uit van de [steinerscholen](https://github.com/steinerscholen) GitHub-organisatie.
