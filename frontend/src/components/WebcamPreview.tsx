/**
 * WebcamPreview Component
 * 
 * Displays a small webcam preview with status overlay.
 * The overlay is draggable by the user.
 */

import React, { forwardRef, useState, useRef, useEffect } from 'react';

interface WebcamPreviewProps {
  cameraOn: boolean;
  faceMeshStatus: 'loading' | 'loaded' | 'error';
  facesCount: number;
  visible?: boolean; // If false, component won't render (hidden from candidates)
}

const WebcamPreview = forwardRef<HTMLVideoElement, WebcamPreviewProps>(
  ({ cameraOn, faceMeshStatus, facesCount, visible = false }, ref) => {
    // Camera still works in background, but preview is hidden from candidate view
    const [position, setPosition] = useState(() => {
      // Initialize position from localStorage or use default
      if (typeof window !== 'undefined') {
        const savedPosition = localStorage.getItem('webcam-preview-position');
        if (savedPosition) {
          try {
            const parsed = JSON.parse(savedPosition);
            const maxX = Math.max(0, window.innerWidth - 180);
            const maxY = Math.max(0, window.innerHeight - 120);
            return {
              x: Math.max(0, Math.min(parsed.x || 0, maxX)),
              y: Math.max(0, Math.min(parsed.y || 0, maxY)),
            };
          } catch (e) {
            // Fall through to default
          }
        }
      }
      // Default position: bottom right
      return typeof window !== 'undefined' 
        ? { x: window.innerWidth - 196, y: window.innerHeight - 136 }
        : { x: 0, y: 0 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(position);

    // Sync positionRef with position state
    useEffect(() => {
      positionRef.current = position;
    }, [position]);

    // Handle window resize to keep overlay in bounds
    useEffect(() => {
      const handleResize = () => {
        setPosition(prev => ({
          x: Math.min(prev.x, window.innerWidth - 196),
          y: Math.min(prev.y, window.innerHeight - 136),
        }));
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      e.preventDefault();
    };

    // Update ref when position changes
    useEffect(() => {
      positionRef.current = position;
    }, [position]);

    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Constrain to viewport bounds
        const maxX = window.innerWidth - 180;
        const maxY = window.innerHeight - 120;
        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));
        
        const newPosition = { x: constrainedX, y: constrainedY };
        positionRef.current = newPosition;
        setPosition(newPosition);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        // Save position to localStorage
        localStorage.setItem('webcam-preview-position', JSON.stringify(positionRef.current));
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging, dragOffset]);

    const statusColor = 
      faceMeshStatus === 'loaded' ? '#10b981' : 
      faceMeshStatus === 'loading' ? '#f59e0b' : 
      '#ef4444';

    const statusText = faceMeshStatus === 'loaded' ? 'LOADED' : 
                       faceMeshStatus === 'loading' ? 'LOADING' : 
                       'ERROR';

    return (
      <>
        <div 
          ref={containerRef}
          className="webcam-preview-container"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            display: visible ? 'block' : 'none', // Hide visually but keep camera running
          }}
          onMouseDown={handleMouseDown}
        >
          <video
            ref={ref}
            autoPlay
            playsInline
            muted
            className="webcam-video"
            style={{ pointerEvents: 'none' }}
          />
          {/* <div className="webcam-status">
            <span className={cameraOn ? 'status-on' : 'status-off'}>
              Camera: {cameraOn ? 'ON' : 'OFF'}
            </span>
            <span style={{ color: statusColor }}>
              | FaceMesh: {statusText}
            </span>
            <span>
              | Faces: {facesCount}
            </span>
          </div> */}
        </div>

        <style jsx>{`
          .webcam-preview-container {
            position: fixed;
            width: 180px;
            height: 120px;
            background-color: #1a1a1a;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 9998;
            border: 2px solid #333;
            user-select: none;
            touch-action: none;
          }

          .webcam-video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }

          .webcam-status {
            position: absolute;
            top: 4px;
            left: 4px;
            right: 4px;
            padding: 4px 6px;
            background-color: rgba(0, 0, 0, 0.7);
            color: #fff;
            font-size: 9px;
            font-family: monospace;
            border-radius: 4px;
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
          }

          .status-on {
            color: #10b981;
          }

          .status-off {
            color: #ef4444;
          }

          @media (max-width: 420px) {
            .webcam-preview-container {
              width: 140px;
              height: 100px;
            }

            .webcam-status {
              font-size: 8px;
            }
          }
        `}</style>
      </>
    );
  }
);

WebcamPreview.displayName = 'WebcamPreview';

export default WebcamPreview;
