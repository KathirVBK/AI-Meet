"""
Metrics calculation for the evaluation engine.
Implements Precision, Recall, and F1-Score for lists of extracted items vs ground truth.
"""
from typing import List, Dict, Any
import difflib

def text_similarity(str1: str, str2: str) -> float:
    """Calculate basic string similarity."""
    if not str1 or not str2:
        return 0.0
    return difflib.SequenceMatcher(None, str1.lower(), str2.lower()).ratio()

def is_match(extracted: str, truth: str, threshold: float = 0.5) -> bool:
    """Determine if two strings are semantically 'close enough' for evaluation."""
    return text_similarity(extracted, truth) >= threshold

def calculate_f1(precision: float, recall: float) -> float:
    if precision + recall == 0:
        return 0.0
    return 2 * (precision * recall) / (precision + recall)

def evaluate_list(extracted_list: List[str], truth_list: List[str]) -> Dict[str, float]:
    """
    Evaluates a list of strings (e.g., decisions).
    Returns dict with precision, recall, f1, and raw counts.
    """
    if not truth_list and not extracted_list:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    if not truth_list and extracted_list:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    if truth_list and not extracted_list:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    true_positives = 0
    matched_extracted = set()

    for truth in truth_list:
        best_match_idx = -1
        best_score = 0
        for i, ext in enumerate(extracted_list):
            if i in matched_extracted:
                continue
            score = text_similarity(ext, truth)
            if score > best_score and score > 0.5:
                best_score = score
                best_match_idx = i
        
        if best_match_idx != -1:
            true_positives += 1
            matched_extracted.add(best_match_idx)

    precision = true_positives / len(extracted_list) if extracted_list else 0.0
    recall = true_positives / len(truth_list) if truth_list else 0.0
    f1 = calculate_f1(precision, recall)

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "true_positives": true_positives,
        "extracted_count": len(extracted_list),
        "truth_count": len(truth_list)
    }

def evaluate_action_items(extracted_items: List[Dict[str, Any]], truth_items: List[Dict[str, str]]) -> Dict[str, float]:
    """
    Evaluates complex action item objects (task, owner, deadline).
    Returns aggregated metrics.
    """
    ext_tasks = [i.get('task', '') for i in extracted_items]
    truth_tasks = [i.get('task', '') for i in truth_items]
    
    return evaluate_list(ext_tasks, truth_tasks)
