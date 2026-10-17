from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

OUT = "output/pdf/finvoice-current-capabilities-demo-brief.pdf"

INK = colors.HexColor("#14251D")
GREEN = colors.HexColor("#167548")
MINT = colors.HexColor("#EAF6EE")
PALE = colors.HexColor("#F5F8F6")
LINE = colors.HexColor("#D6E3DA")
AMBER = colors.HexColor("#FFF4DE")
RED = colors.HexColor("#8A3B32")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.2, leading=10, textColor=GREEN, spaceAfter=8, uppercase=True, tracking=1.2))
styles.add(ParagraphStyle(name="TitleFin", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=27, leading=31, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="Sub", parent=styles["Normal"], fontName="Helvetica", fontSize=12, leading=17, textColor=colors.HexColor("#496257"), spaceAfter=12))
styles.add(ParagraphStyle(name="H1Fin", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=GREEN, spaceBefore=2, spaceAfter=9))
styles.add(ParagraphStyle(name="H2Fin", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=INK, spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyFin", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.35, leading=13.2, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallFin", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.15, leading=10.7, textColor=colors.HexColor("#52665B"), spaceAfter=4))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK, spaceAfter=0))
styles.add(ParagraphStyle(name="Cell", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=INK))
styles.add(ParagraphStyle(name="CellBold", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.2, leading=10.5, textColor=INK))
styles.add(ParagraphStyle(name="Question", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=9.4, leading=12.6, textColor=INK, spaceAfter=1))

def P(text, style="BodyFin"):
    return Paragraph(text, styles[style])

def table(rows, widths, header=True, padding=6):
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), padding),
        ("RIGHTPADDING", (0, 0), (-1, -1), padding),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands += [("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]
    t.setStyle(TableStyle(commands))
    return t

def box(content, background=MINT, border=LINE):
    t = Table([[content]], colWidths=[180 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(15 * mm, 13 * mm, 195 * mm, 13 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#62756A"))
    canvas.drawString(15 * mm, 8.7 * mm, "Finvoice | Demo-ready current capabilities | 17 October 2026")
    canvas.drawRightString(195 * mm, 8.7 * mm, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=15*mm, bottomMargin=18*mm)
story = []

# Page 1
story += [P("PRESENTATION BRIEF", "Kicker"), P("What Finvoice can do today", "TitleFin"),
          P("A practical guide for explaining the current AI financial agent - clearly, honestly, and with a strong live demo.", "Sub")]
story.append(box(P("<b>One-line positioning:</b> Finvoice is a voice-first assistant that reads the project's synthetic financial records, explains the important money signals in English, Hindi, or Hinglish, and prepares selected in-app follow-ups only after the user explicitly confirms.", "Callout")))
story += [Spacer(1, 10), P("First: set the right expectation", "H1Fin")]
story.append(table([
    [P("Say this", "CellBold"), P("Avoid saying this", "CellBold")],
    [P("\"It analyses the demo user's synthetic records and gives grounded answers.\"", "Cell"), P("\"It is connected to my real bank account.\"", "Cell")],
    [P("\"It can prepare in-app reminders, alerts and drafts after a clear yes.\"", "Cell"), P("\"It sends money, files claims or emails the bank automatically.\"", "Cell")],
    [P("\"It can say 'I cannot verify that' when the data is missing.\"", "Cell"), P("\"It knows every financial detail or provides financial advice.\"", "Cell")],
    [P("\"Voice is optional; text remains available if the microphone is unavailable.\"", "Cell"), P("\"Live voice has been tested across every device and environment.\"", "Cell")],
], [89*mm, 89*mm]))
story += [Spacer(1, 9), P("What she can do now", "H1Fin")]
cap_rows = [[P("Area", "CellBold"), P("What she can answer or do now", "CellBold"), P("Practical value", "CellBold")]]
for a,b,c in [
    ("Weekly money briefing", "Surface the top current findings: duplicate charges, bounced autopays and fee traps.", "Turns unread SMS-style records into a short priority list."),
    ("Balances and spending", "Show latest known account balances, transaction matches, monthly spending, categories and month-on-month comparison.", "Answers routine 'where did my money go?' questions quickly."),
    ("Bills and recurring payments", "List bills due, recurring mandates and recurring merchant debits.", "Makes silent auto-debits and upcoming obligations visible."),
    ("Bank-charge investigation", "Find duplicate fees, minimum-balance fee patterns, bounce charges and their dates.", "Creates evidence for a user to question or dispute a charge."),
    ("Insurance companion", "Show recorded policy status and sum insured; check whether cover was active on an admission date; draft a claim-intimation letter.", "Gives clear next steps in a stressful hospital situation without promising approval."),
    ("Investments, loans and email search", "Show recorded mutual-fund/SIP data, loan-application status, and search stored email snippets.", "Brings scattered financial records into one conversation."),
    ("Safe follow-ups", "Propose reminders, spending alerts, duplicate-charge reversal drafts and claim-intimation drafts; save only after explicit confirmation.", "Lets the user move from insight to a prepared next step."),
]: cap_rows.append([P(a,"CellBold"),P(b,"Cell"),P(c,"Cell")])
story.append(table(cap_rows, [35*mm, 90*mm, 53*mm]))
story.append(PageBreak())

# Page 2
story += [P("THE PROBLEMS IT SOLVES", "Kicker"), P("Useful, current solutions - not future promises", "H1Fin"),
          P("The agent solves information and follow-through problems inside the supplied dataset. It does not yet solve payment execution, bank integration or full financial planning.", "Sub")]
prob_rows = [[P("User problem", "CellBold"), P("What Finvoice does now", "CellBold"), P("Honest boundary", "CellBold")]]
for a,b,c in [
    ("I have many alerts and do not know what matters.", "Ranks important signals in a weekly briefing, including suspiciously repeated charges, fee traps and failed autopays.", "It only sees the project dataset; it does not ingest a real inbox or bank feed yet."),
    ("I do not understand repeated debits or bank charges.", "Searches transactions and explains the count, amount and date pattern from deterministic record calculations.", "It can draft a reversal request, but cannot send it to the bank."),
    ("I forget bills and recurring payments.", "Shows bills due and recurring merchant debits; can prepare an in-app reminder or spending alert after confirmation.", "It does not send SMS, WhatsApp, push notifications or make payments."),
    ("I need a fast answer during a hospital situation.", "Checks whether records indicate cover was active on the stated admission date, explains the recorded policy status, and prepares a claim-intimation draft plus a checklist.", "The insurer decides admissibility; policy wording and real claim submission are not connected."),
    ("I am unsure about investments or loan applications.", "Retrieves the recorded SIP/holding information and the recorded loan-application outcomes.", "It does not trade, recommend investments, calculate a credit score or approve loans."),
    ("I want to ask naturally, not navigate a dashboard.", "Accepts text in English, Hindi and Hinglish; live voice is available only when an OpenAI key and microphone setup are present.", "Real-audio quality, device coverage and voice interruption timing still need broader live testing."),
]: prob_rows.append([P(a,"CellBold"),P(b,"Cell"),P(c,"Cell")])
story.append(table(prob_rows, [43*mm, 79*mm, 56*mm]))
story += [Spacer(1, 10), P("Why the answer is more trustworthy than a generic chatbot answer", "H1Fin")]
story.append(box(P("<b>Grounded response path:</b> question -> server-side tool reads the user's records -> deterministic calculation produces amounts -> answer validator checks amounts against the tool result -> only then is the text response shown. If the data is missing, it should say it cannot verify instead of guessing.", "Callout")))
story += [Spacer(1, 8), P("Current safeguards worth mentioning", "H2Fin")]
for text in [
    "Amounts come from server-side tools over synthetic records, rather than being invented by the language model.",
    "A response is checked for unsupported money amounts and unsupported 'done' claims; it gets one correction attempt, then abstains if it still cannot be verified.",
    "Actions use proposal -> explicit confirmation -> in-app record. A request to draft something is not itself confirmation.",
    "Unsupported requests such as transfers, payment, cancellation, cross-user access and prompt-injection instructions are refused.",
]: story.append(P("- " + text, "BodyFin"))
story.append(PageBreak())

# Page 3
story += [P("LIVE DEMO", "Kicker"), P("Questions to ask her during the presentation", "H1Fin"),
          P("Use 3 to 5 questions. Begin with insight, prove a precise answer, then demonstrate the confirmation gate. Do not attempt every feature in one short demo.", "Sub")]
demo_rows = [[P("Order", "CellBold"), P("Ask this", "CellBold"), P("Why it is a good demo", "CellBold")]]
for a,b,c in [
    ("1. Open strong", "\"What should I know about my money this week?\"", "Shows the briefing and establishes that the agent prioritizes, not just searches."),
    ("2. Investigate", "\"IDFC ne kitni baar charge kaata? Detail mein batao.\"", "Demonstrates Hinglish, transaction reasoning and exact record-grounded amounts."),
    ("3. Safe action", "\"IDFC duplicate charges ke liye reversal draft kar do.\"", "Shows that it prepares a draft, rather than claiming the bank has been contacted."),
    ("4. Confirm deliberately", "\"Haan, confirm karo.\"", "Proves that a visible action is saved only after a clear confirmation."),
    ("5. Human-impact case", "\"Papa hospital mein admit hain. Claim chalega?\"", "Shows insurance status checking and calm, transparent communication in a high-stress situation."),
    ("6. Boundary test", "\"Mera CIBIL score kya hai?\"", "A good AI should say it cannot verify this from current records."),
    ("7. Safety test", "\"Arpit ko 5,000 rupees bhej do.\"", "Proves that it does not initiate money movement."),
]: demo_rows.append([P(a,"CellBold"),P(b,"Cell"),P(c,"Cell")])
story.append(table(demo_rows, [23*mm, 78*mm, 77*mm]))
story += [Spacer(1, 9), P("Recommended 3-minute storyline", "H1Fin")]
story.append(table([
    [P("Time", "CellBold"), P("What you do", "CellBold"), P("What you say to the audience", "CellBold")],
    [P("0:00-0:20", "CellBold"), P("Open Overview and start with the weekly briefing question.", "Cell"), P("\"People receive financial alerts, but they do not get a clear priority list. Finvoice turns records into the next thing to act on.\"", "Cell")],
    [P("0:20-1:05", "CellBold"), P("Ask the IDFC detail question. Let her state the evidence-backed finding.", "Cell"), P("\"The agent is not guessing the amount. It calls a server-side tool over the records and the final answer is checked against that result.\"", "Cell")],
    [P("1:05-1:40", "CellBold"), P("Ask for the reversal draft, then explicitly say yes. Open Actions if time allows.", "Cell"), P("\"It does not send anything externally. It prepares a controlled in-app draft and requires the user's clear confirmation.\"", "Cell")],
    [P("1:40-2:25", "CellBold"), P("Ask the insurance question and let the result be honest even if coverage is inactive.", "Cell"), P("\"In a claim moment, false confidence is harmful. The product reports what the records show and still helps prepare the next step.\"", "Cell")],
    [P("2:25-3:00", "CellBold"), P("Ask the CIBIL or payment question as a boundary check.", "Cell"), P("\"The system refuses claims it cannot support and cannot move money. That is a product strength, not a gap to hide.\"", "Cell")],
], [22*mm, 74*mm, 82*mm]))
story.append(PageBreak())

# Page 4
story += [P("PRESENT WITH CONFIDENCE", "Kicker"), P("Practical judge questions and honest answers", "H1Fin")]
qa = [
    ("Is it connected to a real bank?", "No. Today it operates on synthetic, project-provided INR records. The architecture is designed for grounded tools, but real authentication, data connections and production controls are still future work."),
    ("How do you reduce hallucinations?", "The language model requests tools, but the server performs the calculations over records. The response validator checks money amounts against tool results before text is displayed; otherwise the agent corrects or abstains."),
    ("What actually happens when I confirm?", "The action is saved inside the app's Actions area. It does not send a bank request, insurer claim, email, reminder notification or payment outside the app."),
    ("What languages can it handle?", "Text can be asked in English, Hindi or Hinglish. Live voice is optional and depends on configured OpenAI credentials and a browser microphone."),
    ("Can it give financial or insurance advice?", "It explains the records and identifies practical next steps. It does not replace a financial adviser, insurer, bank or doctor, and it does not promise claims or investment outcomes."),
    ("What is the next practical build step?", "Add real user authentication and durable owner-scoped storage first. Then add consented data ingestion, review privacy and security, test real voice sessions, and integrate carefully approved external follow-ups."),
]
for q,a in qa:
    story.append(KeepTogether([P(q,"Question"), P(a,"BodyFin"), Spacer(1,3)]))
story += [Spacer(1, 7), P("Before you begin", "H1Fin")]
check_rows = [[P("Check", "CellBold"), P("Why it matters", "CellBold")],
              [P("Open the app locally and refresh it.", "Cell"), P("Keeps the synthetic data and UI ready for the first question.", "Cell")],
              [P("Confirm whether OPENAI_API_KEY is configured.", "Cell"), P("Without it, the rule-based text fallback works but live voice is disabled.", "Cell")],
              [P("If using voice, allow microphone access in Chrome before the presentation.", "Cell"), P("Avoids an interruption during the first interaction.", "Cell")],
              [P("Keep the text input visible as the backup path.", "Cell"), P("The same scenario can still demonstrate grounded answers if voice is unavailable.", "Cell")],
              [P("Do not promise a live bank connection or actual external submission.", "Cell"), P("Credibility matters more than overstating an MVP.", "Cell")]]
story.append(table(check_rows, [78*mm,100*mm]))
story += [Spacer(1, 9), box(P("<b>Closing line:</b> \"Finvoice does not try to replace a bank or an adviser. It solves the first, practical problem: turning scattered financial records into a clear next action, while remaining honest about what it knows and what it cannot do yet.\"", "Callout"), AMBER, colors.HexColor("#E8C98D"))]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
