# PDF Fix — Replace pdfkit with pdf-lib

The 500 error was pdfkit failing on Vercel (font/serverless compatibility). Switching to pdf-lib which works reliably on Vercel.

## Steps (5 commands — same shape as before)

**1. Open VS Code terminal pointed at Guestos-ops:**
```
cd C:\Users\jjager\Desktop\Guestos-ops
```

**2. Uninstall the broken library and install the new one:**
```
npm uninstall pdfkit
npm install pdf-lib
```

**3. Drop in the fix:**
```
xcopy /E /I /Y C:\Users\jjager\Downloads\pdf-fix C:\Users\jjager\Desktop\Guestos-ops
```

**4. Push:**
```
git add app lib package.json package-lock.json
git commit -m "Switch SWPPP PDF from pdfkit to pdf-lib (Vercel compatibility)"
git push
```

**5. Wait 60-90s for Vercel to deploy, then click the report link again.** Should now download/display the PDF correctly.

## Files in this fix

- `lib/swpppPdf.js` (REPLACES — uses pdf-lib instead of pdfkit)
- `app/api/swppp/inspections/[id]/pdf/route.js` (REPLACES — better error logging)
- `app/api/swppp/reports/[id]/pdf/route.js` (REPLACES — better error logging)
