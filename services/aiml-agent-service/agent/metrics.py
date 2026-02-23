"""
Metrics collection for AIML Agent Service.
"""

import time
import logging
from typing import Dict, Any
from collections import defaultdict
from datetime import datetime
from agent.config import Config

logger = logging.getLogger(__name__)

class Metrics:
    """Simple metrics collector."""
    
    def __init__(self):
        self.counters = defaultdict(int)
        self.gauges = defaultdict(float)
        self.histograms = defaultdict(list)
        self.start_time = time.time()
    
    def increment(self, metric: str, value: int = 1, tags: Dict[str, str] = None):
        """Increment a counter metric."""
        key = self._build_key(metric, tags)
        self.counters[key] += value
        logger.debug(f"Metric increment: {key} = {self.counters[key]}")
    
    def gauge(self, metric: str, value: float, tags: Dict[str, str] = None):
        """Set a gauge metric."""
        key = self._build_key(metric, tags)
        self.gauges[key] = value
        logger.debug(f"Metric gauge: {key} = {value}")
    
    def histogram(self, metric: str, value: float, tags: Dict[str, str] = None):
        """Record a histogram value."""
        key = self._build_key(metric, tags)
        self.histograms[key].append(value)
        # Keep only last 1000 values
        if len(self.histograms[key]) > 1000:
            self.histograms[key] = self.histograms[key][-1000:]
    
    def _build_key(self, metric: str, tags: Dict[str, str] = None) -> str:
        """Build metric key with tags."""
        if tags:
            tag_str = ','.join(f"{k}={v}" for k, v in sorted(tags.items()))
            return f"{metric}[{tag_str}]"
        return metric
    
    def get_stats(self) -> Dict[str, Any]:
        """Get all metrics as a dictionary."""
        uptime = time.time() - self.start_time
        
        # Calculate histogram statistics
        histogram_stats = {}
        for key, values in self.histograms.items():
            if values:
                histogram_stats[key] = {
                    'count': len(values),
                    'min': min(values),
                    'max': max(values),
                    'avg': sum(values) / len(values),
                    'p50': sorted(values)[len(values) // 2] if values else 0,
                    'p95': sorted(values)[int(len(values) * 0.95)] if values else 0,
                    'p99': sorted(values)[int(len(values) * 0.99)] if values else 0,
                }
        
        return {
            'uptime_seconds': uptime,
            'counters': dict(self.counters),
            'gauges': dict(self.gauges),
            'histograms': histogram_stats,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def reset(self):
        """Reset all metrics."""
        self.counters.clear()
        self.gauges.clear()
        self.histograms.clear()
        self.start_time = time.time()

# Global metrics instance
_metrics = Metrics()

def get_metrics() -> Metrics:
    """Get global metrics instance."""
    return _metrics

