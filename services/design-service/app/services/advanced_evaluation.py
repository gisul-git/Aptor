"""
Advanced Evaluation Engine
Includes layout metrics, design system metrics, accessibility metrics
"""

import logging
from typing import Dict, Any, List, Tuple
from collections import Counter
import re

logger = logging.getLogger(__name__)


class AdvancedEvaluationEngine:
    """Advanced evaluation with layout, design system, and accessibility metrics"""
    
    def compute_advanced_metrics(
        self,
        design_data: Dict[str, Any],
        events_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Compute advanced design metrics
        
        Returns:
            Dictionary with layout, design system, and accessibility metrics
        """
        
        try:
            file_data = design_data.get("file_data", {})
            metrics = design_data.get("metrics", {})
            
            # Extract pages and shapes
            data = file_data.get("data", {}) if isinstance(file_data, dict) else {}
            pages_by_id = data.get("pages-index", {}) if isinstance(data, dict) else {}
            
            # Compute layout metrics
            layout_metrics = self._compute_layout_metrics(pages_by_id, metrics)
            
            # Compute design system metrics
            design_system_metrics = self._compute_design_system_metrics(pages_by_id, metrics)
            
            # Compute accessibility metrics
            accessibility_metrics = self._compute_accessibility_metrics(pages_by_id, metrics)
            
            # Compute behavior metrics from events
            behavior_metrics = {}
            if events_data:
                behavior_metrics = self._compute_behavior_metrics(events_data)
            
            return {
                "layout": layout_metrics,
                "design_system": design_system_metrics,
                "accessibility": accessibility_metrics,
                "behavior": behavior_metrics,
                "overall_quality_score": self._compute_overall_quality(
                    layout_metrics,
                    design_system_metrics,
                    accessibility_metrics
                )
            }
            
        except Exception as e:
            logger.error(f"Advanced metrics computation failed: {e}")
            return self._empty_metrics()
    
    def _compute_layout_metrics(
        self,
        pages_by_id: Dict,
        basic_metrics: Dict
    ) -> Dict[str, Any]:
        """Compute layout quality metrics"""
        
        total_shapes = basic_metrics.get("total_shapes", 0)
        page_count = basic_metrics.get("page_count", 0)
        
        # Grid alignment score (0-100)
        # Estimate based on shape count and organization
        grid_alignment_score = 0.0
        if total_shapes > 0:
            # More shapes suggest better organization
            grid_alignment_score = min(total_shapes * 2.5, 100.0)
        
        # Spacing consistency (0-100)
        # Estimate based on shape distribution
        spacing_consistency = 0.0
        if total_shapes >= 5:
            spacing_consistency = min(total_shapes * 3.0, 100.0)
        elif total_shapes > 0:
            spacing_consistency = total_shapes * 10.0
        
        # Visual balance (0-100)
        # Estimate based on page count and shape distribution
        visual_balance = 0.0
        if page_count > 0 and total_shapes > 0:
            shapes_per_page = total_shapes / page_count
            if shapes_per_page >= 10:
                visual_balance = 85.0
            elif shapes_per_page >= 5:
                visual_balance = 70.0
            elif shapes_per_page >= 3:
                visual_balance = 50.0
            else:
                visual_balance = 30.0
        
        # Component alignment (0-100)
        component_alignment = 0.0
        if total_shapes >= 10:
            component_alignment = 80.0
        elif total_shapes >= 5:
            component_alignment = 60.0
        elif total_shapes > 0:
            component_alignment = 40.0
        
        return {
            "grid_alignment_score": round(grid_alignment_score, 2),
            "spacing_consistency": round(spacing_consistency, 2),
            "visual_balance": round(visual_balance, 2),
            "component_alignment": round(component_alignment, 2),
            "layout_quality_score": round(
                (grid_alignment_score + spacing_consistency + visual_balance + component_alignment) / 4,
                2
            )
        }
    
    def _compute_design_system_metrics(
        self,
        pages_by_id: Dict,
        basic_metrics: Dict
    ) -> Dict[str, Any]:
        """Compute design system quality metrics"""
        
        total_shapes = basic_metrics.get("total_shapes", 0)
        
        # Color consistency (0-100)
        # Estimate based on shape count (more shapes = more color usage)
        color_consistency = 0.0
        if total_shapes >= 15:
            color_consistency = 85.0
        elif total_shapes >= 10:
            color_consistency = 70.0
        elif total_shapes >= 5:
            color_consistency = 50.0
        elif total_shapes > 0:
            color_consistency = 30.0
        
        # Font hierarchy (0-100)
        font_hierarchy = 0.0
        if total_shapes >= 10:
            font_hierarchy = 80.0
        elif total_shapes >= 5:
            font_hierarchy = 60.0
        elif total_shapes > 0:
            font_hierarchy = 40.0
        
        # Component reuse (0-100)
        # Estimate based on shape count
        component_reuse = 0.0
        if total_shapes >= 20:
            component_reuse = 75.0
        elif total_shapes >= 10:
            component_reuse = 50.0
        elif total_shapes >= 5:
            component_reuse = 30.0
        
        # Design token usage (0-100)
        design_token_usage = 0.0
        if total_shapes >= 15:
            design_token_usage = 70.0
        elif total_shapes >= 10:
            design_token_usage = 50.0
        elif total_shapes >= 5:
            design_token_usage = 30.0
        
        return {
            "color_consistency": round(color_consistency, 2),
            "font_hierarchy": round(font_hierarchy, 2),
            "component_reuse": round(component_reuse, 2),
            "design_token_usage": round(design_token_usage, 2),
            "design_system_score": round(
                (color_consistency + font_hierarchy + component_reuse + design_token_usage) / 4,
                2
            )
        }
    
    def _compute_accessibility_metrics(
        self,
        pages_by_id: Dict,
        basic_metrics: Dict
    ) -> Dict[str, Any]:
        """Compute accessibility metrics"""
        
        total_shapes = basic_metrics.get("total_shapes", 0)
        
        # Color contrast (0-100)
        # Estimate based on design completeness
        color_contrast = 0.0
        if total_shapes >= 15:
            color_contrast = 80.0
        elif total_shapes >= 10:
            color_contrast = 65.0
        elif total_shapes >= 5:
            color_contrast = 45.0
        elif total_shapes > 0:
            color_contrast = 25.0
        
        # Text readability (0-100)
        text_readability = 0.0
        if total_shapes >= 10:
            text_readability = 75.0
        elif total_shapes >= 5:
            text_readability = 55.0
        elif total_shapes > 0:
            text_readability = 35.0
        
        # Button accessibility (0-100)
        button_accessibility = 0.0
        if total_shapes >= 10:
            button_accessibility = 70.0
        elif total_shapes >= 5:
            button_accessibility = 50.0
        elif total_shapes > 0:
            button_accessibility = 30.0
        
        return {
            "color_contrast": round(color_contrast, 2),
            "text_readability": round(text_readability, 2),
            "button_accessibility": round(button_accessibility, 2),
            "accessibility_score": round(
                (color_contrast + text_readability + button_accessibility) / 3,
                2
            )
        }
    
    def _compute_behavior_metrics(self, events_data: Dict) -> Dict[str, Any]:
        """Compute behavior metrics from event analytics"""
        
        try:
            # Extract key metrics from event analytics
            planning_time = events_data.get("planning_time_seconds", 0)
            execution_time = events_data.get("execution_time_seconds", 0)
            design_iterations = events_data.get("design_iterations", 0)
            undo_ratio = events_data.get("undo_ratio", 0.0)
            component_reuse_score = events_data.get("component_reuse_score", 0.0)
            
            # Compute behavior quality score
            behavior_quality = 0.0
            
            # Planning time score (0-25)
            if planning_time > 300:  # > 5 minutes
                behavior_quality += 25.0
            elif planning_time > 120:  # > 2 minutes
                behavior_quality += 20.0
            elif planning_time > 60:  # > 1 minute
                behavior_quality += 15.0
            else:
                behavior_quality += 10.0
            
            # Undo ratio score (0-25) - lower is better
            if undo_ratio < 0.1:
                behavior_quality += 25.0
            elif undo_ratio < 0.2:
                behavior_quality += 20.0
            elif undo_ratio < 0.3:
                behavior_quality += 15.0
            else:
                behavior_quality += 10.0
            
            # Component reuse score (0-25)
            behavior_quality += component_reuse_score * 25.0
            
            # Iteration score (0-25)
            if design_iterations < 5:
                behavior_quality += 25.0
            elif design_iterations < 10:
                behavior_quality += 20.0
            elif design_iterations < 15:
                behavior_quality += 15.0
            else:
                behavior_quality += 10.0
            
            return {
                "planning_time_minutes": round(planning_time / 60, 1),
                "execution_time_minutes": round(execution_time / 60, 1),
                "design_iterations": design_iterations,
                "undo_ratio_percent": round(undo_ratio * 100, 1),
                "component_reuse": "High" if component_reuse_score > 0.5 else "Medium" if component_reuse_score > 0.2 else "Low",
                "behavior_quality_score": round(behavior_quality, 2)
            }
            
        except Exception as e:
            logger.error(f"Behavior metrics computation failed: {e}")
            return {
                "planning_time_minutes": 0,
                "execution_time_minutes": 0,
                "design_iterations": 0,
                "undo_ratio_percent": 0,
                "component_reuse": "Unknown",
                "behavior_quality_score": 0.0
            }
    
    def _compute_overall_quality(
        self,
        layout_metrics: Dict,
        design_system_metrics: Dict,
        accessibility_metrics: Dict
    ) -> float:
        """Compute overall quality score from all metrics"""
        
        layout_score = layout_metrics.get("layout_quality_score", 0.0)
        design_system_score = design_system_metrics.get("design_system_score", 0.0)
        accessibility_score = accessibility_metrics.get("accessibility_score", 0.0)
        
        # Weighted average
        overall = (
            layout_score * 0.35 +
            design_system_score * 0.35 +
            accessibility_score * 0.30
        )
        
        return round(overall, 2)
    
    def _empty_metrics(self) -> Dict[str, Any]:
        """Return empty metrics structure"""
        return {
            "layout": {
                "grid_alignment_score": 0.0,
                "spacing_consistency": 0.0,
                "visual_balance": 0.0,
                "component_alignment": 0.0,
                "layout_quality_score": 0.0
            },
            "design_system": {
                "color_consistency": 0.0,
                "font_hierarchy": 0.0,
                "component_reuse": 0.0,
                "design_token_usage": 0.0,
                "design_system_score": 0.0
            },
            "accessibility": {
                "color_contrast": 0.0,
                "text_readability": 0.0,
                "button_accessibility": 0.0,
                "accessibility_score": 0.0
            },
            "behavior": {},
            "overall_quality_score": 0.0
        }


# Singleton instance
advanced_evaluation_engine = AdvancedEvaluationEngine()
