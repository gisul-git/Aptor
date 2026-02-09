import React, { useState, useEffect } from 'react';

export default function DesignTestWindowPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [penpotWindow, setPenpotWindow] = useState<Window | null>(null);

  const API_URL = 'http://localhost:3006/api/v1/design';

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;