export default function ConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-900 p-6">
      <div className="max-w-md text-center">
        {/* Success icon - Gold themed */}
        <div className="w-20 h-20 border-2 border-gold-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gold-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-display text-gold-400 mb-3">
          Locations Confirmed
        </h1>

        {/* Message */}
        <p className="text-cream-100 mb-8">
          Your pickup and drop-off locations have been saved.
          Sofia will continue your booking via text message.
        </p>

        {/* Timeless Rides branding */}
        <div className="pt-6 border-t border-charcoal-700">
          <p className="text-sm text-charcoal-400 mb-2">
            Thank you for choosing
          </p>
          <p className="text-xl font-display text-gold-400">
            Timeless Rides
          </p>
          <p className="text-xs text-charcoal-500 mt-1 uppercase tracking-wider">
            Premium Black Car Service
          </p>
        </div>

        {/* Close instruction */}
        <p className="text-xs text-charcoal-500 mt-8">
          You can close this page now.
        </p>
      </div>
    </div>
  )
}
