"""
Services Module
"""

from app.services.ai_question_generator import ai_question_generator
from app.services.penpot_service import penpot_service
# Evaluation engine temporarily disabled due to OpenCV/NumPy compatibility
# from app.services.evaluation_engine import evaluation_engine

__all__ = [
    "ai_question_generator",
    "penpot_service"
]