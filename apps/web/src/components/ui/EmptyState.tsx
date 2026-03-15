import Card from './Card';

interface EmptyStateProps {
  title: string;
  body: string;
}

function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <Card tone="muted" className="border-dashed">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">{body}</p>
    </Card>
  );
}

export default EmptyState;
