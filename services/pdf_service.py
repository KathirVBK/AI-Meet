"""
PDF service: Generate a professional downloadable PDF of the meeting minutes.
Uses ReportLab for premium formatting.
"""
import os
import logging
from datetime import datetime
from pathlib import Path
from io import BytesIO
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

logger = logging.getLogger(__name__)

# ── Colour Palette ──────────────────────────────────────────────────────────
INDIGO      = colors.HexColor("#4f46e5")
INDIGO_DARK = colors.HexColor("#3730a3")
SLATE_900   = colors.HexColor("#0f172a")
SLATE_700   = colors.HexColor("#334155")
SLATE_200   = colors.HexColor("#e2e8f0")
SLATE_50    = colors.HexColor("#f8fafc")
WHITE       = colors.white
GREEN       = colors.HexColor("#16a34a")
AMBER       = colors.HexColor("#d97706")
RED         = colors.HexColor("#dc2626")


def _priority_color(priority: str) -> colors.HexColor:
    mapping = {"High": RED, "Medium": AMBER, "Low": GREEN}
    return mapping.get(priority, SLATE_700)


def generate_mom_pdf(mom_data: dict, output_dir: str = "./output") -> bytes:
    """
    Generate a premium PDF from meeting minutes data.
    """
    os.makedirs(output_dir, exist_ok=True)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Minutes of Meeting – {mom_data.get('club_name', 'Club')}",
    )

    styles = getSampleStyleSheet()

    # ── Custom styles ────────────────────────────────────────────────────────
    meetmind_style = ParagraphStyle(
        "MeetMindStyle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=SLATE_900,
        alignment=TA_CENTER,
        spaceAfter=6,
        letterSpacing=2,
    )
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=SLATE_700,
        alignment=TA_CENTER,
        spaceAfter=16,
        letterSpacing=1,
    )
    meta_style = ParagraphStyle(
        "MetaStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=SLATE_700,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    section_style = ParagraphStyle(
        "SectionStyle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=SLATE_900,
        spaceBefore=16,
        spaceAfter=8,
        letterSpacing=1,
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=SLATE_900,
        leading=16,
        spaceAfter=4,
    )
    bullet_style = ParagraphStyle(
        "BulletStyle",
        parent=body_style,
        leftIndent=16,
        bulletIndent=4,
        spaceAfter=4,
    )
    footer_style = ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        textColor=SLATE_700,
        alignment=TA_CENTER,
    )

    story = []
    
    # ── Top Line ─────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=SLATE_900, spaceAfter=14))

    # ── Header ───────────────────────────────────────────────────────────────
    story.append(Paragraph("MEETMIND", meetmind_style))
    story.append(Paragraph("MINUTES OF MEETING", title_style))
    
    meeting_title = mom_data.get("meeting_title") or mom_data.get("title") or f"{mom_data.get('club_name', 'Student Club')} Meeting"
    story.append(Paragraph(f"<b>Meeting:</b> {meeting_title}", meta_style))
    story.append(Paragraph(f"<b>Date:</b> {mom_data.get('date', 'N/A')}", meta_style))
    
    # Duration (calculate from word_count if duration_minutes not present)
    dur = mom_data.get("duration_minutes")
    if dur is None:
        word_count = mom_data.get("word_count", 2250)
        dur = max(1, round(word_count / 150))
    story.append(Paragraph(f"<b>Duration:</b> {dur} minutes", meta_style))
    
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=SLATE_900, spaceAfter=14))

    # ── Summary ──────────────────────────────────────────────────────────────
    summary_text = mom_data.get("summary") or mom_data.get("executive_summary")
    if summary_text:
        story.append(Paragraph("SUMMARY", section_style))
        story.append(Paragraph(summary_text, body_style))
        story.append(Spacer(1, 8))

    # ── Key Discussions ──────────────────────────────────────────────────────
    discussions = mom_data.get("key_discussions") or mom_data.get("discussion_points") or []
    if discussions:
        story.append(Paragraph("KEY DISCUSSIONS", section_style))
        for point in discussions:
            story.append(Paragraph(f"• {point}", bullet_style))
        story.append(Spacer(1, 8))

    # ── Decisions ────────────────────────────────────────────────────────────
    decisions = mom_data.get("decisions", [])
    if decisions:
        story.append(Paragraph("DECISIONS", section_style))
        for d in decisions:
            if isinstance(d, dict):
                decision_text = d.get('decision', '')
                status = d.get('status', 'Confirmed')
                story.append(Paragraph(f"• <b>{decision_text}</b> (Status: {status})", bullet_style))
            else:
                story.append(Paragraph(f"• {d}", bullet_style))
        story.append(Spacer(1, 8))

    # ── Action Plan ──────────────────────────────────────────────────────────
    action_items = mom_data.get("action_items", [])
    if action_items:
        story.append(Paragraph("ACTION PLAN", section_style))
        
        header = ["Task", "Owner", "Deadline", "Priority"]
        header_row = [Paragraph(f"<b>{h}</b>", ParagraphStyle(
            "th", parent=body_style, textColor=WHITE, fontName="Helvetica-Bold", fontSize=9
        )) for h in header]

        rows = [header_row]
        for item in action_items:
            priority = item.get("priority", "Medium")
            p_color = _priority_color(priority)
            owner = item.get("owner") or item.get("person") or item.get("assignee") or "TBD"
            rows.append([
                Paragraph(item.get("task", ""), body_style),
                Paragraph(owner, body_style),
                Paragraph(item.get("deadline", "N/A"), body_style),
                Paragraph(
                    f"<font color='#{p_color.hexval()[2:]}'><b>{priority}</b></font>",
                    body_style,
                ),
            ])

        col_widths = [7.5 * cm, 3 * cm, 3.5 * cm, 2.5 * cm]
        t = Table(rows, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), SLATE_900),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [SLATE_50, WHITE]),
            ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
        story.append(Spacer(1, 14))

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=SLATE_900, spaceAfter=14))
    story.append(Paragraph(
        "Generated by MeetMind AI",
        footer_style,
    ))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Also save to disk
    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in mom_data.get("club_name", "club"))
    filename = f"{safe_name}_MoM_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    out_path = os.path.join(output_dir, filename)
    with open(out_path, "wb") as f:
        f.write(pdf_bytes)
    logger.info(f"PDF saved: {out_path}")

    return pdf_bytes
