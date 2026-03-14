/**
 * Advanced Penpot Event Tracker
 * Captures complete design interaction telemetry
 */

export interface PenpotEvent {
  session_id: string;
  event_type: string;
  timestamp: string;
  x?: number;
  y?: number;
  shape_id?: string;
  shape_type?: string;
  shape_name?: string;
  width?: number;
  height?: number;
  rotation?: number;
  from_x?: number;
  from_y?: number;
  to_x?: number;
  to_y?: number;
  fill_color?: string;
  stroke_color?: string;
  stroke_width?: number;
  opacity?: number;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  text_content?: string;
  text_align?: string;
  line_height?: number;
  letter_spacing?: number;
  tool_name?: string;
  previous_tool?: string;
  layer_id?: string;
  layer_name?: string;
  layer_order?: number;
  page_id?: string;
  page_name?: string;
  zoom_level?: number;
  canvas_x?: number;
  canvas_y?: number;
  key?: string;
  modifier_keys?: string[];
  component_id?: string;
  component_name?: string;
  is_instance?: boolean;
  idle_seconds?: number;
  metadata?: Record<string, any>;
}

export class PenpotEventTracker {
  private sessionId: string;
  private apiUrl: string;
  private eventBuffer: PenpotEvent[] = [];
  private batchSize: number = 20;
  private flushInterval: number = 10000; // 10 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private idleThreshold: number = 30000; // 30 seconds
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private isIdle: boolean = false;
  private currentTool: string = 'select';
  private penpotIframe: HTMLIFrameElement | null = null;

  constructor(sessionId: string, apiUrl: string) {
    this.sessionId = sessionId;
    this.apiUrl = apiUrl;
  }

  /**
   * Initialize event tracking
   */
  public init(penpotIframe: HTMLIFrameElement): void {
    this.penpotIframe = penpotIframe;
    
    // Start batch flush timer
    this.startFlushTimer();
    
    // Start idle detection
    this.startIdleDetection();
    
    // Listen to postMessage from Penpot iframe
    window.addEventListener('message', this.handlePenpotMessage.bind(this));
    
    // Track mouse events on iframe
    this.trackMouseEvents();
    
    // Track keyboard events
    this.trackKeyboardEvents();
    
    console.log('🎯 Penpot Event Tracker initialized');
  }

  /**
   * Handle messages from Penpot iframe
   */
  private handlePenpotMessage(event: MessageEvent): void {
    // Only accept messages from Penpot origin
    if (!event.origin.includes('localhost:9001') && !event.origin.includes('penpot')) {
      return;
    }

    const data = event.data;
    
    // Check if it's a Penpot event
    if (data && data.type && data.type.startsWith('penpot:')) {
      this.processPenpotEvent(data);
    }
  }

  /**
   * Process Penpot-specific events
   */
  private processPenpotEvent(data: any): void {
    const eventType = data.type.replace('penpot:', '');
    
    switch (eventType) {
      case 'shape:created':
        this.trackShapeCreate(data.payload);
        break;
      case 'shape:deleted':
        this.trackShapeDelete(data.payload);
        break;
      case 'shape:moved':
        this.trackShapeMove(data.payload);
        break;
      case 'shape:resized':
        this.trackShapeResize(data.payload);
        break;
      case 'shape:rotated':
        this.trackShapeRotate(data.payload);
        break;
      case 'shape:selected':
        this.trackShapeSelect(data.payload);
        break;
      case 'tool:changed':
        this.trackToolChange(data.payload);
        break;
      case 'color:changed':
        this.trackColorChange(data.payload);
        break;
      case 'font:changed':
        this.trackFontChange(data.payload);
        break;
      case 'layer:created':
        this.trackLayerCreate(data.payload);
        break;
      case 'page:created':
        this.trackPageCreate(data.payload);
        break;
      case 'component:created':
        this.trackComponentCreate(data.payload);
        break;
      case 'zoom:changed':
        this.trackZoomChange(data.payload);
        break;
      case 'undo':
        this.trackUndo();
        break;
      case 'redo':
        this.trackRedo();
        break;
      default:
        // Log unknown event types for debugging
        console.log('Unknown Penpot event:', eventType);
    }
  }

  /**
   * Track mouse events on iframe
   */
  private trackMouseEvents(): void {
    if (!this.penpotIframe) return;

    // Track clicks
    this.penpotIframe.addEventListener('click', (e) => {
      this.trackEvent({
        event_type: 'click',
        x: e.clientX,
        y: e.clientY
      });
    });

    // Track double clicks
    this.penpotIframe.addEventListener('dblclick', (e) => {
      this.trackEvent({
        event_type: 'double_click',
        x: e.clientX,
        y: e.clientY
      });
    });

    // Track right clicks
    this.penpotIframe.addEventListener('contextmenu', (e) => {
      this.trackEvent({
        event_type: 'right_click',
        x: e.clientX,
        y: e.clientY
      });
    });
  }

  /**
   * Track keyboard events
   */
  private trackKeyboardEvents(): void {
    window.addEventListener('keydown', (e) => {
      // Track keyboard shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const modifiers = [];
        if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
        if (e.shiftKey) modifiers.push('shift');
        if (e.altKey) modifiers.push('alt');

        this.trackEvent({
          event_type: 'keyboard_shortcut',
          key: e.key,
          modifier_keys: modifiers
        });

        // Track specific shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          if (e.shiftKey) {
            this.trackRedo();
          } else {
            this.trackUndo();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          this.trackCopy();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          this.trackPaste();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
          this.trackDuplicate();
        }
      }
    });
  }

  /**
   * Track shape creation
   */
  private trackShapeCreate(payload: any): void {
    this.trackEvent({
      event_type: 'shape_create',
      shape_id: payload.id,
      shape_type: payload.type,
      shape_name: payload.name,
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
      fill_color: payload.fillColor,
      stroke_color: payload.strokeColor
    });
  }

  /**
   * Track shape deletion
   */
  private trackShapeDelete(payload: any): void {
    this.trackEvent({
      event_type: 'shape_delete',
      shape_id: payload.id,
      shape_type: payload.type
    });
  }

  /**
   * Track shape movement
   */
  private trackShapeMove(payload: any): void {
    this.trackEvent({
      event_type: 'shape_move',
      shape_id: payload.id,
      from_x: payload.fromX,
      from_y: payload.fromY,
      to_x: payload.toX,
      to_y: payload.toY
    });
  }

  /**
   * Track shape resize
   */
  private trackShapeResize(payload: any): void {
    this.trackEvent({
      event_type: 'shape_resize',
      shape_id: payload.id,
      width: payload.width,
      height: payload.height
    });
  }

  /**
   * Track shape rotation
   */
  private trackShapeRotate(payload: any): void {
    this.trackEvent({
      event_type: 'shape_rotate',
      shape_id: payload.id,
      rotation: payload.rotation
    });
  }

  /**
   * Track shape selection
   */
  private trackShapeSelect(payload: any): void {
    this.trackEvent({
      event_type: 'shape_select',
      shape_id: payload.id,
      shape_type: payload.type
    });
  }

  /**
   * Track tool change
   */
  private trackToolChange(payload: any): void {
    const previousTool = this.currentTool;
    this.currentTool = payload.tool;
    
    this.trackEvent({
      event_type: `tool_${payload.tool}`,
      tool_name: payload.tool,
      previous_tool: previousTool
    });
  }

  /**
   * Track color change
   */
  private trackColorChange(payload: any): void {
    this.trackEvent({
      event_type: 'color_change',
      shape_id: payload.shapeId,
      fill_color: payload.fillColor,
      stroke_color: payload.strokeColor
    });
  }

  /**
   * Track font change
   */
  private trackFontChange(payload: any): void {
    this.trackEvent({
      event_type: 'font_change',
      shape_id: payload.shapeId,
      font_family: payload.fontFamily,
      font_size: payload.fontSize,
      font_weight: payload.fontWeight
    });
  }

  /**
   * Track layer creation
   */
  private trackLayerCreate(payload: any): void {
    this.trackEvent({
      event_type: 'layer_create',
      layer_id: payload.id,
      layer_name: payload.name
    });
  }

  /**
   * Track page creation
   */
  private trackPageCreate(payload: any): void {
    this.trackEvent({
      event_type: 'page_create',
      page_id: payload.id,
      page_name: payload.name
    });
  }

  /**
   * Track component creation
   */
  private trackComponentCreate(payload: any): void {
    this.trackEvent({
      event_type: 'component_create',
      component_id: payload.id,
      component_name: payload.name
    });
  }

  /**
   * Track zoom change
   */
  private trackZoomChange(payload: any): void {
    this.trackEvent({
      event_type: payload.direction === 'in' ? 'zoom_in' : 'zoom_out',
      zoom_level: payload.level
    });
  }

  /**
   * Track undo
   */
  private trackUndo(): void {
    this.trackEvent({
      event_type: 'undo'
    });
  }

  /**
   * Track redo
   */
  private trackRedo(): void {
    this.trackEvent({
      event_type: 'redo'
    });
  }

  /**
   * Track copy
   */
  private trackCopy(): void {
    this.trackEvent({
      event_type: 'copy'
    });
  }

  /**
   * Track paste
   */
  private trackPaste(): void {
    this.trackEvent({
      event_type: 'paste'
    });
  }

  /**
   * Track duplicate
   */
  private trackDuplicate(): void {
    this.trackEvent({
      event_type: 'duplicate'
    });
  }

  /**
   * Track generic event
   */
  private trackEvent(eventData: Partial<PenpotEvent>): void {
    this.lastActivityTime = Date.now();
    
    // End idle if currently idle
    if (this.isIdle) {
      this.endIdle();
    }

    const event: PenpotEvent = {
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      ...eventData
    } as PenpotEvent;

    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.batchSize) {
      this.flushEvents();
    }
  }

  /**
   * Start idle detection
   */
  private startIdleDetection(): void {
    this.idleCheckInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      
      if (timeSinceActivity >= this.idleThreshold && !this.isIdle) {
        this.startIdle();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Start idle period
   */
  private startIdle(): void {
    this.isIdle = true;
    this.trackEvent({
      event_type: 'idle_start'
    });
  }

  /**
   * End idle period
   */
  private endIdle(): void {
    const idleSeconds = Math.floor((Date.now() - this.lastActivityTime) / 1000);
    this.isIdle = false;
    this.trackEvent({
      event_type: 'idle_end',
      idle_seconds: idleSeconds
    });
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.flushEvents();
      }
    }, this.flushInterval);
  }

  /**
   * Flush events to server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToSend = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const response = await fetch(`${this.apiUrl}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          events: eventsToSend
        })
      });

      if (response.ok) {
        console.log(`✅ Flushed ${eventsToSend.length} events`);
      } else {
        console.error('Failed to flush events:', response.statusText);
        // Re-add events to buffer for retry
        this.eventBuffer.unshift(...eventsToSend);
      }
    } catch (error) {
      console.error('Error flushing events:', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...eventsToSend);
    }
  }

  /**
   * Stop tracking and flush remaining events
   */
  public async stop(): Promise<void> {
    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Flush remaining events
    await this.flushEvents();

    console.log('🛑 Penpot Event Tracker stopped');
  }
}
