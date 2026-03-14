"""
Event Analytics Service
Analyzes design events to extract behavior insights
"""

import logging
from typing import List, Dict, Any
from datetime import datetime
from collections import Counter
from app.models.design_events import (
    DesignEventModel,
    EventAnalytics,
    DesignEventType,
    ShapeType
)

logger = logging.getLogger(__name__)


class EventAnalyticsService:
    """Service for analyzing design events and computing metrics"""
    
    def compute_analytics(
        self,
        session_id: str,
        events: List[DesignEventModel]
    ) -> EventAnalytics:
        """
        Compute comprehensive analytics from event stream
        
        Args:
            session_id: Session identifier
            events: List of design events
            
        Returns:
            EventAnalytics with computed metrics
        """
        
        if not events:
            return self._empty_analytics(session_id)
        
        # Sort events by timestamp
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        
        # Time metrics
        time_metrics = self._compute_time_metrics(sorted_events)
        
        # Shape metrics
        shape_metrics = self._compute_shape_metrics(sorted_events)
        
        # Interaction metrics
        interaction_metrics = self._compute_interaction_metrics(sorted_events)
        
        # Tool usage
        tool_metrics = self._compute_tool_metrics(sorted_events)
        
        # Style metrics
        style_metrics = self._compute_style_metrics(sorted_events)
        
        # Component metrics
        component_metrics = self._compute_component_metrics(sorted_events)
        
        # Canvas metrics
        canvas_metrics = self._compute_canvas_metrics(sorted_events)
        
        # Keyboard metrics
        keyboard_metrics = self._compute_keyboard_metrics(sorted_events)
        
        # Iteration metrics
        iteration_metrics = self._compute_iteration_metrics(sorted_events)
        
        # Layer metrics
        layer_metrics = self._compute_layer_metrics(sorted_events)
        
        # Alignment metrics
        alignment_metrics = self._compute_alignment_metrics(sorted_events)
        
        # Clipboard metrics
        clipboard_metrics = self._compute_clipboard_metrics(sorted_events)
        
        # Page metrics
        page_metrics = self._compute_page_metrics(sorted_events)
        
        # Behavior insights
        behavior_insights = self._compute_behavior_insights(
            time_metrics,
            interaction_metrics,
            tool_metrics,
            layer_metrics,
            keyboard_metrics
        )
        
        # Overall scores
        scores = self._compute_scores(
            time_metrics,
            interaction_metrics,
            tool_metrics,
            keyboard_metrics,
            layer_metrics,
            alignment_metrics
        )
        
        # Combine all metrics
        analytics = EventAnalytics(
            session_id=session_id,
            **time_metrics,
            **shape_metrics,
            **interaction_metrics,
            **tool_metrics,
            **style_metrics,
            **component_metrics,
            **canvas_metrics,
            **keyboard_metrics,
            **iteration_metrics,
            **layer_metrics,
            **alignment_metrics,
            **clipboard_metrics,
            **page_metrics,
            **behavior_insights,
            **scores
        )
        
        logger.info(f"✅ Computed analytics for session {session_id}: {len(events)} events")
        return analytics
    
    def _compute_time_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute time-based metrics"""
        if not events:
            return {
                "total_time_seconds": 0,
                "active_time_seconds": 0,
                "idle_time_seconds": 0,
                "planning_time_seconds": 0,
                "execution_time_seconds": 0
            }
        
        # Parse timestamps
        start_time = datetime.fromisoformat(events[0].timestamp.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(events[-1].timestamp.replace('Z', '+00:00'))
        total_time = int((end_time - start_time).total_seconds())
        
        # Calculate idle time
        idle_time = sum(e.idle_seconds or 0 for e in events if e.event_type == DesignEventType.IDLE_START)
        active_time = total_time - idle_time
        
        # Find first shape creation (planning vs execution)
        first_shape_idx = next(
            (i for i, e in enumerate(events) if e.event_type == DesignEventType.SHAPE_CREATE),
            len(events)
        )
        
        if first_shape_idx < len(events):
            first_shape_time = datetime.fromisoformat(events[first_shape_idx].timestamp.replace('Z', '+00:00'))
            planning_time = int((first_shape_time - start_time).total_seconds())
            execution_time = total_time - planning_time
        else:
            planning_time = total_time
            execution_time = 0
        
        return {
            "total_time_seconds": total_time,
            "active_time_seconds": active_time,
            "idle_time_seconds": idle_time,
            "planning_time_seconds": planning_time,
            "execution_time_seconds": execution_time
        }
    
    def _compute_shape_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute shape-related metrics"""
        shape_creates = [e for e in events if e.event_type == DesignEventType.SHAPE_CREATE]
        shape_deletes = [e for e in events if e.event_type == DesignEventType.SHAPE_DELETE]
        
        # Count shape types
        shape_types = [e.shape_type for e in shape_creates if e.shape_type]
        shape_distribution = dict(Counter(shape_types))
        
        return {
            "total_shapes_created": len(shape_creates),
            "total_shapes_deleted": len(shape_deletes),
            "final_shape_count": len(shape_creates) - len(shape_deletes),
            "shape_type_distribution": shape_distribution
        }
    
    def _compute_interaction_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute interaction metrics"""
        clicks = len([e for e in events if e.event_type == DesignEventType.CLICK])
        undos = len([e for e in events if e.event_type == DesignEventType.UNDO])
        redos = len([e for e in events if e.event_type == DesignEventType.REDO])
        
        undo_ratio = undos / (undos + redos) if (undos + redos) > 0 else 0.0
        
        return {
            "total_clicks": clicks,
            "total_undo": undos,
            "total_redo": redos,
            "undo_ratio": round(undo_ratio, 3)
        }
    
    def _compute_tool_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute tool usage metrics"""
        tool_events = [e for e in events if e.event_type.startswith("tool_")]
        tool_switches = len(tool_events)
        
        tools_used = [e.tool_name for e in tool_events if e.tool_name]
        tool_counter = Counter(tools_used)
        most_used_tool = tool_counter.most_common(1)[0][0] if tool_counter else "select"
        
        return {
            "tool_switches": tool_switches,
            "most_used_tool": most_used_tool,
            "tool_usage_distribution": dict(tool_counter)
        }
    
    def _compute_style_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute style change metrics"""
        color_changes = len([e for e in events if e.event_type in [
            DesignEventType.COLOR_CHANGE,
            DesignEventType.FILL_CHANGE,
            DesignEventType.STROKE_CHANGE
        ]])
        
        font_changes = len([e for e in events if e.event_type in [
            DesignEventType.FONT_CHANGE,
            DesignEventType.FONT_SIZE_CHANGE,
            DesignEventType.FONT_WEIGHT_CHANGE
        ]])
        
        # Count unique colors
        colors = set()
        for e in events:
            if e.fill_color:
                colors.add(e.fill_color)
            if e.stroke_color:
                colors.add(e.stroke_color)
        
        # Count unique fonts
        fonts = set(e.font_family for e in events if e.font_family)
        
        return {
            "color_changes": color_changes,
            "font_changes": font_changes,
            "unique_colors_used": len(colors),
            "unique_fonts_used": len(fonts)
        }
    
    def _compute_component_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute component reuse metrics"""
        components_created = len([e for e in events if e.event_type == DesignEventType.COMPONENT_CREATE])
        component_instances = len([e for e in events if e.event_type == DesignEventType.COMPONENT_INSTANCE])
        
        reuse_score = component_instances / components_created if components_created > 0 else 0.0
        
        return {
            "components_created": components_created,
            "component_instances": component_instances,
            "component_reuse_score": round(reuse_score, 3)
        }
    
    def _compute_canvas_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute canvas operation metrics"""
        zoom_changes = len([e for e in events if e.event_type in [
            DesignEventType.ZOOM_IN,
            DesignEventType.ZOOM_OUT,
            DesignEventType.ZOOM_FIT
        ]])
        
        pan_operations = len([e for e in events if e.event_type == DesignEventType.PAN_CANVAS])
        
        return {
            "zoom_changes": zoom_changes,
            "pan_operations": pan_operations
        }
    
    def _compute_keyboard_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute keyboard shortcut metrics"""
        shortcuts = len([e for e in events if e.event_type == DesignEventType.KEYBOARD_SHORTCUT])
        total_operations = len(events)
        
        proficiency = shortcuts / total_operations if total_operations > 0 else 0.0
        
        return {
            "keyboard_shortcuts_used": shortcuts,
            "shortcut_proficiency": round(proficiency, 3)
        }
    
    def _compute_iteration_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute design iteration metrics"""
        creates = len([e for e in events if e.event_type == DesignEventType.SHAPE_CREATE])
        deletes = len([e for e in events if e.event_type == DesignEventType.SHAPE_DELETE])
        
        # Estimate iterations (create-delete cycles)
        iterations = min(creates, deletes)
        
        trial_error_ratio = deletes / creates if creates > 0 else 0.0
        
        return {
            "design_iterations": iterations,
            "trial_error_ratio": round(trial_error_ratio, 3)
        }
    
    def _compute_layer_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute layer organization metrics"""
        layers_created = len([e for e in events if e.event_type == DesignEventType.LAYER_CREATE])
        layers_renamed = len([e for e in events if e.event_type == DesignEventType.LAYER_RENAME])
        
        # Organization score based on renaming and reordering
        layer_reorders = len([e for e in events if e.event_type == DesignEventType.LAYER_REORDER])
        organization_score = (layers_renamed + layer_reorders) / layers_created if layers_created > 0 else 0.0
        organization_score = min(organization_score, 1.0)
        
        return {
            "layers_created": layers_created,
            "layers_renamed": layers_renamed,
            "layer_organization_score": round(organization_score, 3)
        }
    
    def _compute_alignment_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute alignment and precision metrics"""
        alignment_ops = len([e for e in events if e.event_type in [
            DesignEventType.ALIGN_LEFT,
            DesignEventType.ALIGN_CENTER,
            DesignEventType.ALIGN_RIGHT,
            DesignEventType.ALIGN_TOP,
            DesignEventType.ALIGN_MIDDLE,
            DesignEventType.ALIGN_BOTTOM
        ]])
        
        distribution_ops = len([e for e in events if e.event_type in [
            DesignEventType.DISTRIBUTE_HORIZONTAL,
            DesignEventType.DISTRIBUTE_VERTICAL
        ]])
        
        total_shapes = len([e for e in events if e.event_type == DesignEventType.SHAPE_CREATE])
        precision_score = (alignment_ops + distribution_ops) / total_shapes if total_shapes > 0 else 0.0
        precision_score = min(precision_score, 1.0)
        
        return {
            "alignment_operations": alignment_ops,
            "distribution_operations": distribution_ops,
            "precision_score": round(precision_score, 3)
        }
    
    def _compute_clipboard_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute clipboard operation metrics"""
        copy_ops = len([e for e in events if e.event_type == DesignEventType.COPY])
        paste_ops = len([e for e in events if e.event_type == DesignEventType.PASTE])
        duplicate_ops = len([e for e in events if e.event_type == DesignEventType.DUPLICATE])
        
        total_creates = len([e for e in events if e.event_type == DesignEventType.SHAPE_CREATE])
        reuse_efficiency = (paste_ops + duplicate_ops) / total_creates if total_creates > 0 else 0.0
        
        return {
            "copy_operations": copy_ops,
            "paste_operations": paste_ops,
            "duplicate_operations": duplicate_ops,
            "reuse_efficiency": round(reuse_efficiency, 3)
        }
    
    def _compute_page_metrics(self, events: List[DesignEventModel]) -> Dict[str, Any]:
        """Compute page management metrics"""
        pages_created = len([e for e in events if e.event_type == DesignEventType.PAGE_CREATE])
        page_switches = len([e for e in events if e.event_type == DesignEventType.PAGE_SWITCH])
        
        return {
            "pages_created": pages_created,
            "page_switches": page_switches
        }
    
    def _compute_behavior_insights(
        self,
        time_metrics: Dict,
        interaction_metrics: Dict,
        tool_metrics: Dict,
        layer_metrics: Dict,
        keyboard_metrics: Dict
    ) -> Dict[str, bool]:
        """Compute behavioral insights"""
        
        # Methodical: Low undo ratio, high planning time
        is_methodical = (
            interaction_metrics["undo_ratio"] < 0.2 and
            time_metrics["planning_time_seconds"] > time_metrics["execution_time_seconds"] * 0.2
        )
        
        # Experimental: High undo ratio, many iterations
        is_experimental = interaction_metrics["undo_ratio"] > 0.4
        
        # Efficient: High shortcut usage, low tool switches
        is_efficient = (
            keyboard_metrics["shortcut_proficiency"] > 0.1 and
            tool_metrics["tool_switches"] < 20
        )
        
        # Organized: Good layer management
        is_organized = layer_metrics["layer_organization_score"] > 0.3
        
        return {
            "is_methodical": is_methodical,
            "is_experimental": is_experimental,
            "is_efficient": is_efficient,
            "is_organized": is_organized
        }
    
    def _compute_scores(
        self,
        time_metrics: Dict,
        interaction_metrics: Dict,
        tool_metrics: Dict,
        keyboard_metrics: Dict,
        layer_metrics: Dict,
        alignment_metrics: Dict
    ) -> Dict[str, float]:
        """Compute overall scores"""
        
        # Design process score (0-100)
        # Based on: low undo ratio, good planning, organized layers
        process_score = (
            (1 - interaction_metrics["undo_ratio"]) * 30 +  # Low undo is good
            min(time_metrics["planning_time_seconds"] / 300, 1.0) * 20 +  # Planning time
            layer_metrics["layer_organization_score"] * 30 +  # Organization
            alignment_metrics["precision_score"] * 20  # Precision
        )
        
        # Technical proficiency score (0-100)
        # Based on: keyboard shortcuts, tool efficiency, component reuse
        tool_efficiency = min(1.0 / (tool_metrics["tool_switches"] / 10), 1.0) if tool_metrics["tool_switches"] > 0 else 1.0
        proficiency_score = (
            keyboard_metrics["shortcut_proficiency"] * 100 * 0.4 +  # Shortcuts
            tool_efficiency * 30 +  # Tool efficiency
            alignment_metrics["precision_score"] * 30  # Precision
        )
        
        # Efficiency score (0-100)
        # Based on: time usage, shortcuts, reuse
        active_ratio = time_metrics["active_time_seconds"] / time_metrics["total_time_seconds"] if time_metrics["total_time_seconds"] > 0 else 0
        efficiency_score = (
            active_ratio * 40 +  # Active time ratio
            keyboard_metrics["shortcut_proficiency"] * 100 * 0.3 +  # Shortcuts
            (1 - interaction_metrics["undo_ratio"]) * 30  # Low undo
        )
        
        return {
            "design_process_score": round(process_score, 2),
            "technical_proficiency_score": round(proficiency_score, 2),
            "efficiency_score": round(efficiency_score, 2)
        }
    
    def _empty_analytics(self, session_id: str) -> EventAnalytics:
        """Return empty analytics for sessions with no events"""
        return EventAnalytics(
            session_id=session_id,
            total_time_seconds=0,
            active_time_seconds=0,
            idle_time_seconds=0,
            planning_time_seconds=0,
            execution_time_seconds=0,
            total_shapes_created=0,
            total_shapes_deleted=0,
            final_shape_count=0,
            shape_type_distribution={},
            total_clicks=0,
            total_undo=0,
            total_redo=0,
            undo_ratio=0.0,
            tool_switches=0,
            most_used_tool="select",
            tool_usage_distribution={},
            color_changes=0,
            font_changes=0,
            unique_colors_used=0,
            unique_fonts_used=0,
            components_created=0,
            component_instances=0,
            component_reuse_score=0.0,
            zoom_changes=0,
            pan_operations=0,
            keyboard_shortcuts_used=0,
            shortcut_proficiency=0.0,
            design_iterations=0,
            trial_error_ratio=0.0,
            layers_created=0,
            layers_renamed=0,
            layer_organization_score=0.0,
            alignment_operations=0,
            distribution_operations=0,
            precision_score=0.0,
            copy_operations=0,
            paste_operations=0,
            duplicate_operations=0,
            reuse_efficiency=0.0,
            pages_created=0,
            page_switches=0,
            is_methodical=False,
            is_experimental=False,
            is_efficient=False,
            is_organized=False,
            design_process_score=0.0,
            technical_proficiency_score=0.0,
            efficiency_score=0.0
        )


# Singleton instance
event_analytics_service = EventAnalyticsService()
