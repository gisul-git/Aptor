"""
Advanced Design Event Tracking Models
Complete telemetry for design interaction analysis
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class DesignEventType(str, Enum):
    """Comprehensive design event types"""
    
    # Shape Operations
    SHAPE_CREATE = "shape_create"
    SHAPE_DELETE = "shape_delete"
    SHAPE_MOVE = "shape_move"
    SHAPE_RESIZE = "shape_resize"
    SHAPE_ROTATE = "shape_rotate"
    SHAPE_SELECT = "shape_select"
    SHAPE_DESELECT = "shape_deselect"
    SHAPE_DUPLICATE = "shape_duplicate"
    SHAPE_GROUP = "shape_group"
    SHAPE_UNGROUP = "shape_ungroup"
    
    # Layer Operations
    LAYER_CREATE = "layer_create"
    LAYER_DELETE = "layer_delete"
    LAYER_RENAME = "layer_rename"
    LAYER_REORDER = "layer_reorder"
    LAYER_LOCK = "layer_lock"
    LAYER_UNLOCK = "layer_unlock"
    LAYER_HIDE = "layer_hide"
    LAYER_SHOW = "layer_show"
    
    # Tool Changes
    TOOL_SELECT = "tool_select"
    TOOL_RECTANGLE = "tool_rectangle"
    TOOL_CIRCLE = "tool_circle"
    TOOL_TEXT = "tool_text"
    TOOL_LINE = "tool_line"
    TOOL_PEN = "tool_pen"
    TOOL_PENCIL = "tool_pencil"
    TOOL_HAND = "tool_hand"
    TOOL_ZOOM = "tool_zoom"
    
    # Style Changes
    COLOR_CHANGE = "color_change"
    FILL_CHANGE = "fill_change"
    STROKE_CHANGE = "stroke_change"
    OPACITY_CHANGE = "opacity_change"
    SHADOW_ADD = "shadow_add"
    SHADOW_REMOVE = "shadow_remove"
    BLUR_ADD = "blur_add"
    BLUR_REMOVE = "blur_remove"
    
    # Typography
    FONT_CHANGE = "font_change"
    FONT_SIZE_CHANGE = "font_size_change"
    FONT_WEIGHT_CHANGE = "font_weight_change"
    TEXT_ALIGN_CHANGE = "text_align_change"
    TEXT_EDIT = "text_edit"
    LINE_HEIGHT_CHANGE = "line_height_change"
    LETTER_SPACING_CHANGE = "letter_spacing_change"
    
    # Canvas Operations
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    ZOOM_FIT = "zoom_fit"
    PAN_CANVAS = "pan_canvas"
    CANVAS_RESET = "canvas_reset"
    
    # Page Operations
    PAGE_CREATE = "page_create"
    PAGE_DELETE = "page_delete"
    PAGE_RENAME = "page_rename"
    PAGE_SWITCH = "page_switch"
    PAGE_DUPLICATE = "page_duplicate"
    
    # Component Operations
    COMPONENT_CREATE = "component_create"
    COMPONENT_INSTANCE = "component_instance"
    COMPONENT_DETACH = "component_detach"
    COMPONENT_UPDATE = "component_update"
    
    # Clipboard Operations
    COPY = "copy"
    CUT = "cut"
    PASTE = "paste"
    DUPLICATE = "duplicate"
    
    # History Operations
    UNDO = "undo"
    REDO = "redo"
    
    # Alignment & Distribution
    ALIGN_LEFT = "align_left"
    ALIGN_CENTER = "align_center"
    ALIGN_RIGHT = "align_right"
    ALIGN_TOP = "align_top"
    ALIGN_MIDDLE = "align_middle"
    ALIGN_BOTTOM = "align_bottom"
    DISTRIBUTE_HORIZONTAL = "distribute_horizontal"
    DISTRIBUTE_VERTICAL = "distribute_vertical"
    
    # Grid & Guides
    GRID_TOGGLE = "grid_toggle"
    SNAP_TOGGLE = "snap_toggle"
    GUIDE_CREATE = "guide_create"
    GUIDE_DELETE = "guide_delete"
    
    # Keyboard Shortcuts
    KEYBOARD_SHORTCUT = "keyboard_shortcut"
    
    # Interaction Events
    CLICK = "click"
    DOUBLE_CLICK = "double_click"
    RIGHT_CLICK = "right_click"
    DRAG_START = "drag_start"
    DRAG_END = "drag_end"
    
    # Session Events
    IDLE_START = "idle_start"
    IDLE_END = "idle_end"
    FOCUS_LOST = "focus_lost"
    FOCUS_GAINED = "focus_gained"
    
    # Export Operations
    EXPORT_PNG = "export_png"
    EXPORT_SVG = "export_svg"
    EXPORT_PDF = "export_pdf"


class ShapeType(str, Enum):
    """Shape types in design tool"""
    RECTANGLE = "rectangle"
    CIRCLE = "circle"
    ELLIPSE = "ellipse"
    TRIANGLE = "triangle"
    LINE = "line"
    ARROW = "arrow"
    TEXT = "text"
    IMAGE = "image"
    PATH = "path"
    GROUP = "group"
    FRAME = "frame"
    COMPONENT = "component"


class DesignEventModel(BaseModel):
    """Enhanced design event model with complete telemetry"""
    
    # Core fields
    session_id: str
    event_type: DesignEventType
    timestamp: str  # ISO format
    
    # Position data
    x: Optional[int] = None
    y: Optional[int] = None
    
    # Shape-specific data
    shape_id: Optional[str] = None
    shape_type: Optional[ShapeType] = None
    shape_name: Optional[str] = None
    
    # Dimension data
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: Optional[float] = None
    
    # Position data (for move events)
    from_x: Optional[float] = None
    from_y: Optional[float] = None
    to_x: Optional[float] = None
    to_y: Optional[float] = None
    
    # Style data
    fill_color: Optional[str] = None
    stroke_color: Optional[str] = None
    stroke_width: Optional[float] = None
    opacity: Optional[float] = None
    
    # Typography data
    font_family: Optional[str] = None
    font_size: Optional[float] = None
    font_weight: Optional[str] = None
    text_content: Optional[str] = None
    text_align: Optional[str] = None
    line_height: Optional[float] = None
    letter_spacing: Optional[float] = None
    
    # Tool data
    tool_name: Optional[str] = None
    previous_tool: Optional[str] = None
    
    # Layer data
    layer_id: Optional[str] = None
    layer_name: Optional[str] = None
    layer_order: Optional[int] = None
    
    # Page data
    page_id: Optional[str] = None
    page_name: Optional[str] = None
    
    # Canvas data
    zoom_level: Optional[float] = None
    canvas_x: Optional[float] = None
    canvas_y: Optional[float] = None
    
    # Keyboard data
    key: Optional[str] = None
    modifier_keys: Optional[List[str]] = None  # ["ctrl", "shift", "alt"]
    
    # Component data
    component_id: Optional[str] = None
    component_name: Optional[str] = None
    is_instance: Optional[bool] = None
    
    # Idle tracking
    idle_seconds: Optional[int] = None
    
    # Additional metadata
    metadata: Optional[Dict[str, Any]] = None
    
    # Server timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class EventBatchModel(BaseModel):
    """Batch event submission for performance"""
    session_id: str
    events: List[DesignEventModel]


class EventAnalytics(BaseModel):
    """Analytics computed from events"""
    session_id: str
    
    # Time metrics
    total_time_seconds: int
    active_time_seconds: int
    idle_time_seconds: int
    planning_time_seconds: int  # Time before first shape
    execution_time_seconds: int  # Time after first shape
    
    # Shape metrics
    total_shapes_created: int
    total_shapes_deleted: int
    final_shape_count: int
    shape_type_distribution: Dict[str, int]
    
    # Interaction metrics
    total_clicks: int
    total_undo: int
    total_redo: int
    undo_ratio: float  # undo / (undo + redo)
    
    # Tool usage
    tool_switches: int
    most_used_tool: str
    tool_usage_distribution: Dict[str, int]
    
    # Style changes
    color_changes: int
    font_changes: int
    unique_colors_used: int
    unique_fonts_used: int
    
    # Component reuse
    components_created: int
    component_instances: int
    component_reuse_score: float  # instances / created
    
    # Canvas operations
    zoom_changes: int
    pan_operations: int
    
    # Keyboard shortcuts
    keyboard_shortcuts_used: int
    shortcut_proficiency: float  # shortcuts / total_operations
    
    # Design iterations
    design_iterations: int  # Major changes (shape create/delete cycles)
    trial_error_ratio: float  # delete / create
    
    # Layer organization
    layers_created: int
    layers_renamed: int
    layer_organization_score: float
    
    # Alignment usage
    alignment_operations: int
    distribution_operations: int
    precision_score: float
    
    # Copy/paste behavior
    copy_operations: int
    paste_operations: int
    duplicate_operations: int
    reuse_efficiency: float
    
    # Page management
    pages_created: int
    page_switches: int
    
    # Behavior insights
    is_methodical: bool  # Low undo ratio, high planning time
    is_experimental: bool  # High undo ratio, many iterations
    is_efficient: bool  # High shortcut usage, low tool switches
    is_organized: bool  # Good layer management
    
    # Overall scores
    design_process_score: float  # 0-100
    technical_proficiency_score: float  # 0-100
    efficiency_score: float  # 0-100
    
    computed_at: datetime = Field(default_factory=datetime.utcnow)
