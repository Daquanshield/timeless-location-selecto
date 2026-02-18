interface EmptyStateProps {
  title?: string
  message?: string
}

export default function EmptyState({
  title = 'No rides found',
  message = 'New rides will appear here when assigned.',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(212, 175, 55, 0.1)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5">
          <path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-4m-6 0l3 3m-3-3l3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="font-display text-lg text-cream/60 mb-1">{title}</h3>
      <p className="text-cream/40 text-sm text-center max-w-xs">{message}</p>
    </div>
  )
}
