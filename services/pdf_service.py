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

    Args:
        mom_data: Dictionary with MoM fields (title, club_name, date, attendees,
                  agenda_items, key_discussions, decisions, action_items, summary, next_meeting).
        output_dir: Directory to save the PDF file.

    Returns:
        PDF file as bytes (for Streamlit download).
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
    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "SubtitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=SLATE_200,
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    section_style = ParagraphStyle(
        "SectionStyle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=INDIGO,
        spaceBefore=14,
        spaceAfter=6,
        borderPad=0,
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
        spaceAfter=3,
    )
    footer_style = ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        textColor=SLATE_700,
        alignment=TA_CENTER,
    )

    story = []

    # ── Header Banner ────────────────────────────────────────────────────────
    header_data = [
        [
            Paragraph(f"Minutes of Meeting", title_style),
        ],
        [
            Paragraph(mom_data.get("club_name", "Student Club"), subtitle_style),
        ],
        [
            Paragraph(f"Date: {mom_data.get('date', 'N/A')}  |  Venue: {mom_data.get('venue', 'N/A')}", subtitle_style),
        ],
    ]
    header_table = Table(header_data, colWidths=[17 * cm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INDIGO),
        ("ROUNDEDCORNERS", [8]),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.5 * cm))

    def add_section(title: str, content_fn):
        story.append(Paragraph(title, section_style))
        story.append(HRFlowable(width="100%", thickness=1, color=SLATE_200, spaceAfter=6))
        content_fn()
        story.append(Spacer(1, 0.3 * cm))

    # ── Attendees ────────────────────────────────────────────────────────────
    def attendees_content():
        attendees = mom_data.get("attendees", [])
        if attendees:
            cols = 3
            rows = [attendees[i:i+cols] for i in range(0, len(attendees), cols)]
            padded = [r + [""] * (cols - len(r)) for r in rows]
            t = Table(padded, colWidths=[5.5 * cm] * cols)
            t.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("TEXTCOLOR", (0, 0), (-1, -1), SLATE_900),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [SLATE_50, WHITE]),
                ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]))
            story.append(t)
        else:
            story.append(Paragraph("No attendees listed.", body_style))

        add_section("Attendees", attendees_content)

    # ── Agenda ───────────────────────────────────────────────────────────────
    def agenda_content():
        for i, item in enumerate(mom_data.get("agenda_items", []), 1):
            story.append(Paragraph(f"{i}. {item}", bullet_style))

        add_section("Agenda", agenda_content)

    # ── Key Discussions ──────────────────────────────────────────────────────
    def discussions_content():
        for point in mom_data.get("key_discussions", []):
            story.append(Paragraph(f"• {point}", bullet_style))

        add_section("Key Discussions", discussions_content)

    # ── Decisions ────────────────────────────────────────────────────────────
    def decisions_content():
        for decision in mom_data.get("decisions", []):
            story.append(Paragraph(f"✓  {decision}", bullet_style))

    add_section("Decisions Made", decisions_content)

    # ── Action Items Table ───────────────────────────────────────────────────
    def action_items_content():
        action_items = mom_data.get("action_items", [])
        if not action_items:
            story.append(Paragraph("No action items recorded.", body_style))
            return

        header = ["#", "Task", "Assignee", "Deadline", "Priority"]
        header_row = [Paragraph(f"<b>{h}</b>", ParagraphStyle(
            "th", parent=body_style, textColor=WHITE, fontName="Helvetica-Bold", fontSize=9
        )) for h in header]

        rows = [header_row]
        for i, item in enumerate(action_items, 1):
            priority = item.get("priority", "Medium")
            p_color = _priority_color(priority)
            rows.append([
                Paragraph(str(i), body_style),
                Paragraph(item.get("task", ""), body_style),
                Paragraph(item.get("assignee", "TBD"), body_style),
                Paragraph(item.get("deadline", "N/A"), body_style),
                Paragraph(
                    f"<font color='#{p_color.hexval()[2:]}'><b>{priority}</b></font>",
                    body_style,
                ),
            ])

        col_widths = [1 * cm, 7 * cm, 3 * cm, 3.5 * cm, 2 * cm]
        t = Table(rows, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INDIGO_DARK),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [SLATE_50, WHITE]),
            ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)

    add_section("Action Items", action_items_content)

    # ── Executive Summary ────────────────────────────────────────────────────
    def summary_content():
        story.append(Paragraph(mom_data.get("summary", ""), body_style))

    add_section("📝  Executive Summary", summary_content)

    # ── Next Meeting ─────────────────────────────────────────────────────────
    def next_meeting_content():
        next_mtg = mom_data.get("next_meeting") or "To be scheduled"
        story.append(Paragraph(next_mtg, body_style))

    add_section("📅  Next Meeting", next_meeting_content)

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=SLATE_200))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        f"Minutes compiled by AI Meeting Assistant  ·  Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
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
