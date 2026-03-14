/**
 * Design Replay Viewer
 * Replays candidate's design process from captured events
 * Like Figma history playback
 */

import React, { useState, useEffect, useRef } from 'react';

interface DesignEvent {
  event_type: string;
  timestamp: string;
  shape_type?: string;
  shape_name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill_color?: string;
  stroke_color?: string;
  tool_name?: string;
  font_family?: string;
  font_size?: number;
  text_content?: string;
  [key: string]: any;
}

interface DesignReplayViewerProps {
  sessionId: string;
  events: DesignEvent[];
  apiUrl: string;
}

export default function DesignReplayViewer({
  sessionId,
  events,
  apiUrl
}: DesignReplayViewerProps) {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [timeline, setTimeline] = useState<DesignEvent[]>([]);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (events && events.length > 0) {
      setTimeline(events);
    }
  }, [events]);

  // Playback control
  useEffect(() => {
    if (isPlaying && currentEventIndex < timeline.length - 1) {
      const currentEvent = timeline[currentEventIndex];
      const nextEvent = timeline[currentEventIndex + 1];
      
      // Calculate time difference
      const currentTime = new Date(currentEvent.timestamp).getTime();
      const nextTime = new Date(nextEvent.timestamp).getTime();
      const delay = (nextTime - currentTime) / playbackSpeed;
      
      playbackTimerRef.current = setTimeout(() => {
        setCurrentEventIndex(prev => prev + 1);
      }, Math.max(delay, 100)); // Minimum 100ms delay
      
    } else if (currentEventIndex >= timeline.length - 1) {
      setIsPlaying(false);
    }
    
    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, [isPlaying, currentEventIndex, timeline, playbackSpeed]);

  const handlePlay = () => {
    if (currentEventIndex >= timeline.length - 1) {
      setCurrentEventIndex(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentEventIndex(0);
  };

  const handleSeek = (index: number) => {
    setCurrentEventIndex(index);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getEventIcon = (eventType: string): string => {
    if (eventType.includes('shape_create')) return '➕';
    if (eventType.includes('shape_delete')) return '🗑️';
    if (eventType.includes('shape_move')) return '↔️';
    if (eventType.includes('shape_resize')) return '↕️';
    if (eventType.includes('color')) return '🎨';
    if (eventType.includes('font')) return '🔤';
    if (eventType.includes('tool')) return '🔧';
    if (eventType.includes('undo')) return '↩️';
    if (eventType.includes('redo')) return '↪️';
    if (eventType.includes('copy')) return '📋';
    if (eventType.includes('paste')) return '📌';
    return '•';
  };

  const getEventDescription = (event: DesignEvent): string => {
    const type = event.event_type;
    
    if (type === 'shape_create') {
      return `Created ${event.shape_type || 'shape'} ${event.shape_name ? `"${event.shape_name}"` : ''}`;
    }
    if (type === 'shape_delete') {
      return `Deleted ${event.shape_type || 'shape'}`;
    }
    if (type === 'shape_move') {
      return `Moved shape from (${event.from_x}, ${event.from_y}) to (${event.to_x}, ${event.to_y})`;
    }
    if (type === 'shape_resize') {
      return `Resized to ${event.width}×${event.height}`;
    }
    if (type === 'color_change') {
      return `Changed color to ${event.fill_color || event.stroke_color}`;
    }
    if (type === 'font_change') {
      return `Changed font to ${event.font_family} ${event.font_size}px`;
    }
    if (type === 'text_edit') {
      return `Edited text: "${event.text_content?.substring(0, 30)}..."`;
    }
    if (type.startsWith('tool_')) {
      return `Switched to ${event.tool_name || type.replace('tool_', '')} tool`;
    }
    if (type === 'undo') {
      return 'Undo action';
    }
    if (type === 'redo') {
      return 'Redo action';
    }
    if (type === 'copy') {
      return 'Copied element';
    }
    if (type === 'paste') {
      return 'Pasted element';
    }
    if (type === 'keyboard_shortcut') {
      return `Used shortcut: ${event.modifier_keys?.join('+')} + ${event.key}`;
    }
    
    return type.replace(/_/g, ' ');
  };

  const currentEvent = timeline[currentEventIndex];
  const progress = timeline.length > 0 ? (currentEventIndex / (timeline.length - 1)) * 100 : 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        background: 'white',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#111827',
          margin: 0
        }}>
          Design Process Replay
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: '4px 0 0 0'
        }}>
          Watch how the candidate built their design
        </p>
      </div>

      {/* Playback Controls */}
      <div style={{
        padding: '16px 24px',
        background: 'white',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          {!isPlaying ? (
            <button
              onClick={handlePlay}
              style={{
                padding: '8px 16px',
                background: '#7C3AED',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ▶️ Play
            </button>
          ) : (
            <button
              onClick={handlePause}
              style={{
                padding: '8px 16px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ⏸️ Pause
            </button>
          )}
          
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⏮️ Reset
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 'auto'
          }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Speed:</span>
            {[0.5, 1.0, 2.0, 4.0].map(speed => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                style={{
                  padding: '4px 12px',
                  background: playbackSpeed === speed ? '#7C3AED' : '#e5e7eb',
                  color: playbackSpeed === speed ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          const index = Math.floor(percentage * (timeline.length - 1));
          handleSeek(index);
        }}
        >
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: '#7C3AED',
            transition: 'width 0.1s'
          }} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          <span>Event {currentEventIndex + 1} of {timeline.length}</span>
          <span>{currentEvent ? formatTimestamp(currentEvent.timestamp) : '--:--:--'}</span>
        </div>
      </div>

      {/* Current Event Display */}
      {currentEvent && (
        <div style={{
          padding: '16px 24px',
          background: '#f0f9ff',
          borderBottom: '1px solid #bae6fd'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>
              {getEventIcon(currentEvent.event_type)}
            </span>
            <div>
              <p style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#0c4a6e',
                margin: 0
              }}>
                {getEventDescription(currentEvent)}
              </p>
              <p style={{
                fontSize: '12px',
                color: '#075985',
                margin: '4px 0 0 0'
              }}>
                {formatTimestamp(currentEvent.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Event Timeline */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 24px'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Event Timeline
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {timeline.map((event, index) => (
            <div
              key={index}
              onClick={() => handleSeek(index)}
              style={{
                padding: '12px',
                background: index === currentEventIndex ? '#ede9fe' : 'white',
                border: `1px solid ${index === currentEventIndex ? '#7C3AED' : '#e5e7eb'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (index !== currentEventIndex) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentEventIndex) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>
                  {getEventIcon(event.event_type)}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: index === currentEventIndex ? 600 : 400,
                    color: index === currentEventIndex ? '#7C3AED' : '#374151',
                    margin: 0
                  }}>
                    {getEventDescription(event)}
                  </p>
                  <p style={{
                    fontSize: '11px',
                    color: '#9ca3af',
                    margin: '2px 0 0 0'
                  }}>
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
