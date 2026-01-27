export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-900 p-6">
      <div className="max-w-md text-center">
        {/* Logo - Gold themed */}
        <div className="w-20 h-20 border-2 border-gold-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl font-display text-gold-400">TR</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-display text-gold-400 mb-2">
          Timeless Rides
        </h1>
        <p className="text-charcoal-400 mb-8 uppercase text-sm tracking-wider">
          Premium Black Car Service
        </p>

        {/* Info box - Dark luxury */}
        <div className="bg-charcoal-800 border border-charcoal-700 rounded-lg p-6 text-left">
          <h2 className="font-display text-gold-400 text-lg mb-2">
            Need to book a ride?
          </h2>
          <p className="text-sm text-cream-100 leading-relaxed">
            Text Sofia, our AI concierge, to book your premium black car service.
            She&apos;ll send you a link to select your locations.
          </p>
        </div>

        {/* Contact info */}
        <div className="mt-8 space-y-2">
          <p className="text-sm text-charcoal-500">Contact us:</p>
          <p className="font-medium text-cream-100">Text: (248) 555-RIDE</p>
        </div>

        {/* Decorative line */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <div className="h-px w-16 bg-gold-400 opacity-30"></div>
          <div className="w-2 h-2 rounded-full bg-gold-400 opacity-50"></div>
          <div className="h-px w-16 bg-gold-400 opacity-30"></div>
        </div>
      </div>
    </div>
  )
}
