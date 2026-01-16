import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Interview {
  id: string;
  candidate_id: string;
  interview_type: string;
  scheduled_at: string | null;
  status: string;
  candidate: {
    full_name: string;
  };
  interviewer?: {
    name: string;
  } | null;
  interviewer_name?: string | null;
}

interface InterviewCalendarProps {
  interviews: Interview[];
  view: 'week' | 'month';
  onViewChange: (view: 'week' | 'month') => void;
  onInterviewClick?: (interview: Interview) => void;
}

export function InterviewCalendar({ 
  interviews, 
  view, 
  onViewChange,
  onInterviewClick 
}: InterviewCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hr': return 'bg-blue-500';
      case 'technical': return 'bg-purple-500';
      case 'final': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'hr': return 'RH';
      case 'technical': return 'Técnica';
      case 'final': return 'Final';
      default: return type;
    }
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days from previous month
    const firstDayOfWeek = start.getDay();
    const paddingStart = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const paddingDays = Array.from({ length: paddingStart }, (_, i) => 
      addDays(start, -(paddingStart - i))
    );
    
    return [...paddingDays, ...days];
  }, [currentDate]);

  const getInterviewsForDay = (date: Date) => {
    return interviews.filter(i => 
      i.scheduled_at && isSameDay(new Date(i.scheduled_at), date)
    );
  };

  const navigatePrev = () => {
    if (view === 'week') {
      setCurrentDate(prev => addDays(prev, -7));
    } else {
      setCurrentDate(prev => subMonths(prev, 1));
    }
  };

  const navigateNext = () => {
    if (view === 'week') {
      setCurrentDate(prev => addDays(prev, 7));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendário de Entrevistas
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('week')}
                className="rounded-r-none"
              >
                Semana
              </Button>
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('month')}
                className="rounded-l-none"
              >
                Mês
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
          </div>
          <span className="font-medium">
            {view === 'week' 
              ? `${format(weekDays[0], "dd MMM", { locale: ptBR })} - ${format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}`
              : format(currentDate, "MMMM yyyy", { locale: ptBR })
            }
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {view === 'week' ? (
          // Week View
          <div className="grid grid-cols-7 gap-1">
            {/* Header */}
            {weekDays.map(day => (
              <div 
                key={day.toISOString()} 
                className={`text-center p-2 text-sm font-medium ${
                  isSameDay(day, new Date()) ? 'bg-primary/10 rounded-t-lg' : ''
                }`}
              >
                <div className="text-muted-foreground">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-primary font-bold' : ''}`}>
                  {format(day, "dd")}
                </div>
              </div>
            ))}
            
            {/* Content */}
            {weekDays.map(day => {
              const dayInterviews = getInterviewsForDay(day);
              return (
                <div 
                  key={`content-${day.toISOString()}`} 
                  className={`min-h-[150px] p-1 border rounded-b-lg ${
                    isSameDay(day, new Date()) ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                >
                  {dayInterviews.map(interview => (
                    <div
                      key={interview.id}
                      className={`${getTypeColor(interview.interview_type)} text-white text-xs p-1.5 rounded mb-1 cursor-pointer hover:opacity-90 transition-opacity`}
                      onClick={() => onInterviewClick?.(interview)}
                    >
                      <div className="font-medium truncate">
                        {format(new Date(interview.scheduled_at!), "HH:mm")}
                      </div>
                      <div className="truncate opacity-90">
                        {interview.candidate.full_name}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          // Month View
          <div className="grid grid-cols-7 gap-1">
            {/* Header */}
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="text-center p-2 text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Days */}
            {monthDays.map(day => {
              const dayInterviews = getInterviewsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`min-h-[80px] p-1 border rounded ${
                    !isCurrentMonth ? 'bg-muted/30 opacity-50' : ''
                  } ${isToday ? 'bg-primary/5 border-primary/30' : ''}`}
                >
                  <div className={`text-sm mb-1 ${isToday ? 'text-primary font-bold' : ''}`}>
                    {format(day, "d")}
                  </div>
                  {dayInterviews.slice(0, 2).map(interview => (
                    <div
                      key={interview.id}
                      className={`${getTypeColor(interview.interview_type)} text-white text-[10px] p-1 rounded mb-0.5 cursor-pointer truncate`}
                      onClick={() => onInterviewClick?.(interview)}
                    >
                      {format(new Date(interview.scheduled_at!), "HH:mm")} {interview.candidate.full_name.split(' ')[0]}
                    </div>
                  ))}
                  {dayInterviews.length > 2 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{dayInterviews.length - 2} mais
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-xs text-muted-foreground">RH</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-500" />
            <span className="text-xs text-muted-foreground">Técnica</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-xs text-muted-foreground">Final</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
