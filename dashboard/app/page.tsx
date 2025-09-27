'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addDays, getISOWeek } from 'date-fns';
import axios from 'axios';

interface CampaignActivity {
  id: string;
  time: string;
  name: string;
  activityType: string;
  segment?: string;
  details?: string;
  recipientCount?: number;
  status: string;
  campaignId?: string;
  roundNumber?: number;
}

interface WeekSchedule {
  [day: string]: CampaignActivity[];
}

const CAMPAIGN_MANAGER_URL = process.env.NEXT_PUBLIC_CAMPAIGN_MANAGER_URL || 'http://localhost:3007';

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<WeekSchedule>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekNumber, setWeekNumber] = useState(getISOWeek(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekStart = startOfWeek(new Date(year, 0, 1 + (weekNumber - 1) * 7), { weekStartsOn: 1 });

  useEffect(() => {
    fetchSchedule();
  }, [weekNumber, year]);

  const fetchSchedule = async () => {
    setLoading(true);
    setError('');

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('dashboard_token='))
        ?.split('=')[1];

      const response = await axios.post(`${CAMPAIGN_MANAGER_URL}/mcp`, {
        tool: 'getWeekSchedule',
        params: { weekNumber, year },
        token
      });

      if (response.data.success) {
        setSchedule(response.data.schedule || {});
      } else {
        setError('Failed to fetch schedule');
      }
    } catch (err) {
      setError('Error loading schedule');
      console.error('Schedule fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndicator = (status: string) => {
    const indicators: { [key: string]: string } = {
      pending: '○',
      in_progress: '◐',
      active: '●',
      completed: '✓',
      failed: '✗',
      warning: '⚠'
    };
    return indicators[status] || '○';
  };

  const getActivityColor = (type: string) => {
    const colors: { [key: string]: string } = {
      launch: 'bg-green-100 border-green-300',
      preparation: 'bg-yellow-100 border-yellow-300',
      review: 'bg-blue-100 border-blue-300',
      milestone: 'bg-purple-100 border-purple-300',
      notification: 'bg-gray-100 border-gray-300'
    };
    return colors[type] || 'bg-gray-100 border-gray-300';
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(year, 0, 1 + (weekNumber - 1 + direction) * 7);
    setWeekNumber(getISOWeek(newDate));
    setYear(newDate.getFullYear());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Campaign Schedule</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateWeek(-1)}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                ← Previous
              </button>
              <span className="font-medium">
                Week {weekNumber} • {format(weekStart, 'MMM dd')} - {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM dd, yyyy')}
              </span>
              <button
                onClick={() => navigateWeek(1)}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {/* Weekly Calendar Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="grid grid-cols-7 divide-x">
            {days.map((day, index) => {
              const dayDate = addDays(weekStart, index);
              const dayActivities = schedule[day] || [];
              const isToday = format(dayDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

              return (
                <div key={day} className={`min-h-[300px] ${isToday ? 'bg-blue-50' : ''}`}>
                  {/* Day Header */}
                  <div className="p-3 border-b bg-gray-50">
                    <div className="font-semibold capitalize">{day}</div>
                    <div className="text-sm text-gray-600">{format(dayDate, 'MMM dd')}</div>
                  </div>

                  {/* Activities */}
                  <div className="p-2 space-y-2">
                    {dayActivities.length === 0 ? (
                      <div className="text-gray-400 text-sm text-center py-4">No activities</div>
                    ) : (
                      dayActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className={`p-2 rounded border ${getActivityColor(activity.activityType)}`}
                        >
                          <div className="flex items-start space-x-2">
                            <span className="text-lg">{getStatusIndicator(activity.status)}</span>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{activity.time}</div>
                              <div className="text-sm font-semibold">{activity.name}</div>
                              {activity.details && (
                                <div className="text-xs text-gray-600 mt-1">{activity.details}</div>
                              )}
                              {activity.recipientCount && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {activity.recipientCount.toLocaleString()} recipients
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Activities</div>
            <div className="text-2xl font-bold">
              {Object.values(schedule).flat().length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Campaigns</div>
            <div className="text-2xl font-bold">
              {Object.values(schedule).flat().filter(a => a.activityType === 'launch').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Recipients</div>
            <div className="text-2xl font-bold">
              {Object.values(schedule).flat().reduce((sum, a) => sum + (a.recipientCount || 0), 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Pending Tasks</div>
            <div className="text-2xl font-bold">
              {Object.values(schedule).flat().filter(a => a.status === 'pending').length}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}