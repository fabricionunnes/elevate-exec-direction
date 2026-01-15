import { Badge } from "@/components/ui/badge";

interface MeetingSentimentBadgeProps {
  sentiment?: string | null;
  score?: number;
  size?: 'sm' | 'md';
  onClick?: (e: React.MouseEvent) => void;
}

export const MeetingSentimentBadge = ({ sentiment, score, size = 'sm', onClick }: MeetingSentimentBadgeProps) => {
  if (!sentiment) return null;

  const getSentimentConfig = () => {
    switch (sentiment) {
      case 'positive':
        return {
          emoji: '😊',
          label: 'Positivo',
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
        };
      case 'negative':
        return {
          emoji: '😟',
          label: 'Negativo',
          className: 'bg-red-500/10 text-red-600 border-red-500/20',
        };
      case 'mixed':
        return {
          emoji: '🤔',
          label: 'Misto',
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        };
      default:
        return {
          emoji: '😐',
          label: 'Neutro',
          className: 'bg-muted text-muted-foreground border-muted-foreground/20',
        };
    }
  };

  const config = getSentimentConfig();

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${size === 'sm' ? 'text-xs' : 'text-sm'} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      <span className="mr-1">{config.emoji}</span>
      {config.label}
      {score !== undefined && (
        <span className="ml-1 opacity-70">({score}%)</span>
      )}
    </Badge>
  );
};
