const BRANDS = ["Lumora", "Vastra Co.", "Kaveri Labs", "Zestro", "Meridian", "Aarogya+", "NimbusPay", "Deshi Roots"];

export default function LogoCloud() {
  const list = [...BRANDS, ...BRANDS];
  return (
    <section aria-label="Trusted by" className="border-y border-line bg-surface py-12">
      <div className="container-x">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Trusted by 300+ Indian brands &amp; agencies
        </p>
        <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="flex w-max animate-marquee items-center gap-16">
            {list.map((b, i) => (
              <span
                key={`${b}-${i}`}
                className="whitespace-nowrap text-lg font-bold tracking-tight text-ink/40 transition-colors duration-300 hover:text-ink/90"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
