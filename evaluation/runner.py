"""
Runner script for the evaluation engine.
Executes the pipeline on the test dataset and generates an academic report.
"""
import os
import json
import glob
import logging
from pprint import pprint

# Setup paths to ensure we can import from the main project
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

from graph.workflow import run_workflow
from evaluation.metrics import evaluate_list, evaluate_action_items
from evaluation.llm_judge import evaluate_summary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_evaluation():
    dataset_dir = os.path.join(os.path.dirname(__file__), 'dataset')
    files = glob.glob(os.path.join(dataset_dir, '*.json'))
    
    if not files:
        print("No evaluation dataset found.")
        return
        
    print(f"Found {len(files)} test meetings. Starting evaluation...")
    
    results = []
    
    for file_path in files:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        meeting_id = data['meeting_id']
        print(f"\n--- Evaluating Meeting: {meeting_id} ---")
        
        # 1. Run Pipeline
        print("Running AI Pipeline...")
        pipeline_result = run_workflow(
            transcript=data['transcript'],
            club_name=data['club_name'],
            meeting_date=data['meeting_date']
        )
        
        mom_data = pipeline_result.get("mom_data", {})
        
        # 2. Extract outputs
        gen_decisions = [d.get("decision", d) if isinstance(d, dict) else d for d in mom_data.get("decisions", [])]
        gen_actions = mom_data.get("action_items", [])
        gen_summary = mom_data.get("summary") or mom_data.get("executive_summary") or ""
        
        ground_truth = data["ground_truth"]
        
        # 3. Calculate Metrics
        print("Calculating metrics...")
        decision_metrics = evaluate_list(gen_decisions, ground_truth.get("decisions", []))
        action_metrics = evaluate_action_items(gen_actions, ground_truth.get("action_items", []))
        
        print("Running LLM Judge for Summary...")
        summary_metrics = evaluate_summary(
            transcript=data["transcript"],
            ground_truth=ground_truth.get("summary", ""),
            generated_summary=gen_summary
        )
        
        meeting_result = {
            "meeting_id": meeting_id,
            "decisions": decision_metrics,
            "action_items": action_metrics,
            "summary": summary_metrics
        }
        results.append(meeting_result)
        
    # Generate Report
    report_path = os.path.join(os.path.dirname(__file__), "evaluation_report.md")
    with open(report_path, "w") as f:
        f.write("# Academic Evaluation Report\n\n")
        f.write("This report details the performance of the AImeet pipeline against ground truth data.\n\n")
        
        total_dec_f1 = sum(r['decisions']['f1'] for r in results) / len(results)
        total_act_f1 = sum(r['action_items']['f1'] for r in results) / len(results)
        
        f.write("## Overall Metrics\n")
        f.write(f"- **Average Decision F1-Score**: {total_dec_f1:.2f}\n")
        f.write(f"- **Average Action Item F1-Score**: {total_act_f1:.2f}\n\n")
        
        for r in results:
            f.write(f"### Meeting: {r['meeting_id']}\n")
            f.write("#### Action Items\n")
            f.write(f"- Precision: {r['action_items']['precision']:.2f}\n")
            f.write(f"- Recall: {r['action_items']['recall']:.2f}\n")
            f.write(f"- F1-Score: {r['action_items']['f1']:.2f}\n")
            
            f.write("#### Decisions\n")
            f.write(f"- Precision: {r['decisions']['precision']:.2f}\n")
            f.write(f"- Recall: {r['decisions']['recall']:.2f}\n")
            f.write(f"- F1-Score: {r['decisions']['f1']:.2f}\n")
            
            f.write("#### Summary (LLM Judge)\n")
            f.write(f"- Relevance: {r['summary'].get('relevance')}/5\n")
            f.write(f"- Completeness: {r['summary'].get('completeness')}/5\n")
            f.write(f"- Faithfulness: {r['summary'].get('faithfulness')}/5\n")
            f.write(f"- Conciseness: {r['summary'].get('conciseness')}/5\n")
            f.write(f"- Reasoning: {r['summary'].get('reasoning')}\n\n")
            
    print(f"\nEvaluation complete. Report generated at {report_path}")

if __name__ == "__main__":
    run_evaluation()
