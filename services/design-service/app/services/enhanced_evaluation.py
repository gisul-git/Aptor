"""
Enhanced Evaluation Engine
Advanced metrics for design evaluation
"""

import logging
from typing import Dict, Any, List, Optional
from collections import Counter
import math

logger = logging.getLogger(__name__)


class EnhancedEvaluationEngine:
    """Enhanced evaluation with layout, design system, and accessibility metrics"""
    
    def evaluate_layout_metrics(self, design_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Evaluate layout quality metrics
        
        Returns:
            - grid_alignment_score: How well elements align to grid (0-100)
            - spacing_consistency: Consistency of spacing between elements (0-100)
            - visual_balance: Balance of visual weight (0-100)
            - component_alignment: Alignment of related components (0-100)
        """
        
        metrics = design_data.get("metrics", {})
        file_data = design_data.get("file_data", {})
        
        # Extract shape positions
        shapes = self._extract_shapes(file_data)
        
        if not shapes:
            return {
                "grid_alignment_score": 0.0,
                "spacing_consistency": 0.0,
                "visual_balance": 0.0,
                "component_alignment": 0.0
            }
        
        # Grid alignment score
        grid_alignment = self._calculate_grid_alignment(shapes)
        
        # Spacing consistency
        spacing_consistency = self._calculate_spacing_consistency(shapes)
        
        # Visual balance
        visual_balance = self._calculate_visual_balance(shapes)
        
        # Component alignment
        component_alignment = self._calculate_component_alignment(shapes)
        
        return {
            "grid_alignment_score": round(grid_alignment, 2),
            "spacing_consistency": round(spacing_consistency, 2),
            "visual_balance": round(visual_balance, 2),
            "component_alignment": round(component_alignment, 2)
        }
    
    def evaluate_design_system_metrics(
        self,
        design_data: Dict[str, Any],
        events_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, float]:
        """
        Evaluate design system usage
        
        Returns:
            - color_consistency: Limited color palette usage (0-100)
            - font_hierarchy: Proper font size hierarchy (0-100)
            - component_reuse: Component reuse score (0-100)
            - design_token_usage: Consistent spacing/sizing (0-100)
        """
        
        file_data = design_data.get("file_data", {})
        shapes = self._extract_shapes(file_data)
        
        # Color consistency
        colors_used = self._extract_colors(shapes)
        color_consistency = self._calculate_color_consistency(colors_used)
        
        # Font hierarchy
        fonts_used = self._extract_fonts(shapes)
        font_hierarchy = self._calculate_font_hierarchy(fonts_used)
        
        # Component reuse (from events if available)
        component_reuse = 0.0
        if events_data:
            component_reuse = events_data.get("component_reuse_score", 0.0) * 100
        
        # Design token usage (spacing consistency)
        design_token_usage = self._calculate_design_token_usage(shapes)
        
        return {
            "color_consistency": round(color_consistency, 2),
            "font_hierarchy": round(font_hierarchy, 2),
            "component_reuse": round(component_reuse, 2),
            "design_token_usage": round(design_token_usage, 2)
        }
    
    def evaluate_accessibility_metrics(self, design_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Evaluate accessibility compliance
        
        Returns:
            - color_contrast: Color contrast ratio compliance (0-100)
            - text_readability: Text size and spacing (0-100)
            - button_accessibility: Button size and spacing (0-100)
        """
        
        file_data = design_data.get("file_data", {})
        shapes = self._extract_shapes(file_data)
        
        # Color contrast (simplified - would need actual color analysis)
        color_contrast = self._estimate_color_contrast(shapes)
        
        # Text readability
        text_readability = self._calculate_text_readability(shapes)
        
        # Button accessibility
        button_accessibility = self._calculate_button_accessibility(shapes)
        
        return {
            "color_contrast": round(color_contrast, 2),
            "text_readability": round(text_readability, 2),
            "button_accessibility": round(button_accessibility, 2)
        }
    
    def _extract_shapes(self, file_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract all shapes from file data"""
        shapes = []
        
        try:
            data = file_data.get("data", {})
            pages_index = data.get("pages-index", {})
            
            for page_id, page_data in pages_index.items():
                if isinstance(page_data, dict):
                    objects = page_data.get("objects", {})
                    if isinstance(objects, dict):
                        for obj_id, obj_data in objects.items():
                            if isinstance(obj_data, dict):
                                shapes.append(obj_data)
        except Exception as e:
            logger.warning(f"Error extracting shapes: {e}")
        
        return shapes
    
    def _calculate_grid_alignment(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate how well shapes align to a grid"""
        if not shapes:
            return 0.0
        
        # Common grid sizes
        grid_sizes = [4, 8, 12, 16, 24]
        
        aligned_count = 0
        total_count = 0
        
        for shape in shapes:
            x = shape.get("x", 0)
            y = shape.get("y", 0)
            
            # Check if position aligns to any grid
            for grid_size in grid_sizes:
                if x % grid_size == 0 and y % grid_size == 0:
                    aligned_count += 1
                    break
            
            total_count += 1
        
        if total_count == 0:
            return 0.0
        
        return (aligned_count / total_count) * 100
    
    def _calculate_spacing_consistency(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate consistency of spacing between elements"""
        if len(shapes) < 2:
            return 100.0
        
        # Calculate distances between adjacent shapes
        distances = []
        sorted_shapes = sorted(shapes, key=lambda s: (s.get("y", 0), s.get("x", 0)))
        
        for i in range(len(sorted_shapes) - 1):
            shape1 = sorted_shapes[i]
            shape2 = sorted_shapes[i + 1]
            
            x1, y1 = shape1.get("x", 0), shape1.get("y", 0)
            x2, y2 = shape2.get("x", 0), shape2.get("y", 0)
            
            distance = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            distances.append(distance)
        
        if not distances:
            return 100.0
        
        # Calculate standard deviation
        mean_distance = sum(distances) / len(distances)
        variance = sum((d - mean_distance) ** 2 for d in distances) / len(distances)
        std_dev = math.sqrt(variance)
        
        # Lower std dev = more consistent spacing
        # Normalize to 0-100 scale
        consistency = max(0, 100 - (std_dev / mean_distance * 100)) if mean_distance > 0 else 100
        
        return consistency
    
    def _calculate_visual_balance(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate visual balance of layout"""
        if not shapes:
            return 0.0
        
        # Calculate center of mass
        total_weight = 0
        weighted_x = 0
        weighted_y = 0
        
        for shape in shapes:
            x = shape.get("x", 0)
            y = shape.get("y", 0)
            width = shape.get("width", 0)
            height = shape.get("height", 0)
            
            # Weight based on area
            weight = width * height
            total_weight += weight
            weighted_x += x * weight
            weighted_y += y * weight
        
        if total_weight == 0:
            return 0.0
        
        center_x = weighted_x / total_weight
        center_y = weighted_y / total_weight
        
        # Calculate canvas center (assuming 1440x900 canvas)
        canvas_center_x = 720
        canvas_center_y = 450
        
        # Distance from center
        distance = math.sqrt((center_x - canvas_center_x) ** 2 + (center_y - canvas_center_y) ** 2)
        
        # Normalize to 0-100 (closer to center = better balance)
        max_distance = math.sqrt(canvas_center_x ** 2 + canvas_center_y ** 2)
        balance = max(0, 100 - (distance / max_distance * 100))
        
        return balance
    
    def _calculate_component_alignment(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate alignment of components"""
        if len(shapes) < 2:
            return 100.0
        
        # Check horizontal and vertical alignment
        x_positions = [s.get("x", 0) for s in shapes]
        y_positions = [s.get("y", 0) for s in shapes]
        
        # Count shapes that share x or y coordinates
        x_counter = Counter(x_positions)
        y_counter = Counter(y_positions)
        
        aligned_count = sum(1 for count in x_counter.values() if count > 1)
        aligned_count += sum(1 for count in y_counter.values() if count > 1)
        
        alignment_score = min(100, (aligned_count / len(shapes)) * 100)
        
        return alignment_score
    
    def _extract_colors(self, shapes: List[Dict[str, Any]]) -> List[str]:
        """Extract all colors used"""
        colors = []
        
        for shape in shapes:
            fill = shape.get("fill-color")
            stroke = shape.get("stroke-color")
            
            if fill:
                colors.append(fill)
            if stroke:
                colors.append(stroke)
        
        return colors
    
    def _calculate_color_consistency(self, colors: List[str]) -> float:
        """Calculate color palette consistency"""
        if not colors:
            return 0.0
        
        unique_colors = len(set(colors))
        
        # Ideal: 3-5 colors
        if 3 <= unique_colors <= 5:
            return 100.0
        elif unique_colors < 3:
            return 70.0
        else:
            # Penalize for too many colors
            return max(0, 100 - (unique_colors - 5) * 10)
    
    def _extract_fonts(self, shapes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract font usage"""
        fonts = []
        
        for shape in shapes:
            if shape.get("type") == "text":
                fonts.append({
                    "family": shape.get("font-family"),
                    "size": shape.get("font-size"),
                    "weight": shape.get("font-weight")
                })
        
        return fonts
    
    def _calculate_font_hierarchy(self, fonts: List[Dict[str, Any]]) -> float:
        """Calculate font hierarchy quality"""
        if not fonts:
            return 0.0
        
        font_sizes = [f.get("size", 16) for f in fonts]
        unique_sizes = len(set(font_sizes))
        
        # Ideal: 3-5 font sizes for hierarchy
        if 3 <= unique_sizes <= 5:
            return 100.0
        elif unique_sizes < 3:
            return 60.0
        else:
            return max(0, 100 - (unique_sizes - 5) * 15)
    
    def _calculate_design_token_usage(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate consistent spacing/sizing usage"""
        if not shapes:
            return 0.0
        
        # Check if dimensions follow 8px grid
        widths = [s.get("width", 0) for s in shapes]
        heights = [s.get("height", 0) for s in shapes]
        
        grid_aligned = 0
        total = 0
        
        for w in widths:
            if w % 8 == 0:
                grid_aligned += 1
            total += 1
        
        for h in heights:
            if h % 8 == 0:
                grid_aligned += 1
            total += 1
        
        if total == 0:
            return 0.0
        
        return (grid_aligned / total) * 100
    
    def _estimate_color_contrast(self, shapes: List[Dict[str, Any]]) -> float:
        """Estimate color contrast (simplified)"""
        # This is a simplified version
        # Real implementation would calculate actual contrast ratios
        
        text_shapes = [s for s in shapes if s.get("type") == "text"]
        
        if not text_shapes:
            return 100.0
        
        # Assume 80% pass contrast if text exists
        return 80.0
    
    def _calculate_text_readability(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate text readability"""
        text_shapes = [s for s in shapes if s.get("type") == "text"]
        
        if not text_shapes:
            return 100.0
        
        readable_count = 0
        
        for shape in text_shapes:
            font_size = shape.get("font-size", 16)
            line_height = shape.get("line-height", 1.5)
            
            # Minimum 14px font size
            # Minimum 1.4 line height
            if font_size >= 14 and line_height >= 1.4:
                readable_count += 1
        
        if len(text_shapes) == 0:
            return 100.0
        
        return (readable_count / len(text_shapes)) * 100
    
    def _calculate_button_accessibility(self, shapes: List[Dict[str, Any]]) -> float:
        """Calculate button accessibility"""
        # Simplified: check if interactive elements meet minimum size
        
        interactive_shapes = [
            s for s in shapes 
            if s.get("type") in ["rect", "circle"] and s.get("width", 0) > 0
        ]
        
        if not interactive_shapes:
            return 100.0
        
        accessible_count = 0
        
        for shape in interactive_shapes:
            width = shape.get("width", 0)
            height = shape.get("height", 0)
            
            # Minimum 44x44px for touch targets
            if width >= 44 and height >= 44:
                accessible_count += 1
        
        if len(interactive_shapes) == 0:
            return 100.0
        
        return (accessible_count / len(interactive_shapes)) * 100


# Singleton instance
enhanced_evaluation_engine = EnhancedEvaluationEngine()
