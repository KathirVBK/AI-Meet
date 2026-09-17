"""
RAG chain module.
Combines retrieval + Groq LLM to answer questions about previous meetings.
Supports conversation memory for contextual follow-up questions.
"""
import os
import logging
from typing import Optional
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from rag.retriever import retrieve_relevant_docs, format_retrieved_context
from prompts.rag_prompt import RAG_PROMPT

logger = logging.getLogger(__name__)

RAG_LLM_MODEL = os.getenv("GROQ_LLM_MODEL", "llama3-8b-8192")


def get_rag_llm() -> ChatGroq:
    """Initialize the Groq LLM for RAG answers."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set in environment.")
    return ChatGroq(
        model=RAG_LLM_MODEL,
        api_key=api_key,
        temperature=0.2,
        max_tokens=1024,
    )


def answer_question(
    question: str,
    filter_club: Optional[str] = None,
    chat_history: str = "",
    top_k: int = 5,
) -> dict:
    """
    Retrieve relevant context and generate an answer using Groq LLM.

    Args:
        question: User's question about previous meetings.
        filter_club: Optional club name to narrow the search scope.
        chat_history: Formatted string of previous conversation turns.
        top_k: Number of retrieval results.

    Returns:
        Dict with 'answer' and 'source_docs' keys.
    """
    # Step 1: Retrieve relevant documents
    docs = retrieve_relevant_docs(question, top_k=top_k, filter_club=filter_club)
    context = format_retrieved_context(docs)

    # Step 2: Build prompt with chat history
    prompt = PromptTemplate(
        template=RAG_PROMPT,
        input_variables=["context", "question", "chat_history"],
    )

    # Step 3: Build and run chain
    llm = get_rag_llm()
    chain = prompt | llm | StrOutputParser()

    logger.info(f"Running RAG chain for question: '{question[:80]}' (history: {len(chat_history)} chars)")
    answer = chain.invoke({
        "context": context,
        "question": question,
        "chat_history": chat_history if chat_history else "No previous conversation.",
    })

    return {
        "answer": answer,
        "source_docs": docs,
        "context_used": context,
    }
