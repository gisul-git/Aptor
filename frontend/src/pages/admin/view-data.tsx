import { useState, useEffect } from 'react';

interface Session {
  session_id: string;
  screenshot_count: number;
  event_count: number;
}

export default function ViewDataPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventStats, setEventStats] = useState<any>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      // Get unique sessions from screenshots
      const res = await fetch('http://localhost:3006/api/v1/design/sessions/list');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSessionData = async (sessionId: string) => {
    setLoading(true);
    setSelectedSession(sessionId);

    try {
      // Fetch screenshots
      const screenshotsRes = await fetch(
        `http://localhost:3006/api/v1/design/sessions/${sessionId}/screenshots`
      );
      if (screenshotsRes.ok) {
        const data = await screenshotsRes.json();
        setScreenshots(data.screenshots || []);
      }

      // Fetch events
      const eventsRes = await fetch(
        `http://localhost:3006/api/v1/design/sessions/${sessionId}/events`
      );
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data.events || []);
        setEventStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load session data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">View Captured Data</h1>

        {/* Sessions List */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Sessions</h2>
          
          {sessions.length === 0 ? (
            <p className="text-gray-500">No sessions found. Complete an assessment first!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <button
                  key={session.session_id}
                  onClick={() => loadSessionData(session.session_id)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    selectedSession === session.session_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-mono text-sm text-gray-600 mb-2">
                    {session.session_id.slice(0, 12)}...
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span>📸 {session.screenshot_count}</span>
                    <span>🎯 {session.event_count}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Session Data */}
        {selectedSession && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-600">Loading data...</p>
              </div>
            ) : (
              <>
                {/* Event Statistics */}
                {eventStats && (
                  <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Event Statistics</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {eventStats.total_events || 0}
                        </div>
                        <div className="text-sm text-gray-600">Total Events</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {eventStats.total_clicks || 0}
                        </div>
                        <div className="text-sm text-gray-600">Clicks</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {eventStats.total_undo || 0}
                        </div>
                        <div className="text-sm text-gray-600">Undo</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {eventStats.total_redo || 0}
                        </div>
                        <div className="text-sm text-gray-600">Redo</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {Math.floor((eventStats.total_idle_seconds || 0) / 60)}m
                        </div>
                        <div className="text-sm text-gray-600">Idle Time</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Screenshots */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Screenshots ({screenshots.length})
                  </h2>
                  {screenshots.length === 0 ? (
                    <p className="text-gray-500">No screenshots captured</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {screenshots.map((screenshot, idx) => (
                        <div key={screenshot._id} className="relative group">
                          <img
                            src={screenshot.image_data}
                            alt={`Screenshot ${idx + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all"
                            onClick={() => window.open(screenshot.image_data, '_blank')}
                          />
                          <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                            #{idx + 1}
                          </div>
                          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                            {new Date(screenshot.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Events Timeline */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    Events Timeline ({events.length})
                  </h2>
                  {events.length === 0 ? (
                    <p className="text-gray-500">No events captured</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {events.map((event, idx) => (
                        <div
                          key={event._id || idx}
                          className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                        >
                          <div className="text-2xl">
                            {event.type === 'click' && '🖱️'}
                            {event.type === 'undo' && '↩️'}
                            {event.type === 'redo' && '↪️'}
                            {event.type === 'idle' && '⏸️'}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium capitalize">{event.type}</div>
                            {event.type === 'click' && event.x && (
                              <div className="text-sm text-gray-600">
                                Position: ({event.x}, {event.y}) • Target: {event.target}
                              </div>
                            )}
                            {event.type === 'idle' && event.idle_seconds && (
                              <div className="text-sm text-gray-600">
                                Idle for {event.idle_seconds} seconds
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
